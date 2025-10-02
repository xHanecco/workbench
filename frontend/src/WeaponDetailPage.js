import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Row, Col, Card, ProgressBar } from 'react-bootstrap';

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

    const { displayProperties, itemTypeDisplayName, flavorText, stats, perks, randomPerkColumns } = item;

    // Define the desired order and priority for stats.
    // Note: "弾薬生成" (Ammo Generation) is interpreted as Inventory Size.
    const statPriority = {
        4043523819: 1, // Impact
        3614673599: 1, // Blast Radius
        1240592695: 2, // Range
        2523465841: 2, // Velocity
        155624089:  3, // Stability
        943549884:  4, // Handling
        4188031367: 5, // Reload Speed
        1345609583: 6, // Aim Assistance
        1931675084: 7, // Inventory Size
        3555269338: 8, // Zoom
        2714457168: 9, // Airborne Effectiveness
        2715839340: 10, // Recoil Direction
        4284893193: 11, // Rounds Per Minute
        3871231066: 12  // Magazine
    };

    const filteredStats = stats && stats.stats ?
        Object.values(stats.stats).filter(stat => 
            stat.statHash !== 1480404414 &&    // Exclude Power
            stat.statHash !== 2961396640       // Exclude Charge Time
        )
        : [];

    // Sort the stats based on the defined priority
    filteredStats.sort((a, b) => {
        const priorityA = statPriority[a.statHash] || 999; // Assign a low priority if not in the map
        const priorityB = statPriority[b.statHash] || 999;
        return priorityA - priorityB;
    });

    return (
        <Container fluid className="detail-page">
            <Row>
                <Col md={12}>
                    <Card className="weapon-card">
                        <Card.Header>
                            <img src={`${BUNGIE_URL_ROOT}${displayProperties.icon}`} alt={displayProperties.name} className="detail-icon" />
                            <div className="detail-title">
                                <h1>{displayProperties.name}</h1>
                                <p>{itemTypeDisplayName}</p>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <Card.Text><em>{flavorText}</em></Card.Text>
                            {perks && perks.length > 0 && (
                                <div className="perks-container">
                                    <h2>パーク</h2>
                                    <Row>
                                        {perks.map(perk => (
                                            <Col key={perk.hash} md={6} className="perk-item">
                                                <img src={`${BUNGIE_URL_ROOT}${perk.displayProperties.icon}`} alt="" className="perk-icon" />
                                                <div className="perk-info">
                                                    <p className="perk-name">{perk.displayProperties.name}</p>
                                                    <p className="perk-description">{perk.displayProperties.description}</p>
                                                </div>
                                            </Col>
                                        ))}
                                    </Row>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {randomPerkColumns && randomPerkColumns.length > 0 && (
                <Row>
                    <Col md={12}>
                        <Card className="random-perks-card">
                            <Card.Header><h2>ランダムパーク</h2></Card.Header>
                            <Card.Body className="random-perks-body">
                                {randomPerkColumns.map((column, colIndex) => (
                                    <div key={colIndex} className="perk-column">
                                        {column.map(perk => (
                                            <img 
                                                key={perk.hash}
                                                src={`${BUNGIE_URL_ROOT}${perk.displayProperties.icon}`} 
                                                alt={perk.displayProperties.name}
                                                title={perk.displayProperties.name} // Simple tooltip on hover
                                                className="random-perk-icon"
                                            />
                                        ))}
                                    </div>
                                ))}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

            <Row>
                <Col md={6}>
                    <Card className="stats-card">
                        <Card.Header><h2>ステータス</h2></Card.Header>
                        <Card.Body>
                            {filteredStats.length > 0 ? (
                                <div className="stats-list">
                                    {filteredStats.map(stat => {
                                        // Stats that should not have a progress bar
                                        const noProgressBarStats = [
                                            2715839340, // Recoil Direction
                                            4284893193  // Rounds Per Minute
                                        ];

                                        return (
                                            <div key={stat.statHash} className="stat-item">
                                                <span className="stat-name">{stat.displayProperties.name}</span>
                                                {!noProgressBarStats.includes(stat.statHash) ? (
                                                    <ProgressBar now={stat.value} variant="info" className="stat-progress-bar" />
                                                ) : null}
                                                <span className="stat-value">{stat.value}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p>ステータスがありません。</p>}
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="barrels-card">
                        <Card.Header><h2>バレル</h2></Card.Header>
                        <Card.Body>
                            <p>（バレル情報がAPIから取得できないため、ここはプレースホルダーです）</p>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default WeaponDetailPage;
