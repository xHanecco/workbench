require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3001; // Use a different port than the React dev server

// Middleware
app.use(cors()); // In a real app, you'd restrict the origin
app.use(express.json());

// API Proxy Route
app.post('/api/search', async (req, res) => {
    const { displayName, displayNameCode } = req.body;
    const apiKey = process.env.BUNGIE_API_KEY;

    if (!apiKey || apiKey === 'YOUR_BUNGIE_API_KEY') {
        return res.status(500).json({ error: 'Bungie API key is not configured on the server.' });
    }
    
    if (!displayName || !displayNameCode) {
        return res.status(400).json({ error: 'displayName and displayNameCode are required.' });
    }

    try {
        const bungieResponse = await axios.post(
            'https://www.bungie.net/Platform/Destiny2/SearchDestinyPlayerByBungieName/-1/',
            {
                displayName,
                displayNameCode,
            },
            {
                headers: {
                    'X-API-Key': apiKey,
                },
            }
        );
        res.json(bungieResponse.data);
    } catch (error) {
        console.error('Proxy Error:', error.message);
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'An unexpected error occurred.' });
        }
    }
});

app.listen(port, () => {
    console.log(`Backend server listening on http://localhost:${port}`);
});
