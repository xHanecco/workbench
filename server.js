require('dotenv').config();
const express = require('express');
const cors = require('cors');
const manifestService = require('./manifest-service');

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Route for Weapon Search (using local manifest)
app.get('/api/search/:searchTerm', async (req, res) => {
    const { searchTerm } = req.params;

    if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required.' });
    }

    try {
        const results = await manifestService.searchItems(searchTerm);
        // The frontend expects the results in a specific structure, 
        // let's wrap our results to match it.
        res.json({ 
            Response: {
                results: {
                    results: results
                }
            }
        });
    } catch (error) {
        console.error('Search Error:', error);
        res.status(500).json({ error: 'An error occurred while searching the manifest.' });
    }
});

// API Route for a single item's details
app.get('/api/item/:hash', async (req, res) => {
    const { hash } = req.params;

    if (!hash) {
        return res.status(400).json({ error: 'Item hash is required.' });
    }

    try {
        const item = await manifestService.getItemByHash(hash);
        if (item) {
            res.json(item);
        } else {
            res.status(404).json({ error: 'Item not found.' });
        }
    } catch (error) {
        console.error('Get Item Error:', error);
        res.status(500).json({ error: 'An error occurred while fetching the item.' });
    }
});

// Initialize the manifest service and then start the server
(async () => {
    await manifestService.initialize();
    app.listen(port, () => {
        console.log(`Backend server listening on http://localhost:${port}`);
    });
})();