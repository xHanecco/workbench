import React from 'react';
import { Routes, Route } from 'react-router-dom';
import WeaponExplorerPage from './WeaponExplorerPage';
import WeaponDetailPage from './WeaponDetailPage';
import './App.css';

// A simple component to show a placeholder in the right panel
function SelectWeaponPrompt() {
    return <div className="detail-placeholder">リストから武器を選択すると詳細が表示されます。</div>;
}

function App() {
    return (
        <Routes>
            <Route path="/" element={<WeaponExplorerPage />}>
                {/* This is the initial view for the right panel */}
                <Route index element={<SelectWeaponPrompt />} /> 
                {/* This view is shown when a weapon is selected */}
                <Route path="weapon/:hash" element={<WeaponDetailPage />} />
            </Route>
        </Routes>
    );
}

export default App;
