import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { LogOut, Package, Loader2, Plus, Minus, CheckCircle, User, FileText, ShieldAlert } from 'lucide-react';

export default function Shop() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 訂購單列: { id (unique), productId, qty, shipDate }
  const [rows, setRows] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  useEffect(() => {
    const userData = sessionStorage.getItem('user');
    if (!userData) {
      navigate('/');
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    fetchProducts(parsedUser.token);
  }, [navigate]);

  const fetchProducts = async (token) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getProducts(token);
      setProducts(res.data || []);
      if ((res.data || []).length > 0) {
        // 初始化第一個空列
        setRows([{ id: Date.now(), productId: '', qty: '', shipDate: '' }]);
      }
    } catch (err) {
      setError(err.message || '無法載入商品清單，請確認試算表設定，或白名單中沒有授權商品。');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    navigate('/');
  };

  const getProductInfo = (pid) => {
    if (!pid) return null;
    const p = products.find(x => {
        const xName = x.Name || x.品名 || x.商品名稱 || x.Product || x.Item || Object.values(x).find(v => typeof v === 'string' && isNaN(Number(v)));
        return xName === pid;
    });
    if (!p) return null;
    
    // Normalizing keys
    const name = p.Name || p.品名 || p.商品名稱 || p.Product || p.Item || Object.values(p).find(v => typeof v === 'string' && isNaN(Number(v)));
    const minQty = parseInt(p.最小訂購量 || p.MinQty || p.起訂量 || p.最小量 || 0);
    const maxQty = parseInt(p.最大訂購量 || p.MaxQty || p.最大量 || 0);
    const unit = p.單位 || p.Unit || '';
    
    // 取得備貨天數 (LeadTime)
    const leadTimeRaw = p.出貨時間 || p.LeadTime || p.備貨天數 || p.提前天數 || p.準備天數 || p.出貨天數;
    let leadTime = parseInt(leadTimeRaw, 10);
    if (isNaN(leadTime)) leadTime = 1; // 預設 1 天
    
    // 使用本地時間計算「最快出貨日」
    const now = new Date();
    const earliestDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + leadTime);
    
    // 格式化 YYYY-MM-DD
    const y = earliestDate.getFullYear();
    const m = String(earliestDate.getMonth() + 1).padStart(2, '0');
    const d = String(earliestDate.getDate()).padStart(2, '0');
    const earliestDateStr = `${y}-${m}-${d}`;
    
    return { name, minQty, maxQty, unit, leadTime, earliestDateStr };
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: Date.now(), productId: '', qty: '', shipDate: '' }]);
  };

  const removeRow = (id) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      
      const newRow = { ...r, [field]: value };
      
      // 當選擇商品改變時，自動帶入預設數量與最早出貨日
      if (field === 'productId') {
         const info = getProductInfo(value);
         if (info) {
             newRow.qty = info.minQty > 0 ? info.minQty : 1;
             newRow.shipDate = info.earliestDateStr;
         } else {
             newRow.qty = '';
             newRow.shipDate = '';
         }
      }
      return newRow;
    }));
  };

  const handleCheckout = async () => {
    // 過濾有效資料
    const validRows = rows.filter(r => r.productId && r.qty > 0 && r.shipDate);
    if (validRows.length === 0) {
      alert("請至少選擇一項商品並填妥數量與出貨日！");
      return;
    }

    // 檢查起訂量、最大量、與出貨日
    for (let r of validRows) {
        const info = getProductInfo(r.productId);
        if (!info) continue;
        const q = parseInt(r.qty);
        if (info.minQty > 0 && q < info.minQty) {
            alert(`商品 [${info.name}] 數量低於起訂量 (${info.minQty})`);
            return;
        }
        if (info.maxQty > 0 && q > info.maxQty) {
            alert(`商品 [${info.name}] 數量超過最大限制 (${info.maxQty})`);
            return;
        }
        if (r.shipDate < info.earliestDateStr) {
            alert(`商品 [${info.name}] 無法在 ${r.shipDate} 出貨，最快出貨日為 ${info.earliestDateStr}`);
            return;
        }
    }

    setIsSubmitting(true);
    
    // 依出貨日拆單
    const groupedOrders = {};
    validRows.forEach(row => {
      if (!groupedOrders[row.shipDate]) groupedOrders[row.shipDate] = [];
      const info = getProductInfo(row.productId);
      groupedOrders[row.shipDate].push({
        productName: row.productId,
        qty: parseInt(row.qty),
        unit: info.unit
      });
    });

    const ordersData = Object.keys(groupedOrders).map(shipDate => ({
      shipDate: shipDate,
      items: groupedOrders[shipDate]
    }));

    try {
      await api.submitOrder(user.token, ordersData);
      setOrderSuccess(true);
      setRows([{ id: Date.now(), productId: '', qty: '', shipDate: '' }]); // reset
      setTimeout(() => { setOrderSuccess(false); navigate('/orders'); }, 2000);
    } catch (err) {
      alert("訂單送出失敗：" + err.message);
    } finally {
      setIsSubmitting(false);
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
    <div className="animate-fade-in" style={{ padding: '2rem 1rem', position: 'relative', maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* 導覽列 */}
      <nav className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package color="var(--primary-color)" />
            <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.2rem' }}>採購大廳</h2>
          </div>
          <button onClick={handleLogout} className="btn btn-outline" style={{ width: 'auto', padding: '0.4rem 0.8rem', color: 'var(--danger-color)', borderColor: 'rgba(248, 81, 73, 0.3)' }}>
            <LogOut size={16} /> 登出
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link to="/orders" className="btn btn-outline" style={{ flex: 1, minWidth: '100px', textDecoration: 'none' }}>
            <FileText size={16} /> 訂單
          </Link>
          <Link to="/profile" className="btn btn-outline" style={{ flex: 1, minWidth: '100px', textDecoration: 'none' }}>
            <User size={16} /> 資料
          </Link>
          {user?.isAdmin && (
            <Link to="/admin" className="btn btn-primary" style={{ flex: 1.5, minWidth: '140px', textDecoration: 'none' }}>
              <ShieldAlert size={16} /> 管理後台
            </Link>
          )}
        </div>
      </nav>

      {orderSuccess && (
        <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--success-color)', marginBottom: '2rem' }}>
          <CheckCircle size={48} style={{ margin: '0 auto 1rem' }} />
          <h3>訂單已送出成功！</h3>
          <p>正在為您跳轉至「我的訂單」紀錄...</p>
        </div>
      )}

      {/* 列式下單區塊 */}
      {error ? (
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
          <p style={{ color: 'var(--danger-color)' }}>{error}</p>
          <button onClick={() => fetchProducts(user.token)} className="btn btn-outline" style={{ marginTop: '1rem' }}>
            重新嘗試
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center' }}>
           <h3>目前無授權商品</h3>
        </div>
      ) : (
        <div className="glass-panel">
           <div style={{ marginBottom: '1.5rem' }}>
               <h3 style={{ margin: 0 }}>建立訂購單</h3>
               <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '5px' }}>請逐列新增商品、數量與預定配送日。系統將依據配送日自動幫您分批拆單處理。<br/>每個商品的「最快出貨日」會依據備貨狀況自動顯示。</p>
           </div>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {rows.map((row, index) => {
                 const info = getProductInfo(row.productId);
                 
                 return (
                   <div key={row.id} className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 3fr) 120px minmax(150px, 2fr) 60px', gap: '1rem', alignItems: 'flex-start', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                       
                       {/* 商品選擇 */}
                       <div style={{ width: '100%' }}>
                           <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>商品內容</label>
                           <select 
                               className="form-input" 
                               value={row.productId} 
                               style={{ backgroundColor: '#1a1d24', color: 'var(--text-primary)' }}
                               onChange={(e) => updateRow(row.id, 'productId', e.target.value)}
                           >
                               <option value="">（請選擇商品）</option>
                               {products.map((p, idx) => {
                                   const pName = p.Name || p.品名 || p.商品名稱 || p.Product || p.Item || Object.values(p).find(v => typeof v === 'string' && isNaN(Number(v)));
                                   return <option key={idx} value={pName}>{pName}</option>
                               })}
                           </select>
                           {info && (
                               <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                   {info.minQty > 0 || info.maxQty > 0 ? '限制: ' : ''}
                                   {info.minQty > 0 ? `起訂 ${info.minQty}單位 ` : ''} 
                                   {info.maxQty > 0 ? `/ 最大 ${info.maxQty}` : ''}
                               </div>
                           )}
                       </div>

                       {/* 數量與出貨日 (行動版並排) */}
                       <div className="mobile-grid-2" style={{ display: 'contents' }}>
                          <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>數量 {info && info.unit ? `(${info.unit})` : ''}</label>
                              <input 
                                  type="number" 
                                  className="form-input" 
                                  min={info?.minQty > 0 ? info.minQty : 0}
                                  max={info?.maxQty > 0 ? info.maxQty : undefined}
                                  value={row.qty} 
                                  placeholder="數量"
                                  onChange={(e) => updateRow(row.id, 'qty', e.target.value)}
                              />
                          </div>

                          <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>配送日期</label>
                              <input 
                                  type="date" 
                                  className="form-input" 
                                  min={info?.earliestDateStr || ''}
                                  value={row.shipDate} 
                                  onChange={(e) => updateRow(row.id, 'shipDate', e.target.value)}
                              />
                              {info && (
                                  <div style={{ fontSize: '0.7rem', color: row.shipDate && row.shipDate < info.earliestDateStr ? 'var(--danger-color)' : 'var(--text-secondary)', marginTop: '4px' }}>
                                      最快: {info.earliestDateStr}
                                  </div>
                              )}
                          </div>
                       </div>

                       {/* 移除列按鈕 */}
                       <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
                           <button onClick={() => removeRow(row.id)} title="移除" style={{ background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.2)', color: 'var(--danger-color)', cursor: 'pointer', padding: '10px', borderRadius:'8px', display:'flex', alignItems:'center', gap:'4px' }}>
                               <LogOut size={16} style={{ transform: 'rotate(180deg)' }}/> <span className="mobile-only" style={{ fontSize: '0.85rem' }}>移除</span>
                           </button>
                       </div>
                   </div>
                 );
              })}
           </div>

           <div className="mobile-stack" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
               <button onClick={addRow} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}>
                   <Plus size={16} /> 新增品項
               </button>

               <button 
                  onClick={handleCheckout} 
                  className="btn btn-primary"
                  disabled={isSubmitting || rows.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem' }}
               >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                  確認送出訂單
               </button>
           </div>
        </div>
      )}
    </div>
  );
}
