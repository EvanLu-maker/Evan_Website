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

  const [turnstileToken, setTurnstileToken] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!account || !password) {
      setError('請輸入帳號密碼');
      return;
    }

    if (!turnstileToken) {
      setError('請完成機器人驗證');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // 呼叫 Google Apps Script 登入 API
      const res = await api.login(account, password, turnstileToken);
      
      // 成功後將使用者狀態寫入 sessionStorage，保護資料
      sessionStorage.setItem('user', JSON.stringify(res.user));
      
      // 導向商城
      navigate('/shop');
    } catch (err) {
      setError(err.message || '登入失敗，請檢查帳號密碼');
      // 失敗時可以重新載入驗證碼 (如果有需要)
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // 延遲渲染確保 script 已載入
    const checkTurnstile = setInterval(() => {
      if (window.turnstile) {
        clearInterval(checkTurnstile);
        window.turnstile.render('#turnstile-container', {
          sitekey: '1x00000000000000000000AA', // 測試專用 Key，正式環境請換成您自己的
          callback: (token) => {
            setTurnstileToken(token);
            setError('');
          },
        });
      }
    }, 500);
    return () => clearInterval(checkTurnstile);
  }, []);

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

        {/* Cloudflare Turnstile 容器 */}
        <div id="turnstile-container" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}></div>
        
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
