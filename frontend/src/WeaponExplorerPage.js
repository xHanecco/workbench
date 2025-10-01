import React from 'react';
import { Outlet } from 'react-router-dom';
import WeaponSearchList from './WeaponSearchList';
import './App.css';

function WeaponExplorerPage() {
    return (
        <div className="explorer-container">
            <div className="explorer-left-panel">
                <WeaponSearchList />
            </div>
            <div className="explorer-right-panel">
                <Outlet /> 
            </div>
        </div>
    );
}

export default WeaponExplorerPage;
