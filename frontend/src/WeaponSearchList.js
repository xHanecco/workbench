import React, { useState } from 'react';
import { NavLink } from 'react-router-dom'; // Use NavLink for active styling
import axios from 'axios';

const BUNGIE_URL_ROOT = 'https://www.bungie.net';

function WeaponSearchList() {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [message, setMessage] = useState('武器名を入力して検索してください。');
    const [isLoading, setIsLoading] = useState(false);

    const handleSearch = async () => {
        if (!searchTerm) {
            setMessage('武器名を入力してください。');
            setSearchResults([]);
            return;
        }

        setIsLoading(true);
        setMessage('検索中...');
        setSearchResults([]);

        try {
            const response = await axios.get(`/api/search/${searchTerm}`);
            const results = response.data?.Response?.results?.results;

            if (results && results.length > 0) {
                setSearchResults(results);
                setMessage('');
            } else {
                setMessage('その名前の武器は見つかりませんでした。');
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            const errorMessage = error.response?.data?.error || '検索中にエラーが発生しました。';
            setMessage(`エラー: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="search-list-container">
            <h2>武器検索</h2>
            <div className="search-container">
                <input
                    type="text"
                    id="weaponNameInput"
                    placeholder="例: ギャラルホルン"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    disabled={isLoading}
                />
                <button id="searchButton" onClick={handleSearch} disabled={isLoading}>
                    {isLoading ? '...' : '検索'}
                </button>
            </div>

            <div className="results-container">
                {isLoading && <p className="message-container">検索中...</p>}
                {!isLoading && message && <p className="message-container">{message}</p>}
                {searchResults.map(item => (
                    <NavLink 
                        to={`/weapon/${item.hash}`} 
                        key={item.hash} 
                        className={({ isActive }) => isActive ? "item-card-link active" : "item-card-link"}
                    >
                        <div className="item-card">
                            <img 
                                src={`${BUNGIE_URL_ROOT}${item.displayProperties.icon}`}
                                alt={item.displayProperties.name} 
                                className="item-icon"
                            />
                            <div className="item-info">
                                <p className="item-name">{item.displayProperties.name}</p>
                                <p className="item-type">{item.itemTypeDisplayName}</p>
                            </div>
                        </div>
                    </NavLink>
                ))}
            </div>
        </div>
    );
}

export default WeaponSearchList;
