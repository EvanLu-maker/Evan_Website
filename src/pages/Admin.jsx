import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Package, Loader2, CheckCircle, XCircle, Clock, Save, RefreshCw, Trash2 } from 'lucide-react';

export default function Admin() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'products'
  const [error, setError] = useState('');

  useEffect(() => {
    // 簡單的安全檢查 (正式環境應檢查 Token)
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user) {
      navigate('/');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 在 Admin 模式下，我們一樣呼叫 API 抓資料
      // 注意：這部分的 Google Apps Script 功能需與 Code.gs 同步
      const orderRes = await api.getMyOrders('ALL'); // 假設傳 ALL 代表抓全部
      const productRes = await api.getProducts('ADMIN');
      setOrders(orderRes.data || []);
      setProducts(productRes.data || []);
    } catch (err) {
      setError('加載失敗，請確保試算表資料夾權限正確。');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (rowIdx, newStatus) => {
    // 這裡應呼叫 API 更新試算表
    alert('此動作將會更新試算表中的狀態為 ' + newStatus);
    // 模擬更新 UI
    setOrders(prev => prev.map((o, i) => i === rowIdx ? { ...o, Status: newStatus } : o));
  };

  if (loading) return <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center'}}><Loader2 className="animate-spin" size={48} /></div>;

  return (
    <div className="animate-fade-in" style={{ padding: '2rem' }}>
      <nav className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderLeft: '4px solid var(--danger-color)' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>管理員後台系統</h2>
         </div>
         <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setActiveTab('orders')} className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-outline'}`}>訂單管理</button>
            <button onClick={() => setActiveTab('products')} className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-outline'}`}>商品庫存</button>
            <button onClick={() => navigate('/shop')} className="btn btn-outline">回前台</button>
         </div>
      </nav>

      {activeTab === 'orders' ? (
        <div className="glass-panel">
          <h3>📦 全平台訂單監控</h3>
          <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>日期</th>
                  <th style={{ padding: '1rem' }}>客戶</th>
                  <th style={{ padding: '1rem' }}>商品</th>
                  <th style={{ padding: '1rem' }}>數量</th>
                  <th style={{ padding: '1rem' }}>備貨天數</th>
                  <th style={{ padding: '1rem' }}>狀態</th>
                  <th style={{ padding: '1rem' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem' }}>{new Date(order.Timestamp).toLocaleDateString()}</td>
                    <td style={{ padding: '1rem' }}>{order.CustomerToken}</td>
                    <td style={{ padding: '1rem' }}>{order.ProductID}</td>
                    <td style={{ padding: '1rem' }}>{order.Quantity}</td>
                    <td style={{ padding: '1rem' }}>{order.ShippingDays}天</td>
                    <td style={{ padding: '1rem' }}>
                       <span style={{ 
                         padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem',
                         background: order.Status === '待處理' ? 'rgba(88,166,255,0.2)' : 'rgba(46,160,67,0.2)'
                       }}>
                         {order.Status}
                       </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                       <div style={{ display: 'flex', gap: '0.5rem' }}>
                         <button title="核准" onClick={() => updateOrderStatus(idx, '已核准')} style={{ background: 'transparent', border: 'none', color: 'var(--success-color)', cursor: 'pointer' }}><CheckCircle size={18} /></button>
                         <button title="取消" onClick={() => updateOrderStatus(idx, '已取消')} style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}><XCircle size={18} /></button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-panel">
          <h3>🛠️ 商品資料管理</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
             {products.map((p, idx) => (
               <div key={idx} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(0,0,0,0.1)' }}>
                  <div className="form-group">
                    <label className="form-label">品名</label>
                    <input type="text" className="form-input" defaultValue={p.Name || p.品名} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">價格</label>
                      <input type="number" className="form-input" defaultValue={p.Price || p.價格} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">準備天數</label>
                      <input type="number" className="form-input" defaultValue={p.LeadTime || 3} />
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%', gap: '8px' }}>
                    <Save size={16} /> 更新資料
                  </button>
               </div>
             ))}
             <div style={{ border: '2px dashed var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', cursor: 'pointer' }}>
                <Plus size={32} color="var(--text-secondary)" />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Plus = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
