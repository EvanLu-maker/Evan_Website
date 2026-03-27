import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Package, Loader2, CheckCircle, XCircle, Clock, Save, RefreshCw, Trash2, Users, ShieldAlert, Plus } from 'lucide-react';

export default function Admin() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'products', 'customers'
  const [error, setError] = useState('');
  
  const [adminToken, setAdminToken] = useState('ADMIN');
  
  // 新增管理功能狀態
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [resultPassword, setResultPassword] = useState('');
  
  const [newCustomer, setNewCustomer] = useState({ account: '', companyName: '', allowedProducts: [] });
  const [newProduct, setNewProduct] = useState({ name: '', minQty: 0, maxQty: 0, unit: '包', leadTime: 1 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 新增搜尋、過濾與排序狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'TargetShipDate', direction: 'asc' });

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user) {
      navigate('/');
      return;
    }
    
    if (!user.isAdmin) {
      setError('此帳號不具備管理員權限，請聯絡系統管理員。');
      setLoading(false);
      return;
    }

    setAdminToken(user.token);
    fetchData(user.token);
  }, []);

  const fetchData = async (token) => {
    setLoading(true);
    setError('');
    try {
      const orderRes = await api.getMyOrders(token); 
      const productRes = await api.getProducts(token);
      
      if (orderRes.status === 'error' || productRes.status === 'error') {
          throw new Error(orderRes.message || productRes.message || '加載失敗');
      }

      setOrders(orderRes.data || []);
      setProducts(productRes.data || []);
      
      const custRes = await api.getCustomers(token).catch(e => ({data: []}));
      const logsRes = await api.getLoginLogs(token).catch(e => ({data: []}));
      setCustomers(custRes.data || []);
      setLoginLogs(logsRes.data || []);

    } catch (err) {
      console.error(err);
      setError(err.message || '加載失敗，請確保權限或試算表狀態正確。');
    } finally {
      setLoading(false);
    }
  };

  // 取得客戶顯示名稱
  const getCustomerName = (token) => {
    const c = customers.find(item => String(item.Token) === String(token));
    if (!c) return token;
    return c.公司名稱 || c.店名 || c.Account || token;
  };

  // 處理排序點擊
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 訂單過濾與排序邏輯
  const filteredAndSortedOrders = React.useMemo(() => {
    let result = [...orders];

    // 1. 搜尋
    if (searchTerm) {
      result = result.filter(o => {
        const cName = getCustomerName(o.CustomerToken).toLowerCase();
        const pName = String(o.ProductID).toLowerCase();
        return cName.includes(searchTerm.toLowerCase()) || pName.includes(searchTerm.toLowerCase());
      });
    }

    // 2. 狀態篩選
    if (showOnlyPending) {
      result = result.filter(o => o.Status === '待處理');
    }

    // 3. 排序
    result.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // 日期處理
      if (sortConfig.key === 'TargetShipDate' || sortConfig.key === 'Timestamp') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [orders, customers, searchTerm, showOnlyPending, sortConfig]);

  const updateOrderStatus = async (rowIdx, newStatus) => {
    alert('此動作將會更新試算表中的狀態為 ' + newStatus);
    setOrders(prev => prev.map((o, i) => i === rowIdx ? { ...o, Status: newStatus } : o));
  };

  const handleToggleBlock = async (account, isBlockedString) => {
      const currentlyBlocked = (isBlockedString == "1" || isBlockedString === true || isBlockedString === "TRUE");
      const confirmMsg = currentlyBlocked ? `確定要解除 ${account} 的封鎖嗎？` : `確定要封鎖 ${account} 嗎？`;
      if (!window.confirm(confirmMsg)) return;

      try {
          const res = await api.toggleUserBlock(adminToken, account, !currentlyBlocked);
          alert(res.message);
          
          // Re-fetch to update state
          const custRes = await api.getCustomers(adminToken);
          setCustomers(custRes.data || []);
      } catch (err) {
          alert('操作失敗：' + err.message);
      }
  };

  // --- 新增管理功能邏輯 ---

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.account || !newCustomer.companyName) return alert('請填寫帳號與店名');
    
    setIsSubmitting(true);
    try {
      const customerData = {
        ...newCustomer,
        allowedProducts: newCustomer.allowedProducts.join(',')
      };
      const res = await api.addCustomer(adminToken, customerData);
      setResultPassword(res.password);
      alert('客戶建立成功！');
      fetchData(adminToken); 
      setNewCustomer({ account: '', companyName: '', allowedProducts: [] });
    } catch (err) {
      alert('建立失敗：' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name) return alert('請填寫品名');
    
    setIsSubmitting(true);
    try {
      await api.addProduct(adminToken, newProduct);
      alert('商品上架成功！');
      fetchData(adminToken);
      setShowProductModal(false);
      setNewProduct({ name: '', minQty: 0, maxQty: 0, unit: '包', leadTime: 1 });
    } catch (err) {
      alert('建立失敗：' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProductSelection = (pName) => {
    setNewCustomer(prev => {
      const current = prev.allowedProducts;
      if (current.includes(pName)) {
        return { ...prev, allowedProducts: current.filter(x => x !== pName) };
      } else {
        return { ...prev, allowedProducts: [...current, pName] };
      }
    });
  };

  if (loading) return <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center'}}><Loader2 className="animate-spin" size={48} /></div>;

  return (
    <div className="animate-fade-in" style={{ padding: '2rem' }}>
      <nav className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderLeft: '4px solid var(--danger-color)', flexWrap: 'wrap', gap: '1rem' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>管理員後台戰情室</h2>
         </div>
         <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => setActiveTab('orders')} className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-outline'}`}>訂單追蹤</button>
            <button onClick={() => setActiveTab('products')} className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-outline'}`}>庫存與商品</button>
            <button onClick={() => setActiveTab('customers')} className={`btn ${activeTab === 'customers' ? 'btn-primary' : 'btn-outline'}`}>資安與客戶管理</button>
            <button onClick={() => navigate('/shop')} className="btn btn-outline" style={{ marginLeft: 'auto' }}>回前台</button>
         </div>
      </nav>

      {activeTab === 'orders' && (
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0 }}>📦 全平台訂單監控</h3>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
               <input 
                 type="text" 
                 placeholder="搜尋店名或商品..." 
                 className="form-input" 
                 style={{ width: '250px', margin: 0 }}
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
               <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                 <input type="checkbox" checked={showOnlyPending} onChange={e => setShowOnlyPending(e.target.checked)} />
                 僅看待處理
               </label>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => requestSort('Timestamp')}>日期 {sortConfig.key === 'Timestamp' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th style={{ padding: '1rem' }}>客戶</th>
                  <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => requestSort('ProductID')}>商品 {sortConfig.key === 'ProductID' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th style={{ padding: '1rem' }}>數量</th>
                  <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => requestSort('TargetShipDate')}>預定出貨日 {sortConfig.key === 'TargetShipDate' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th style={{ padding: '1rem' }}>狀態</th>
                  <th style={{ padding: '1rem' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedOrders.map((order, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem' }}>{new Date(order.Timestamp).toLocaleDateString()}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '500', color: 'var(--primary-color)' }}>{getCustomerName(order.CustomerToken)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{order.CustomerToken}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>{order.ProductID}</td>
                    <td style={{ padding: '1rem' }}>{order.Quantity} {order.Unit || ''}</td>
                    <td style={{ padding: '1rem' }}>{order.TargetShipDate ? new Date(order.TargetShipDate).toLocaleDateString() : '未指定'}</td>
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
                {filteredAndSortedOrders.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>無相符的訂單資料</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>🛠️ 商品資料管理</h3>
            <button onClick={() => setShowProductModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} /> 新增商品
            </button>
          </div>
          
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>商品詳細資料（包含起訂量、最高量）可直接在此查看。</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
             {products.map((p, idx) => (
               <div key={idx} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(0,0,0,0.1)' }}>
                  <div className="form-group">
                    <label className="form-label">品名</label>
                    <input type="text" className="form-input" defaultValue={p.Name || p.品名 || p.商品名稱 || p.Product || p.Item || Object.values(p).find(v => typeof v === 'string' && isNaN(Number(v)))} disabled style={{ opacity: 0.7 }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">備貨天數</label>
                      <input type="number" className="form-input" defaultValue={p.LeadTime || p.提前天數 || p.準備天數 || p.出貨天數 || 1} disabled style={{ opacity: 0.7 }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">最小訂購量</label>
                      <input type="number" className="form-input" defaultValue={p.MinQty || p.起訂量 || p.最小訂購量 || p.最小量 || 0} disabled style={{ opacity: 0.7 }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">最大訂購量</label>
                      <input type="number" className="form-input" defaultValue={p.MaxQty || p.最大量 || p.最大訂購量 || 0} disabled style={{ opacity: 0.7 }} />
                    </div>
                  </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users color="var(--primary-color)" />
                        <h3 style={{ margin: 0 }}>客戶狀態與解鎖</h3>
                    </div>
                    <button onClick={() => { setShowCustomerModal(true); setResultPassword(''); }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Plus size={18} /> 新增客戶
                    </button>
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '1rem' }}>帳號</th>
                      <th style={{ padding: '1rem' }}>狀態</th>
                      <th style={{ padding: '1rem' }}>失敗次數</th>
                      <th style={{ padding: '1rem' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers
                      .filter(cust => cust.Account || cust.公司名稱 || cust.店名)
                      .map((cust, idx) => {
                        const isBlocked = cust.IsBlocked == "1" || cust.IsBlocked === true || cust.IsBlocked === "TRUE";
                        return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                            <div>{cust.Account || '未知帳號'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>{cust.公司名稱 || cust.店名 || ''}</div>
                          </td>
                          <td style={{ padding: '1rem' }}>
                             {isBlocked ? (
                                 <span style={{ color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldAlert size={14} /> 已封鎖</span>
                             ) : (
                                 <span style={{ color: 'var(--success-color)' }}>正常</span>
                             )}
                          </td>
                          <td style={{ padding: '1rem' }}>{cust.FailedAttempts || 0}</td>
                          <td style={{ padding: '1rem' }}>
                             <button 
                                onClick={() => handleToggleBlock(cust.Account, cust.IsBlocked)}
                                className={`btn ${isBlocked ? 'btn-primary' : 'btn-outline'}`}
                                style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', borderColor: isBlocked ? '' : 'var(--danger-color)', color: isBlocked ? '' : 'var(--danger-color)' }}
                             >
                                {isBlocked ? '🔓 解除封鎖' : '⛔ 手動封鎖'}
                             </button>
                          </td>
                        </tr>
                      )})}
                  </tbody>
                </table>
            </div>

            <div className="glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <ShieldAlert color="var(--danger-color)" />
                    <h3 style={{ margin: 0 }}>近期登入監視器</h3>
                </div>
                
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    {loginLogs.length === 0 ? (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>目前無任何登入日誌</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {loginLogs.map((log, idx) => (
                                <div key={idx} style={{ padding: '0.8rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', borderLeft: `3px solid ${log.Status === '成功' ? 'var(--success-color)' : 'var(--danger-color)'}`}}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <strong style={{ fontSize: '0.9rem' }}>{log.Account}</strong>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(log.Timestamp).toLocaleString()}</span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: log.Status === '成功' ? 'var(--success-color)' : 'var(--danger-color)' }}>
                                        {log.Status === '封鎖' ? '🚨 ' : ''}{log.Message}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* --- 新增客戶彈窗 --- */}
      {showCustomerModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '2rem' }}>
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>➕ 建立新客戶帳號</h3>
            
            {resultPassword ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <CheckCircle size={48} color="var(--success-color)" style={{ marginBottom: '1rem' }} />
                <h4 style={{ marginBottom: '0.5rem' }}>帳號建立成功！</h4>
                <p style={{ color: 'var(--text-secondary)' }}>請記下客戶的初始密碼：</p>
                <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)', margin: '1.5rem 0', letterSpacing: '2px' }}>
                  {resultPassword}
                </div>
                <button onClick={() => setShowCustomerModal(false)} className="btn btn-primary" style={{ width: '100%' }}>完成並關閉</button>
              </div>
            ) : (
              <form onSubmit={handleAddCustomer}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">登入帳號</label>
                    <input type="text" className="form-input" required value={newCustomer.account} onChange={e => setNewCustomer({...newCustomer, account: e.target.value})} placeholder="例如: evan_shop" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">店名 / 公司名稱</label>
                    <input type="text" className="form-input" required value={newCustomer.companyName} onChange={e => setNewCustomer({...newCustomer, companyName: e.target.value})} placeholder="例如: 宜芳石化" />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">授權可購商品 (勾選清單)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                    {products.map(p => {
                      const pName = p.Name || p.品名 || p.商品名稱;
                      return (
                        <label key={pName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                           <input type="checkbox" checked={newCustomer.allowedProducts.includes(pName)} onChange={() => toggleProductSelection(pName)} />
                           {pName}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <button type="button" onClick={() => setShowCustomerModal(false)} className="btn btn-outline" style={{ flex: 1 }}>取消</button>
                  <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 2 }}>
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : '確認建立帳號 (自動生成密碼)'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- 新增商品彈窗 --- */}
      {showProductModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '2rem' }}>
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '500px', width: '100%' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>🏗️ 上架新商品</h3>
            
            <form onSubmit={handleAddProduct}>
              <div className="form-group">
                <label className="form-label">商品品名</label>
                <input type="text" className="form-input" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="例如: 漂白水-30KG/桶" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">單位</label>
                  <input type="text" className="form-input" value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} placeholder="桶 / 包 / 支" />
                </div>
                <div className="form-group">
                  <label className="form-label">備貨天數 (LeadTime)</label>
                  <input type="number" className="form-input" value={newProduct.leadTime} onChange={e => setNewProduct({...newProduct, leadTime: parseInt(e.target.value) || 1})} min="1" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">起訂量 (MinQty)</label>
                  <input type="number" className="form-input" value={newProduct.minQty} onChange={e => setNewProduct({...newProduct, minQty: parseInt(e.target.value) || 0})} min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">最大訂購量 (MaxQty)</label>
                  <input type="number" className="form-input" value={newProduct.maxQty} onChange={e => setNewProduct({...newProduct, maxQty: parseInt(e.target.value) || 0})} min="0" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setShowProductModal(false)} className="btn btn-outline" style={{ flex: 1 }}>取消</button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 2 }}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : '確認上架商品'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
