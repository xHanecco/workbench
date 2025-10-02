const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const unzipper = require('unzipper'); // For unzipping the manifest content

const MANIFEST_DIR = path.join(__dirname, 'manifest_data');
const DB_PATH = path.join(MANIFEST_DIR, 'destiny_manifest.sqlite');
const VERSION_PATH = path.join(MANIFEST_DIR, 'manifest_version.txt');

let db = null;

// 1. Get the URL for the mobile manifest
async function getManifestUrl() {
    const response = await axios.get('https://www.bungie.net/Platform/Destiny2/Manifest/', {
        headers: { 'X-API-Key': process.env.BUNGIE_API_KEY }
    });
    return response.data.Response.mobileWorldContentPaths.ja;
}

// 2. Download and unzip the manifest file
async function downloadManifest(manifestUrl) {
    if (!fs.existsSync(MANIFEST_DIR)) {
        fs.mkdirSync(MANIFEST_DIR);
    }

    console.log('Downloading new Destiny Manifest...');
    const response = await axios({
        method: 'get',
        url: `https://www.bungie.net${manifestUrl}`,
        responseType: 'stream'
    });

    // The downloaded file is a zip file containing the sqlite db
    // We need to unzip it to get the actual database.
    const writer = fs.createWriteStream(DB_PATH);

    return new Promise((resolve, reject) => {
        response.data.pipe(unzipper.Parse())
            .on('entry', function (entry) {
                // The zip file from Bungie contains a single file with a long, generated name.
                // We will just extract the first file we find and rename it.
                entry.pipe(writer)
                    .on('finish', resolve)
                    .on('error', reject);
            })
            .on('error', reject);
    });
}

// 3. Initialize the service
async function initialize() {
    let dbInitialized = false;
    try {
        console.log('Checking for Destiny Manifest updates...');
        const manifestUrl = await getManifestUrl();
        const currentVersion = manifestUrl.split('/').pop(); // Use the filename as a version identifier

        let needsUpdate = true;
        if (fs.existsSync(VERSION_PATH)) {
            const localVersion = fs.readFileSync(VERSION_PATH, 'utf8');
            if (localVersion === currentVersion) {
                needsUpdate = false;
            }
        }

        if (needsUpdate) {
            await downloadManifest(manifestUrl);
            fs.writeFileSync(VERSION_PATH, currentVersion, 'utf8');
            console.log('Manifest updated successfully.');
        } else {
            console.log('Manifest is up to date.');
        }

    } catch (error) {
        console.error('Failed to check/update manifest:', error.message);
        if (fs.existsSync(DB_PATH)) {
            console.warn('Proceeding with existing local manifest data.');
        } else {
            // If there's no local data at all, we cannot proceed.
            throw new Error('Manifest update failed and no local data is available. Cannot start service.');
        }
    } finally {
        // Initialize the database connection if the file exists
        if (fs.existsSync(DB_PATH)) {
            db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    console.error('Error opening database', err.message);
                } else {
                    console.log('Successfully connected to the manifest database.');
                    dbInitialized = true;
                }
            });
        } else {
            console.error('Manifest database file not found. Service cannot function.');
        }
    }
}

// Helper function to get a single definition from the database
function getDef(tableName, hash) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('Database not initialized.'));
        }

        const query = `
            SELECT json
            FROM ${tableName}
            WHERE id = ?
        `;
        
        // The hash in the API is a signed 32-bit integer, but the id in the DB is unsigned.
        // We need to convert it.
        const id = parseInt(hash, 10);
        const unsignedId = (id < 0) ? (id + 4294967296) : id;

        db.get(query, [unsignedId], (err, row) => {
            if (err) {
                return reject(err);
            }
            if (row) {
                resolve(JSON.parse(row.json));
            } else {
                resolve(null); // Not found
            }
        });
    });
}

// 4. Search for an item by name
function searchItems(searchTerm) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('Database not initialized.'));
        }

        // The 'json' column contains a JSON blob with all item properties
        const query = `
            SELECT json_extract(json, '$.displayProperties.name') AS name,
                   json_extract(json, '$.displayProperties.icon') AS icon,
                   json_extract(json, '$.itemTypeDisplayName') AS itemType,
                   json_extract(json, '$.hash') as hash
            FROM DestinyInventoryItemDefinition
            WHERE name LIKE ?
            LIMIT 20
        `;

        db.all(query, [`%${searchTerm}%`], (err, rows) => {
            if (err) {
                return reject(err);
            }
            
            // We need to reconstruct the object to match the frontend's expectation
            const results = rows.map(row => ({
                hash: row.hash,
                displayProperties: {
                    name: row.name,
                    icon: row.icon
                },
                itemTypeDisplayName: row.itemType
            }));

            resolve(results);
        });
    });
}

async function getItemByHash(hash) {
    const itemDef = await getDef('DestinyInventoryItemDefinition', hash);
    if (!itemDef) return null;

    const item = {
        hash: itemDef.hash,
        displayProperties: itemDef.displayProperties,
        itemTypeDisplayName: itemDef.itemTypeDisplayName,
        flavorText: itemDef.flavorText,
    };

    // Get stats
    if (itemDef.stats && itemDef.stats.stats) {
        item.stats = { stats: {} };
        for (const [statHash, stat] of Object.entries(itemDef.stats.stats)) {
            const statDef = await getDef('DestinyStatDefinition', stat.statHash);
            if (statDef) {
                item.stats.stats[statHash] = {
                    ...stat,
                    displayProperties: statDef.displayProperties,
                };
            }
        }
    }

    // Get perks (both fixed and random)
    if (itemDef.sockets && itemDef.sockets.socketEntries) {
        item.perks = [];
        item.randomPerkColumns = [];

        // Iterate over ALL socket entries to find random perks, not just those in a specific category.
        for (const socket of itemDef.sockets.socketEntries) {
            // Get the single initial (fixed) perk for the main "perks" list (traits)
            if (socket.singleInitialItemHash) {
                const plug = await getDef('DestinyInventoryItemDefinition', socket.singleInitialItemHash);
                // Only show items categorized as a "Weapon Perk" in the main perk list for clarity.
                if (plug && plug.itemTypeDisplayName === 'Weapon Perk') {
                    item.perks.push({
                        hash: plug.hash,
                        displayProperties: plug.displayProperties,
                    });
                }
            }

            // Get the full list of random/reusable perks for the "random perks" section
            const plugSetHash = socket.reusablePlugSetHash || socket.randomizedPlugSetHash;
            if (plugSetHash) {
                const plugSetDef = await getDef('DestinyPlugSetDefinition', plugSetHash);
                // We are interested in sockets where there is more than one option.
                if (plugSetDef && plugSetDef.reusablePlugItems && plugSetDef.reusablePlugItems.length > 1) {
                    const perkColumn = [];
                    for (const plugItem of plugSetDef.reusablePlugItems) {
                        const perkDef = await getDef('DestinyInventoryItemDefinition', plugItem.plugItemHash);
                        // Ensure the perk is valid, has an icon, and is not a shader.
                        if (perkDef && perkDef.displayProperties && perkDef.displayProperties.hasIcon && perkDef.itemTypeDisplayName !== 'Shader' && perkDef.itemTypeDisplayName !== 'シェーダー') {
                            perkColumn.push({
                                hash: perkDef.hash,
                                displayProperties: perkDef.displayProperties,
                            });
                        }
                    }
                    if (perkColumn.length > 0) {
                        item.randomPerkColumns.push(perkColumn);
                    }
                }
            }
        }
    }

    return item;
}

module.exports = { initialize, searchItems, getItemByHash };
