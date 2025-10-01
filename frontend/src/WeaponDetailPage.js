import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const BUNGIE_URL_ROOT = 'https://www.bungie.net';

function WeaponDetailPage() {
    const { hash } = useParams();
    const [item, setItem] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchItemDetails = async () => {
            setIsLoading(true);
            setItem(null);
            setError(null);
            try {
                const response = await axios.get(`/api/item/${hash}`);
                setItem(response.data);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch item details.');
            } finally {
                setIsLoading(false);
            }
        };

        if (hash) {
            fetchItemDetails();
        }
    }, [hash]);

    if (isLoading) {
        return <div className="detail-placeholder">武器詳細を読み込み中...</div>;
    }

    if (error) {
        return <div className="detail-placeholder">エラー: {error}</div>;
    }

    if (!item) {
        return <div className="detail-placeholder">リストから武器を選択すると詳細が表示されます。</div>;
    }

    const { displayProperties, itemTypeDisplayName, flavorText, stats, perks } = item;

    // Filter out the "Attack" stat, as its bar is meaningless
    const filteredStats = stats && stats.stats ? 
        Object.values(stats.stats).filter(stat => stat.statHash !== 1480404414) 
        : [];

    return (
        <div className="detail-page">
            <div className="detail-header">
                <img src={`${BUNGIE_URL_ROOT}${displayProperties.icon}`} alt={displayProperties.name} className="detail-icon" />
                <div className="detail-title">
                    <h1>{displayProperties.name}</h1>
                    <p>{itemTypeDisplayName}</p>
                </div>
            </div>
            <div className="detail-flavor-text">
                <p><em>{flavorText}</em></p>
            </div>

            {perks && perks.length > 0 && (
                <div className="perks-container">
                    <h2>パーク</h2>
                    <ul>
                        {perks.map(perk => (
                            <li key={perk.hash} className="perk-item">
                                <img src={`${BUNGIE_URL_ROOT}${perk.displayProperties.icon}`} alt="" className="perk-icon" />
                                <div className="perk-info">
                                    <p className="perk-name">{perk.displayProperties.name}</p>
                                    <p className="perk-description">{perk.displayProperties.description}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {filteredStats.length > 0 && (
                 <div className="stats-container">
                    <h2>ステータス</h2>
                    <ul>
                        {filteredStats.map(stat => (
                            <li key={stat.statHash}>
                                <div className="stat-info">
                                    <span>{stat.displayProperties.name}</span>
                                    <span className="stat-value">{stat.value}</span>
                                </div>
                                <div className="stat-bar-container">
                                    <div className="stat-bar" style={{ width: `${stat.value}%` }}></div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default WeaponDetailPage;
