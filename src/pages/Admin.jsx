import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Package, Loader2, CheckCircle, XCircle, Clock, Save, RefreshCw, Trash2, Users, ShieldAlert, Plus, Edit, Key, Truck } from 'lucide-react';

export default function Admin() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'products', 'customers', 'security'
  const [error, setError] = useState('');
  

  const [adminToken, setAdminToken] = useState('ADMIN');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const itemsPerPage = 10;

  
  // 新增管理功能狀態
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [resultPassword, setResultPassword] = useState('');
  
  const [newCustomer, setNewCustomer] = useState({ account: '', companyName: '', allowedProducts: [] });
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', minQty: 0, maxQty: 0, unit: '包', leadTime: 1 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 新增搜尋、過濾與排序狀態
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => { setCurrentPage(1); setSelectedOrders(new Set()); }, [searchTerm, showOnlyPending]);

  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'TargetShipDate', direction: 'asc' });

  useEffect(() => { 
    setCurrentPage(1); 
    setSelectedOrders(new Set()); 
  }, [searchTerm, showOnlyPending]);
  
  // 客戶清單專用搜尋與排序
  const [searchTermCustomer, setSearchTermCustomer] = useState('');
  const [sortConfigCustomer, setSortConfigCustomer] = useState({ key: 'Account', direction: 'asc' });

  useEffect(() => {
    // 優先讀取本地快取，實現「秒開」
    const cachedOrders = localStorage.getItem('admin_orders');
    const cachedProducts = localStorage.getItem('admin_products');
    const cachedCustomers = localStorage.getItem('admin_customers');
    const cachedLogs = localStorage.getItem('admin_logs');

    if (cachedOrders) setOrders(JSON.parse(cachedOrders));
    if (cachedProducts) setProducts(JSON.parse(cachedProducts));
    if (cachedCustomers) setCustomers(JSON.parse(cachedCustomers));
    if (cachedLogs) setLoginLogs(JSON.parse(cachedLogs));

    // 如果有舊資料，就先關掉全螢幕加載
    if (cachedOrders && cachedProducts) {
      setLoading(false);
    }

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
  }, [navigate]);

  const fetchData = async (token) => {
    if (!token) return;
    setIsSyncing(true);
    setError('');
    try {
      // 策略：優先使用統一介面 (一次載入全部)，減少連線開銷
      try {
        const dashboardData = await api.getAdminDashboardData(token);
        
        // 更新狀態
        setOrders(dashboardData.orders || []);
        setProducts(dashboardData.products || []);
        setCustomers(dashboardData.customers || []);
        setLoginLogs(dashboardData.logs || []);

        // 寫入快取
        localStorage.setItem('admin_orders', JSON.stringify(dashboardData.orders || []));
        localStorage.setItem('admin_products', JSON.stringify(dashboardData.products || []));
        localStorage.setItem('admin_customers', JSON.stringify(dashboardData.customers || []));
        localStorage.setItem('admin_logs', JSON.stringify(dashboardData.logs || []));

        console.log('✅ 統一數據載入完成且已緩存');
      } catch (e) {
        console.warn('Unified endpoint failed, falling back to parallel fetch:', e);
        // 備援計畫：並行載入 (Parallel)
        const [orderRes, productRes, custRes, logsRes] = await Promise.all([
          api.getMyOrders(token),
          api.getProducts(token),
          api.getCustomers(token).catch(() => ({data: []})),
          api.getLoginLogs(token).catch(() => ({data: []}))
        ]);

        const o = orderRes.data || [];
        const p = productRes.data || [];
        const c = custRes.data || [];
        const l = logsRes.data || [];

        setOrders(o);
        setProducts(p);
        setCustomers(c);
        setLoginLogs(l);

        localStorage.setItem('admin_orders', JSON.stringify(o));
        localStorage.setItem('admin_products', JSON.stringify(p));
        localStorage.setItem('admin_customers', JSON.stringify(c));
        localStorage.setItem('admin_logs', JSON.stringify(l));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || '加載失敗，請確保權限或試算表狀態正確。');
    } finally {
      setLoading(false);
      setIsSyncing(false);
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
  const filteredAndSortedOrders = useMemo(() => {
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

  // --- 客戶資料強化與活動追蹤 ---
  const processedCustomers = useMemo(() => {
    return customers
      .filter(c => (c.Account || c.帳號 || c.account))
      .map(c => {
        const accountNum = c.Account || c.帳號 || c.account;
        const account = String(accountNum).trim();
        const companyName = String(c.公司名稱 || c.店名 || c.companyName || '').trim();
        
        // 1. 最後登入時間
        const userLogs = loginLogs.filter(l => String(l.Account || l.帳號 || '').trim() === account && l.Status === '成功');
        const lastLogin = userLogs.length > 0 
          ? new Date(Math.max(...userLogs.map(l => new Date(l.Timestamp).getTime())))
          : null;
        
        // 2. 最後訂貨時間 (從 orders 找最新的一筆)
        const userOrders = orders.filter(o => {
          const oAcc = String(o.Account || o.帳號 || o.CustomerToken || '').trim();
          return oAcc === account || getCustomerName(o.CustomerToken) === companyName;
        });
        const lastOrder = userOrders.length > 0
          ? new Date(Math.max(...userOrders.map(o => new Date(o.Timestamp).getTime())))
          : null;

        // 3. 計算距離天數 (Last Order)
        let daysSinceLastOrder = Infinity;
        if (lastOrder) {
          const diffTime = Math.abs(new Date() - lastOrder);
          daysSinceLastOrder = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        return {
          ...c,
          account,
          companyName,
          lastLogin,
          lastOrder,
          daysSinceLastOrder
        };
      });
  }, [customers, loginLogs, orders]);

  // --- 客戶清單過濾與排序 ---
  const filteredAndSortedCustomers = useMemo(() => {
    let result = processedCustomers.filter(c => {
      const matchSearch = c.account.toLowerCase().includes(searchTermCustomer.toLowerCase()) || 
                          c.companyName.toLowerCase().includes(searchTermCustomer.toLowerCase());
      return matchSearch;
    });

    result.sort((a, b) => {
      let aVal = a[sortConfigCustomer.key];
      let bVal = b[sortConfigCustomer.key];

      if (sortConfigCustomer.key === 'lastLogin' || sortConfigCustomer.key === 'lastOrder') {
        aVal = aVal ? aVal.getTime() : 0;
        bVal = bVal ? bVal.getTime() : 0;
      }

      if (aVal < bVal) return sortConfigCustomer.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfigCustomer.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [processedCustomers, searchTermCustomer, sortConfigCustomer]);

  const updateOrderStatus = async (order, newStatus) => {
    if (!window.confirm(`確定要將狀態改為「${newStatus}」嗎？`)) return;
    setIsSyncing(true);
    try {
      await api.updateOrderStatus(adminToken, order, newStatus);
      alert('狀態更新成功');
      fetchData(adminToken);
    } catch (err) {
      alert('更新失敗：' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.updateOrder(adminToken, editingOrder, {
        qty: editingOrder.Quantity,
        shipDate: editingOrder.TargetShipDate
      });
      alert('訂單修改成功');
      fetchData(adminToken);
      setShowEditOrderModal(false);
    } catch (err) {
      alert('修改失敗：' + err.message);
    } finally {
      setIsSubmitting(false);
    }
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

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct.name) return alert('請填寫品名');
    
    setIsSubmitting(true);
    try {
      await api.updateProduct(adminToken, editingProduct);
      alert('商品資料更新成功！');
      fetchData(adminToken);
      setShowEditProductModal(false);
    } catch (err) {
      alert('更新失敗：' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!editingCustomer.companyName) return alert('請填寫店名');
    
    setIsSubmitting(true);
    try {
      const customerData = {
        ...editingCustomer,
        allowedProducts: editingCustomer.allowedProducts.join(',')
      };
      await api.updateCustomer(adminToken, customerData);
      alert('客戶資料更新成功！');
      fetchData(adminToken);
      setShowEditModal(false);
    } catch (err) {
      alert('更新失敗：' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (account) => {
    if (!window.confirm(`確定要重設 ${account} 的密碼嗎？這會產生一組隨機新密碼。`)) return;
    
    setIsSubmitting(true);
    try {
      const res = await api.resetCustomerPassword(adminToken, account);
      setResultPassword(res.newPassword);
      // 自動切換到顯示密碼的畫面（借用 showCustomerModal 的結果顯示區塊）
      setShowCustomerModal(true); 
      alert('密碼重設成功！請複製新密碼。');
    } catch (err) {
      alert('重設失敗：' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProductSelection = (pName, isEdit = false) => {
    console.log('Toggling product:', pName, 'isEdit:', isEdit);
    if (isEdit) {
      setEditingCustomer(prev => {
        const current = prev.allowedProducts || [];
        if (current.includes(pName)) {
          return { ...prev, allowedProducts: current.filter(x => x !== pName) };
        } else {
          return { ...prev, allowedProducts: [...current, pName] };
        }
      });
    } else {
      setNewCustomer(prev => {
        const current = prev.allowedProducts || [];
        if (current.includes(pName)) {
          return { ...prev, allowedProducts: current.filter(x => x !== pName) };
        } else {
          return { ...prev, allowedProducts: [...current, pName] };
        }
      });
    }
  };


  const handleToggleOrderSelection = (order) => {
    const key = `${order.Timestamp}-${order.CustomerToken}-${order.ProductID}`;
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(key)) newSelected.delete(key);
    else newSelected.add(key);
    setSelectedOrders(newSelected);
  };

  const handleToggleAllOrders = (currentItems) => {
    const allInPageKeys = currentItems.map(o => `${o.Timestamp}-${o.CustomerToken}-${o.ProductID}`);
    const allSelected = allInPageKeys.every(k => selectedOrders.has(k));
    const newSelected = new Set(selectedOrders);
    
    if (allSelected) {
      allInPageKeys.forEach(k => newSelected.delete(k));
    } else {
      allInPageKeys.forEach(k => newSelected.add(k));
    }
    setSelectedOrders(newSelected);
  };

  const handleBatchUpdateStatus = async (newStatus) => {
    if (!window.confirm(`確定要將選取的 ${selectedOrders.size} 筆訂單更新為 [${newStatus}] 嗎？`)) return;
    setIsSyncing(true);
    try {
      const ordersToUpdate = orders.filter(o => {
        const key = `${o.Timestamp}-${o.CustomerToken}-${o.ProductID}`;
        return selectedOrders.has(key);
      });
      await api.batchUpdateOrderStatus(adminToken, ordersToUpdate, newStatus);
      alert('批次更新成功！');
      setSelectedOrders(new Set());
      fetchData(adminToken);
    } catch (err) {
      alert('更新失敗：' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const SkeletonRow = ({ cols = 7 }) => (

    <tr>
      <td colSpan={cols} style={{ padding: '0.8rem' }}>
        <div className="skeleton" style={{ height: '2.5rem', width: '100%' }}></div>
      </td>
    </tr>
  );

  if (loading && orders.length === 0) return <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center'}}><Loader2 className="animate-spin" size={48} /></div>;

  return (
    <>
      <div className="animate-fade-in" style={{ padding: '2rem' }}>
        <nav className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--danger-color)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.2rem' }}>管理員後台戰情室</h2>
           </div>
           <div className="mobile-stack" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => setActiveTab('orders')} className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}>訂單追蹤</button>
              <button onClick={() => setActiveTab('products')} className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}>商品</button>
              <button onClick={() => setActiveTab('customers')} className={`btn ${activeTab === 'customers' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Users size={16} /> 客戶管理
              </button>
              <button onClick={() => setActiveTab('security')} className={`btn ${activeTab === 'security' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <ShieldAlert size={16} /> 資安監控
              </button>
              <div style={{ display: 'flex', gap: '0.5rem', flex: 1.5 }}>
                <button onClick={() => fetchData(adminToken)} className="btn btn-outline" title="同步最新數據" style={{ flex: 1 }}>
                  <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing && <span style={{ marginLeft: '8px', fontSize: '0.8rem' }}>同步中...</span>}
                </button>
                <button onClick={() => navigate('/shop')} className="btn btn-outline" style={{ flex: 1 }}>前台</button>
              </div>
           </div>
        </nav>

        {activeTab === 'orders' && (
          <div className="glass-panel">
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>📦 全平台訂單監控</h3>
              
              <div className="mobile-stack" style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '100%' }}>
                 <input 
                   type="text" 
                   placeholder="搜尋店名或商品..." 
                   className="form-input" 
                   style={{ flex: 1, margin: 0 }}
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                 />
                 <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                   <input type="checkbox" checked={showOnlyPending} onChange={e => setShowOnlyPending(e.target.checked)} />
                   僅看待處理
                 </label>
              </div>
            </div>

            <div className="responsive-container" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.5rem 1rem', width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={filteredAndSortedOrders.length > 0 && filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).every(o => selectedOrders.has(`${o.Timestamp}-${o.CustomerToken}-${o.ProductID}`))}
                        onChange={() => handleToggleAllOrders(filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage))}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                    </th>
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
                  {loading && orders.length === 0 ? (
                    [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                  ) : (
                    filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((order, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: selectedOrders.has(`${order.Timestamp}-${order.CustomerToken}-${order.ProductID}`) ? 'rgba(88,166,255,0.1)' : '' }}>
                        <td style={{ padding: '1rem' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedOrders.has(`${order.Timestamp}-${order.CustomerToken}-${order.ProductID}`)}
                            onChange={() => handleToggleOrderSelection(order)}
                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                          />
                        </td>
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
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              
                              <button title="已出貨" onClick={() => updateOrderStatus(order, '已出貨')} style={{ background: 'transparent', border: 'none', color: '#38b2ac', cursor: 'pointer' }}><Truck size={18} /></button>
                              <button title="核准" onClick={() => updateOrderStatus(order, '已核准')} style={{ background: 'transparent', border: 'none', color: 'var(--success-color)', cursor: 'pointer' }}><CheckCircle size={18} /></button>
                              <button 
                                title="編輯訂單" 
                                onClick={() => {
                                  setEditingOrder({ ...order });
                                  setShowEditOrderModal(true);
                                }} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer' }}
                              >
                                <Edit size={18} />
                              </button>
                              <button title="取消" onClick={() => updateOrderStatus(order, '已取消')} style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}><XCircle size={18} /></button>
                            </div>
                         </td>
                      </tr>
                    ))
                  )}
                  {!loading && filteredAndSortedOrders.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>無相符的訂單資料</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* --- 分頁與批次操作列 --- */}
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                顯示第 {filteredAndSortedOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} 至 {Math.min(currentPage * itemsPerPage, filteredAndSortedOrders.length)} 筆，共 {filteredAndSortedOrders.length} 筆
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="btn btn-outline"
                  style={{ padding: '0.4rem 0.8rem' }}
                >
                  上一頁
                </button>
                {[...Array(Math.ceil(filteredAndSortedOrders.length / itemsPerPage))].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setCurrentPage(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={`btn ${currentPage === i + 1 ? 'btn-primary' : 'btn-outline'}`}
                    style={{ padding: '0.4rem 0.8rem', minWidth: '40px' }}
                  >
                    {i + 1}
                  </button>
                )).slice(Math.max(0, currentPage - 3), Math.min(Math.ceil(filteredAndSortedOrders.length / itemsPerPage), currentPage + 2))}
                <button
                  disabled={currentPage === Math.ceil(filteredAndSortedOrders.length / itemsPerPage) || filteredAndSortedOrders.length === 0}
                  onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="btn btn-outline"
                  style={{ padding: '0.4rem 0.8rem' }}
                >
                  下一頁
                </button>
              </div>
            </div>

            {selectedOrders.size > 0 && (
              <div className="animate-fade-in" style={{
                position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                background: 'var(--primary-color)', color: '#fff', padding: '1rem 2rem',
                borderRadius: '50px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', gap: '1.5rem', zIndex: 1000,
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{ fontWeight: '600' }}>已選取 {selectedOrders.size} 筆訂單</div>
                <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.3)' }}></div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleBatchUpdateStatus('已核准')} className="btn" style={{ background: 'rgba(255,255,255,0.2)', padding: '0.4rem 1rem', fontSize: '0.85rem', color: '#fff' }}>核准</button>
                  <button onClick={() => handleBatchUpdateStatus('已出貨')} className="btn" style={{ background: 'rgba(255,255,255,0.2)', padding: '0.4rem 1rem', fontSize: '0.85rem', color: '#fff' }}>已出貨</button>
                  <button onClick={() => handleBatchUpdateStatus('已取消')} className="btn" style={{ background: 'rgba(248, 81, 73, 0.4)', padding: '0.4rem 1rem', fontSize: '0.85rem', color: '#fff' }}>取消</button>
                </div>
                <button onClick={() => setSelectedOrders(new Set())} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}><XCircle size={18} /></button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'products' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>🛠️ 商品資料管理</h3>
              <button 
                onClick={() => { console.log('Opening Product Modal'); setShowProductModal(true); }} 
                className="btn btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span> 新增商品
              </button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>商品詳細資料（包含起訂量、最高量）可直接在此查看。</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
               {products.map((p, idx) => {
                 const pName = p.Name || p.品名 || p.商品名稱 || p.Product || p.Item || Object.values(p).find(v => typeof v === 'string' && isNaN(Number(v)));
                 return (
                 <div key={idx} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(0,0,0,0.1)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                      <button 
                        onClick={() => {
                          setEditingProduct({
                            name: pName,
                            minQty: parseInt(p.最小訂購量 || p.MinQty || p.起訂量 || p.最小量 || 0),
                            maxQty: parseInt(p.最大訂購量 || p.MaxQty || p.最大量 || 0),
                            unit: p.單位 || p.Unit || '包',
                            leadTime: parseInt(p.出貨時間 || p.LeadTime || p.備貨天數 || p.提前天數 || p.準備天數 || 1)
                          });
                          setShowEditProductModal(true);
                        }}
                        className="btn btn-outline"
                        style={{ padding: '0.3rem', minWidth: 'auto' }}
                        title="編輯商品"
                      >
                        <Edit size={14} />
                      </button>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>品名</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--primary-color)' }}>{pName}</div>
                    </div>
                    
                    <div className="mobile-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>預定出貨</div>
                        <div style={{ fontWeight: '500' }}>{p.出貨時間 || p.LeadTime || p.備貨天數 || 1} 天</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>單位</div>
                        <div style={{ fontWeight: '500' }}>{p.單位 || p.Unit || '包'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>最小訂購</div>
                        <div style={{ fontWeight: '500' }}>{p.最小訂購量 || p.MinQty || p.起訂量 || 0}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>最大訂購</div>
                        <div style={{ fontWeight: '500' }}>{p.最大訂購量 || p.MaxQty || p.最大量 || '無限制'}</div>
                      </div>
                    </div>
                 </div>
               );})}
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="glass-panel">
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users color="var(--primary-color)" />
                <h3 style={{ margin: 0 }}>客戶關係管理清單</h3>
              </div>
              
              <div className="mobile-stack" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="搜尋帳號或店名..." 
                  className="form-input" 
                  style={{ width: '250px', margin: 0 }}
                  value={searchTermCustomer}
                  onChange={e => setSearchTermCustomer(e.target.value)}
                />
                <button 
                  onClick={() => { setShowCustomerModal(true); setResultPassword(''); }} 
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
                >
                  <Plus size={16} /> 新增客戶
                </button>
              </div>
            </div>

            <div className="responsive-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => {
                        let direction = 'asc';
                        if (sortConfigCustomer.key === 'Account' && sortConfigCustomer.direction === 'asc') direction = 'desc';
                        setSortConfigCustomer({ key: 'Account', direction });
                    }}>帳號 / 名稱 {sortConfigCustomer.key === 'Account' ? (sortConfigCustomer.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => {
                        let direction = 'desc';
                        if (sortConfigCustomer.key === 'lastLogin' && sortConfigCustomer.direction === 'desc') direction = 'asc';
                        setSortConfigCustomer({ key: 'lastLogin', direction });
                    }}>最後登入 {sortConfigCustomer.key === 'lastLogin' ? (sortConfigCustomer.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => {
                        let direction = 'asc';
                        if (sortConfigCustomer.key === 'daysSinceLastOrder' && sortConfigCustomer.direction === 'asc') direction = 'desc';
                        setSortConfigCustomer({ key: 'daysSinceLastOrder', direction });
                    }}>距上次訂貨 {sortConfigCustomer.key === 'daysSinceLastOrder' ? (sortConfigCustomer.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th style={{ padding: '1rem' }}>狀態</th>
                    <th style={{ padding: '1rem' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedCustomers.map((cust, idx) => {
                    const isBlocked = (cust.IsBlocked == "1" || cust.IsBlocked === true || cust.IsBlocked === "TRUE");
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isBlocked ? 'rgba(248, 81, 73, 0.05)' : 'transparent' }}>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 'bold', color: isBlocked ? 'var(--danger-color)' : 'var(--text-primary)' }}>{cust.Account}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cust.公司名稱 || cust.店名 || '未命名客戶'}</div>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                          {cust.lastLogin ? cust.lastLogin.toLocaleString() : <span style={{ opacity: 0.3 }}>無紀錄</span>}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                          {cust.lastOrder ? (
                            <span style={{ color: cust.daysSinceLastOrder > 30 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                              {cust.daysSinceLastOrder} 天前
                            </span>
                          ) : (
                            <span style={{ opacity: 0.3 }}>從未訂貨</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {isBlocked ? (
                            <span style={{ color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}><ShieldAlert size={14} /> 已封鎖</span>
                          ) : (
                            <span style={{ color: 'var(--success-color)', fontSize: '0.9rem' }}>正常</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => {
                                setEditingCustomer({
                                  account: cust.account,
                                  companyName: cust.companyName,
                                  email: cust.email || '',
                                  phone: cust.phone || '',
                                  address: cust.address || '',
                                  allowedProducts: (cust.可購產品 || '').split(',').filter(x => x)
                                });
                                setShowEditModal(true);
                              }}
                              className="btn btn-outline"
                              style={{ padding: '0.3rem', minWidth: 'auto' }}
                              title="編輯資料"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleResetPassword(cust.Account)}
                              className="btn btn-outline"
                              style={{ padding: '0.3rem', minWidth: 'auto', color: '#f59e0b', borderColor: '#f59e0b' }}
                              title="重設密碼"
                            >
                              <Key size={16} />
                            </button>
                            <button 
                              onClick={() => handleToggleBlock(cust.Account, cust.IsBlocked)}
                              className={`btn ${isBlocked ? 'btn-primary' : 'btn-outline'}`}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', minWidth: '80px', borderColor: isBlocked ? '' : 'var(--danger-color)', color: isBlocked ? '' : 'var(--danger-color)' }}
                            >
                              {isBlocked ? '🔓 解鎖' : '⛔ 封鎖'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }} className="mobile-stack">
              <div className="glass-panel">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <ShieldAlert color="var(--danger-color)" />
                      <h3 style={{ margin: 0 }}>近期登入監視器 (Anti-Bot)</h3>
                  </div>
                  
                  <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
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

              <div className="glass-panel">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <XCircle color="var(--danger-color)" />
                      <h3 style={{ margin: 0 }}>異常帳號快速封鎖</h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>此處顯示多次嘗試失敗或被系統自動標記的帳號。</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      {customers
                        .filter(c => (c.FailedAttempts > 0) || (c.IsBlocked == "1" || c.IsBlocked === true || c.IsBlocked === "TRUE"))
                        .map((c, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                             <div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{c.Account}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>失敗次數: {c.FailedAttempts || 0}</div>
                             </div>
                             <button 
                               onClick={() => handleToggleBlock(c.Account, c.IsBlocked)}
                               className="btn btn-outline"
                               style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}
                             >
                               {(c.IsBlocked == "1" || c.IsBlocked === true || c.IsBlocked === "TRUE") ? '🔓 解鎖' : '⛔ 封鎖'}
                             </button>
                          </div>
                        ))}
                  </div>
              </div>
          </div>
        )}
      </div>

      {/* --- 新增客戶彈窗 (移至最外層避開 Parent Transform) --- */}
      {showCustomerModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '2rem' }}>
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--primary-color)' }}>
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
                    {products
                      .map((p, pIdx) => {
                        const pName = p.Name || p.品名 || p.商品名稱 || p.Product || p.Item || Object.values(p).find(v => typeof v === 'string' && isNaN(Number(v)));
                        if (!pName) return null;
                        return (
                          <label key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', fontSize: '0.9rem', padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                             <input 
                               type="checkbox" 
                               style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                               checked={newCustomer.allowedProducts.includes(pName)} 
                               onChange={() => toggleProductSelection(pName)} 
                             />
                             <span style={{ color: 'var(--text-primary)' }}>{pName}</span>
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

      {/* --- 編輯客戶彈窗 --- */}
      {showEditModal && editingCustomer && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '2rem' }}>
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--primary-color)' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>✏️ 編輯客戶資料</h3>
            <form onSubmit={handleUpdateCustomer}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">登入帳號 (不可修改)</label>
                  <input type="text" className="form-input" value={editingCustomer.account} disabled style={{ opacity: 0.6 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">店名 / 公司名稱</label>
                  <input type="text" className="form-input" required value={editingCustomer.companyName} onChange={e => setEditingCustomer({...editingCustomer, companyName: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">電子郵件</label>
                  <input type="email" className="form-input" value={editingCustomer.email || ''} onChange={e => setEditingCustomer({...editingCustomer, email: e.target.value})} placeholder="example@mail.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">聯絡電話</label>
                  <input type="text" className="form-input" value={editingCustomer.phone || ''} onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})} placeholder="0912-345-678" />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">授權可購商品</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {products.map((p, pIdx) => {
                    const pName = p.Name || p.品名 || p.商品名稱 || p.Product || p.Item || Object.values(p).find(v => typeof v === 'string' && isNaN(Number(v)));
                    if (!pName) return null;
                    return (
                      <label key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', fontSize: '0.9rem', padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                         <input 
                           type="checkbox" 
                           checked={editingCustomer.allowedProducts.includes(pName)} 
                           onChange={() => toggleProductSelection(pName, true)} 
                         />
                         <span>{pName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-outline" style={{ flex: 1 }}>取消</button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 2 }}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : '儲存變更'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 新增商品彈窗 (移至最外層避開 Parent Transform) --- */}
      {showProductModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '2rem' }}>
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '500px', width: '100%', border: '1px solid var(--primary-color)' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>🏗️ 上架新商品</h3>
            
            <form onSubmit={handleAddProduct}>
              <div className="form-group">
                <label className="form-label">商品品名</label>
                <input type="text" className="form-input" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="例如: 漂白水-30KG/桶" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">單位</label>
                  <input type="text" className="form-input" value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} placeholder="例如: 桶 / 包 / 支" />
                </div>
                <div className="form-group">
                  <label className="form-label">出貨時間 (天數)</label>
                  <input type="number" className="form-input" value={newProduct.leadTime} onChange={e => setNewProduct({...newProduct, leadTime: parseInt(e.target.value) || 1})} min="0" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">最小訂購量</label>
                  <input type="number" className="form-input" value={newProduct.minQty} onChange={e => setNewProduct({...newProduct, minQty: parseInt(e.target.value) || 0})} min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">最大訂購量</label>
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
      {/* --- 編輯商品彈窗 --- */}
      {showEditProductModal && editingProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '2rem' }}>
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '500px', width: '100%', border: '1px solid var(--primary-color)' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>✏️ 編輯商品資料</h3>
            
            <form onSubmit={handleUpdateProduct}>
              <div className="form-group">
                <label className="form-label">商品品名 (不可修改)</label>
                <input type="text" className="form-input" value={editingProduct.name} disabled style={{ opacity: 0.6 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">單位</label>
                  <input type="text" className="form-input" value={editingProduct.unit} onChange={e => setEditingProduct({...editingProduct, unit: e.target.value})} placeholder="例如: 桶 / 包 / 支" />
                </div>
                <div className="form-group">
                  <label className="form-label">出貨時間 (天數)</label>
                  <input type="number" className="form-input" value={editingProduct.leadTime} onChange={e => setEditingProduct({...editingProduct, leadTime: parseInt(e.target.value) || 0})} min="0" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">最小訂購量</label>
                  <input type="number" className="form-input" value={editingProduct.minQty} onChange={e => setEditingProduct({...editingProduct, minQty: parseInt(e.target.value) || 0})} min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">最大訂購量</label>
                  <input type="number" className="form-input" value={editingProduct.maxQty} onChange={e => setEditingProduct({...editingProduct, maxQty: parseInt(e.target.value) || 0})} min="0" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setShowEditProductModal(false)} className="btn btn-outline" style={{ flex: 1 }}>取消</button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 2 }}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : '儲存變更'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- 編輯訂單彈窗 --- */}
      {showEditOrderModal && editingOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '2rem' }}>
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '400px', width: '100%', border: '1px solid var(--primary-color)' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>✏️ 修改訂單內容</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              客戶：{getCustomerName(editingOrder.CustomerToken)} <br />
              商品：{editingOrder.ProductID}
            </p>
            
            <form onSubmit={handleUpdateOrder}>
              <div className="form-group">
                <label className="form-label">訂購數量 ({editingOrder.Unit || '包'})</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={editingOrder.Quantity} 
                  onChange={e => setEditingOrder({...editingOrder, Quantity: parseInt(e.target.value) || 0})} 
                  min="1" 
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">預定出貨日</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={editingOrder.TargetShipDate ? new Date(editingOrder.TargetShipDate).toISOString().split('T')[0] : ''} 
                  onChange={e => setEditingOrder({...editingOrder, TargetShipDate: e.target.value})} 
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setShowEditOrderModal(false)} className="btn btn-outline" style={{ flex: 1 }}>取消</button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 2 }}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : '確認修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
