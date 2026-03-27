import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { User, LogOut, Package, ArrowLeft, Save, Loader2, CheckCircle } from 'lucide-react';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const userData = sessionStorage.getItem('user');
    if (!userData) {
      navigate('/');
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    setEmail(parsedUser.email || '');
    setPhone(parsedUser.phone || '');
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    navigate('/');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await api.updateProfile(user.token, { email, phone, password });
      setSuccessMsg(res.message);
      
      // Update session storage
      const updatedUser = { ...user, email, phone };
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      if (password) {
          setTimeout(() => {
              handleLogout();
          }, 3000);
      }
    } catch (err) {
      setErrorMsg(err.message || '更新失敗');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="animate-fade-in" style={{ padding: '2rem 1rem', position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
      
      <nav className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap:'wrap', gap:'1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User color="var(--primary-color)" />
          <h2 style={{ color: 'var(--primary-color)', margin: 0 }}>個人資料設定</h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/shop" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <ArrowLeft size={18} />
            回商品大廳
          </Link>

          <button onClick={handleLogout} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-color)', borderColor: 'rgba(248, 81, 73, 0.3)' }}>
            <LogOut size={16} /> 登出
          </button>
        </div>
      </nav>

      <div className="glass-panel" style={{ padding: '2.5rem' }}>
         <form onSubmit={handleSave} className="b2b-form">
            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>帳戶資訊</h3>
            
            {successMsg && (
                <div style={{ padding: '1rem', background: 'rgba(46, 160, 67, 0.15)', color: 'var(--success-color)', border: '1px solid var(--success-color)', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={18} /> {successMsg}
                </div>
            )}
            
            {errorMsg && (
                <div style={{ padding: '1rem', background: 'rgba(248, 81, 73, 0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)', borderRadius: '8px', marginBottom: '1rem' }}>
                    {errorMsg}
                </div>
            )}

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
               <label className="form-label">登入帳號 (唯讀)</label>
               <input type="text" className="form-input" value={user.account} disabled style={{ opacity: 0.5 }} />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
               <label className="form-label">電子郵件 (Email)</label>
               <input 
                  type="email" 
                  className="form-input" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="name@example.com" 
               />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
               <label className="form-label">聯絡電話</label>
               <input 
                  type="text" 
                  className="form-input" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="0912-345-678" 
               />
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
               <label className="form-label">重設密碼</label>
               <input 
                  type="password" 
                  className="form-input" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="若不修改請留白" 
                  autoComplete="new-password"
               />
               <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '5px' }}>
                   *請注意：修改密碼後系統將會自動登出，請使用新密碼重新登入。
               </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
               {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
               {loading ? '儲存中...' : '儲存變更'}
            </button>
         </form>
      </div>
    </div>
  );
}
