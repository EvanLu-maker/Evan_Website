import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { ShoppingCart, LogOut, Package, Loader2, X, Plus, Minus, CheckCircle, FileText } from 'lucide-react';

export default function Shop() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 購物車狀態與 UI 控制
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
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
    try {
      const res = await api.getProducts(token);
      setProducts(res.data || []);
    } catch (err) {
      setError('無法載入商品清單，請確認 API URL 設定正確，或試算表有 Products 工作表及庫存資料。');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    navigate('/');
  };

  const addToCart = (product) => {
    setCart(prev => {
      // 確保將完整的商品物件儲存下來，而不只有文字字串或參照
      const existing = prev.find(item => JSON.stringify(item.product) === JSON.stringify(product));
      if (existing) {
        return prev.map(item => JSON.stringify(item.product) === JSON.stringify(product) ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (idx, delta) => {
    setCart(prev => {
      const newCart = [...prev];
      newCart[idx].quantity += delta;
      if (newCart[idx].quantity <= 0) {
        newCart.splice(idx, 1);
      }
      return newCart;
    });
  };

  const getDynamicFieldInfo = (product) => {
    const keys = Object.keys(product);
    const titleField = keys.find(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('品名')) || Object.keys(product)[0];
    const priceField = keys.find(k => k.toLowerCase().includes('price') || k.toLowerCase().includes('價格')) || Object.keys(product)[1];
    const prepareField = keys.find(k => k.includes('天數') || k.toLowerCase().includes('leadtime') || k.toLowerCase().includes('出貨'));
    
    return {
      name: product[titleField] || '未命中商品名',
      price: priceField ? product[priceField] : 0,
      prepareDays: prepareField ? product[prepareField] : 1
    };
  };

  const calculateTotal = () => {
    return cart.reduce((acc, item) => {
      const info = getDynamicFieldInfo(item.product);
      const price = parseFloat(String(info.price).replace(/[^0-9.-]+/g, "")) || 0;
      return acc + (price * item.quantity);
    }, 0);
  };

  // 結帳並依「出貨天數/準備天數」自動拆單邏輯
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    
    // 將購物車商品自動以「出貨天數」分批歸類成不同訂單 (拆單)
    const groupedOrders = {};
    cart.forEach(item => {
      const info = getDynamicFieldInfo(item.product);
      const days = parseInt(info.prepareDays, 10) || 1;
      if (!groupedOrders[days]) groupedOrders[days] = [];
      groupedOrders[days].push({
        productName: info.name,
        price: info.price,
        quantity: item.quantity,
        rawProduct: item.product // 夾帶完整 metadata 回到後端備查
      });
    });

    // 格式化傳送給 Google Sheets API
    const ordersData = Object.keys(groupedOrders).map(days => ({
      expectedShippingDays: parseInt(days),
      items: groupedOrders[days],
      batchTotal: groupedOrders[days].reduce((acc, it) => acc + (parseFloat(String(it.price).replace(/[^0-9.-]+/g, "")) || 0) * it.quantity, 0)
    }));

    try {
      await api.submitOrder(user.token, ordersData);
      setOrderSuccess(true);
      setCart([]); // 清空購物車
      setTimeout(() => {
        setOrderSuccess(false);
        setIsCartOpen(false);
      }, 3000);
    } catch (err) {
      alert("訂單送出失敗：" + err.message + "\n請確認試算表有 Orders 工作表！");
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
    <div className="animate-fade-in" style={{ padding: '2rem 1rem', position: 'relative' }}>
      
      {/* 導覽列 */}
      <nav className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package color="var(--primary-color)" />
          <h2 style={{ color: 'var(--primary-color)', margin: 0 }}>B2B 商品大廳</h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>企業帳號, {user?.account}</span>
          
          <Link to="/orders" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <Package size={18} />
            我的訂單
          </Link>

          <button onClick={() => setIsCartOpen(true)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
            <ShoppingCart size={18} />
            待結帳
            {cart.length > 0 && (
              <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--danger-color)', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '50%' }}>
                {cart.reduce((acc, item) => acc + item.quantity, 0)}
              </span>
            )}
          </button>
          
          <button onClick={handleLogout} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-color)', borderColor: 'rgba(248, 81, 73, 0.3)' }}>
            <LogOut size={16} />
            登出
          </button>
        </div>
      </nav>

      {/* 商品區塊 */}
      {error ? (
        <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--danger-color)' }}>
          <p>{error}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
          <h3>試算表連線成功，但尚未發現商品資料</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', maxWidth: '500px', margin: '1rem auto' }}>
            請檢查您的 Google 試算表 <strong>Products</strong> 工作表：<br/>
            1. 第一列必須有標題（例如：品名、價格）<br/>
            2. 第二列以下必須至少有一行商品資料。<br/>
            3. 確認工作表名稱大小寫為 <strong>Products</strong>。
          </p>
          <button onClick={() => fetchProducts(user.token)} className="btn btn-outline" style={{ marginTop: '1rem' }}>
            重新嘗試讀取
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {products.map((product, idx) => {
            const info = getDynamicFieldInfo(product);
            const otherKeys = Object.keys(product).filter(k => product[k] !== info.name && product[k] !== info.price);
            
            return (
              <div key={idx} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '2rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'center', fontSize: '2rem' }}>
                  📦
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{info.name}</h3>
                  <div style={{ color: 'var(--primary-color)', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    ${info.price}
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                     預計準備天數: {info.prepareDays} 天
                  </div>
                  {/* 顯示其他額外資訊 */}
                  <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap:'4px' }}>
                     {otherKeys.slice(0, 4).map(k => (
                       <div key={k} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}: {product[k]}</div>
                     ))}
                  </div>
                </div>
                
                <button 
                  onClick={() => addToCart(product)}
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: 'auto' }}
                >
                  加入訂單
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 購物車滑出面板 (Drawer) */}
      {isCartOpen && (
        <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', maxWidth: '100%',
            background: 'var(--surface-color)', backdropFilter: 'var(--glass-blur)', zIndex: 50,
            borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column',
            boxShadow: '-10px 0 20px rgba(0,0,0,0.5)', animation: 'fadeIn 0.2s ease-out'
          }}>
          
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingCart size={20} /> 企業採購車
            </h3>
            <button onClick={() => setIsCartOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X /></button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            {orderSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--success-color)' }}>
                <CheckCircle size={48} style={{ margin: '0 auto 1rem' }} />
                <h3>訂單已送出成功！</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>系統已依準備天數自動為您建立分批出貨單。<br/>感謝您的訂購！</p>
              </div>
            ) : cart.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>目前尚未加入任何商品</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {cart.map((item, idx) => {
                  const info = getDynamicFieldInfo(item.product);
                  return (
                    <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>{info.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ color: 'var(--primary-color)' }}>${info.price}</div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'var(--bg-color)', padding: '0.2rem', borderRadius: '4px' }}>
                          <button onClick={() => updateQuantity(idx, -1)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '0.2rem' }}><Minus size={14} /></button>
                          <span style={{ fontSize: '0.9rem', width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                          <button onClick={() => updateQuantity(idx, 1)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '0.2rem' }}><Plus size={14} /></button>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>配貨準備: {info.prepareDays} 天</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {!orderSuccess && cart.length > 0 && (
            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', background: '#0a0d12' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>
                 <span>預估總計</span>
                 <span>${calculateTotal().toFixed(2)}</span>
              </div>
              <button 
                onClick={handleCheckout} 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '0.8rem' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? <><Loader2 className="animate-spin" size={18} style={{marginRight:'8px'}}/> 處理訂單中...</> : '確認送出訂單 (系統將自動拆單)'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
