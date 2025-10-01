import React, { useState } from 'react';
import './App.css';
import axios from 'axios';

function App() {
    const [bungieName, setBungieName] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [message, setMessage] = useState('Enter a Bungie Name to search.');
    const [isLoading, setIsLoading] = useState(false);

    const handleSearch = async () => {
        if (!bungieName.includes('#')) {
            setMessage('Please enter a valid Bungie Name in the format: name#code');
            setSearchResults([]);
            return;
        }

        const [displayName, displayNameCode] = bungieName.split('#');
        setIsLoading(true);
        setMessage('Searching...');
        setSearchResults([]);

        try {
            const response = await axios.post('/api/search', {
                displayName,
                displayNameCode,
            });

            if (response.data.Response && response.data.Response.length > 0) {
                setSearchResults(response.data.Response);
                setMessage('');
            } else {
                setMessage('No users found with that name.');
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            const errorMessage = error.response?.data?.Message || 'An error occurred while searching.';
            setMessage(`Error: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const getMembershipTypeName = (type) => {
        const types = {
            1: 'Xbox', 2: 'PlayStation', 3: 'Steam', 4: 'Blizzard',
            5: 'Stadia', 10: 'Demon', 254: 'BungieNext'
        };
        return types[type] || 'Unknown';
    };

    return (
        <div className="App">
            <h1>Bungie User Search</h1>
            <div className="search-container">
                <input
                    type="text"
                    id="bungieNameInput"
                    placeholder="Enter Bungie Name (e.g., user#1234)"
                    value={bungieName}
                    onChange={(e) => setBungieName(e.target.value)}
                    disabled={isLoading}
                />
                <button id="searchButton" onClick={handleSearch} disabled={isLoading}>
                    {isLoading ? 'Searching...' : 'Search'}
                </button>
            </div>

            <div className="results-container">
                {message && <p className="message-container">{message}</p>}
                {searchResults.map(user => (
                    <div key={user.membershipId} className="user-card">
                        <p><strong>Bungie Name:</strong> {user.bungieGlobalDisplayName}#{user.bungieGlobalDisplayNameCode}</p>
                        <p><strong>Membership ID:</strong> {user.membershipId}</p>
                        {user.isPublic && user.membershipType ? (
                            <p><strong>Platform:</strong> {getMembershipTypeName(user.membershipType)}</p>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default App;