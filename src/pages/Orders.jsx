import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { LogOut, Package, Loader2, ArrowLeft, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function Orders() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const userData = sessionStorage.getItem('user');
    if (!userData) {
      navigate('/');
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    fetchOrders(parsedUser.token);
  }, [navigate]);

  const fetchOrders = async (token) => {
    try {
      const res = await api.getMyOrders(token);
      setOrders(res.data || []);
    } catch (err) {
      setError('無法載入訂單紀錄，請確認 API URL 設定正確，或試算表有 order 工作表。');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    navigate('/');
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case '已完成': return <CheckCircle size={16} color="var(--success-color)" />;
      case '待處理': return <Clock size={16} color="var(--primary-color)" />;
      case '已取消': return <AlertCircle size={16} color="var(--danger-color)" />;
      default: return <Package size={16} color="var(--text-secondary)" />;
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin text-primary" size={48} color="var(--primary-color)" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '2rem 1rem' }}>
      {/* 導覽列 */}
      <nav className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package color="var(--primary-color)" />
          <h2 style={{ color: 'var(--primary-color)', margin: 0 }}>我的訂單紀錄</h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link to="/shop" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <ArrowLeft size={18} />
            回商品大廳
          </Link>
          <button onClick={handleLogout} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-color)', borderColor: 'rgba(248, 81, 73, 0.3)' }}>
            <LogOut size={16} />
            登出
          </button>
        </div>
      </nav>

      <div className="glass-panel">
        {error ? (
          <div style={{ textAlign: 'center', color: 'var(--danger-color)', padding: '2rem' }}>
            <p>{error}</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem' }}>
            <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
            <h3>目前尚無訂單紀錄</h3>
            <p style={{ marginTop: '1rem' }}>去商城逛逛並下單吧！</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  <th style={{ padding: '1rem' }}>下單日期</th>
                  <th style={{ padding: '1rem' }}>商品名稱</th>
                  <th style={{ padding: '1rem' }}>數量</th>
                  <th style={{ padding: '1rem' }}>出貨準備天數</th>
                  <th style={{ padding: '1rem' }}>總計金額</th>
                  <th style={{ padding: '1rem' }}>狀態</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.95rem' }}>
                    <td style={{ padding: '1rem' }}>{new Date(order.Timestamp).toLocaleString()}</td>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>{order.ProductID}</td>
                    <td style={{ padding: '1rem' }}>{order.Quantity}</td>
                    <td style={{ padding: '1rem' }}>{order.ShippingDays} 天</td>
                    <td style={{ padding: '1rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>${order.TotalAmount}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {getStatusIcon(order.Status)}
                        {order.Status}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
