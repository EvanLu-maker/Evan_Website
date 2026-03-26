import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Shop from './pages/Shop';
import Orders from './pages/Orders';
import Admin from './pages/Admin';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Routes>
        {/* 客戶前台路由 */}
        <Route path="/" element={<Login />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/orders" element={<Orders />} />
        
        {/* 管理員後台路由 */}
        <Route path="/admin" element={<Admin />} />
        
        {/* 萬用路由捕捉，導回首頁 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
