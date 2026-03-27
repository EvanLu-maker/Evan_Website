import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!account || !password) {
      setError('請輸入帳號密碼');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      let recaptchaToken = null;
      if (window.grecaptcha && window.grecaptcha.ready) {
         try {
             // 如果還沒填入正式 Key，直接跳過驗證避免卡住
             if ('YOUR_RECAPTCHA_SITE_KEY' !== 'YOUR_RECAPTCHA_SITE_KEY') {
                 recaptchaToken = await new Promise((resolve, reject) => {
                     window.grecaptcha.ready(() => {
                         window.grecaptcha.execute('YOUR_RECAPTCHA_SITE_KEY', {action: 'login'}).then(resolve).catch(reject);
                     });
                 });
             }
         } catch(rcErr) {
             console.warn("reCAPTCHA 發生錯誤或尚未設定 Key", rcErr);
         }
      }

      // 呼叫 Google Apps Script 登入 API
      const res = await api.login(account, password, recaptchaToken);
      
      // 成功後將使用者狀態寫入 sessionStorage，保護資料
      sessionStorage.setItem('user', JSON.stringify(res.user));
      
      // 導向商城
      navigate('/shop');
    } catch (err) {
      setError(err.message || '登入失敗，請檢查帳號密碼');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '400px', margin: '4rem auto', textAlign: 'center' }}>
      <h2 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>B2B 訂貨系統</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>客戶登入入口</p>
      
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <input 
            type="text" 
            className="form-input" 
            placeholder="帳號" 
            value={account} 
            onChange={e => setAccount(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <input 
            type="password" 
            className="form-input" 
            placeholder="密碼" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        
        {error && (
          <div style={{ color: 'var(--danger-color)', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%' }}
          disabled={loading}
        >
          {loading ? (
             <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Loader2 className="animate-spin" size={18} />
               驗證中...
             </span>
          ) : (
            '登入'
          )}
        </button>
      </form>
    </div>
  );
}
