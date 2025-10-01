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

        // Initialize the database connection
        db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error opening database', err.message);
            } else {
                console.log('Successfully connected to the manifest database.');
            }
        });

    } catch (error) {
        console.error('Failed to initialize manifest service:', error.message);
    }
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
    // 1. Get the base item definition
    const item = await new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized.'));
        const id = new Int32Array([parseInt(hash, 10)])[0];
        const query = `SELECT json FROM DestinyInventoryItemDefinition WHERE id = ?`;
        db.get(query, [id], (err, row) => {
            if (err) return reject(err);
            resolve(row ? JSON.parse(row.json) : null);
        });
    });

    if (!item) return null;
    
    // --- DEBUG START ---
    console.log('--- 1. RAW WEAPON DATA ---');
    // Log only the sockets part to avoid flooding the console
    console.log(JSON.stringify(item.sockets, null, 2));
    // --- DEBUG END ---

    // 2. Enrich stats with their definitions (omitted for brevity, no changes here)
    if (item.stats && item.stats.stats) {
        const statHashes = Object.keys(item.stats.stats);
        if (statHashes.length > 0) {
            const statDefs = await new Promise((resolve, reject) => {
                const placeholders = statHashes.map(() => '?').join(',');
                const query = `SELECT json FROM DestinyStatDefinition WHERE id IN (${placeholders})`;
                const statIds = statHashes.map(h => new Int32Array([parseInt(h, 10)])[0]);
                db.all(query, statIds, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows.map(r => JSON.parse(r.json)));
                });
            });
            const statDefsMap = new Map(statDefs.map(def => [def.hash, def]));
            for (const statHash in item.stats.stats) {
                const statDef = statDefsMap.get(parseInt(statHash, 10));
                if (statDef) {
                    item.stats.stats[statHash].displayProperties = statDef.displayProperties;
                }
            }
        }
    }

    // 3. Enrich with perk/plug definitions
    if (item.sockets && item.sockets.socketEntries) {
        const plugHashes = new Set();
        item.sockets.socketEntries.forEach(entry => {
            if (entry.singleInitialItemHash !== 0) {
                plugHashes.add(entry.singleInitialItemHash);
            }
            if (entry.reusablePlugItems) {
                entry.reusablePlugItems.forEach(plug => plugHashes.add(plug.plugItemHash));
            }
        });
        
        // --- DEBUG START ---
        console.log('--- 2. COLLECTED PLUG HASHES ---');
        console.log(Array.from(plugHashes));
        // --- DEBUG END ---

        if (plugHashes.size > 0) {
            const plugDefs = await new Promise((resolve, reject) => {
                const placeholders = Array.from(plugHashes).map(() => '?').join(',');
                const query = `SELECT json FROM DestinyInventoryItemDefinition WHERE id IN (${placeholders})`;
                const plugIds = Array.from(plugHashes).map(h => new Int32Array([h])[0]);
                db.all(query, plugIds, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows.map(r => JSON.parse(r.json)));
                });
            });
            
            // --- DEBUG START ---
            console.log('--- 3. RAW PLUG DEFINITIONS FETCHED ---');
            console.log(plugDefs.map(p => ({ name: p.displayProperties.name, itemType: p.itemTypeDisplayName })));
            // --- DEBUG END ---

            const perkTypeNames = ['特性', '内在効果', 'オリジン特性', 'フレーム'];
            item.perks = plugDefs.filter(def => perkTypeNames.includes(def.itemTypeDisplayName));

            // --- DEBUG START ---
            console.log('--- 4. FINAL FILTERED PERKS ---');
            console.log(item.perks.map(p => ({ name: p.displayProperties.name, itemType: p.itemTypeDisplayName })));
            // --- DEBUG END ---
        }
    }

    return item;
}

module.exports = { initialize, searchItems, getItemByHash };
