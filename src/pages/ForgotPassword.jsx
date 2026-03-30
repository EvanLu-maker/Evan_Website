import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Loader2, ArrowLeft, Mail, Lock, ShieldCheck } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Request, 2: Reset
  const [accountOrEmail, setAccountOrEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 步驟一：請求驗證碼
  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (!accountOrEmail) return setError('請輸入帳號或註冊 Email');
    
    setLoading(true);
    setError('');
    try {
      await api.requestPasswordReset(accountOrEmail);
      setStep(2);
      setSuccess('驗證碼已發送至您的信箱，請檢查收件匣（包含垃圾郵件）。');
    } catch (err) {
      setError(err.message || '發送失敗，請確認帳號/Email 是否正確');
    } finally {
      setLoading(false);
    }
  };

  // 步驟二：提交重設
  const handleReset = async (e) => {
    e.preventDefault();
    if (!code || !newPassword || !confirmPassword) return setError('請填寫所有欄位');
    if (newPassword !== confirmPassword) return setError('兩次密碼輸入不一致');
    if (newPassword.length < 4) return setError('密碼長度至少需 4 位');

    setLoading(true);
    setError('');
    try {
      // 在現實場景中，步驟二可能仍需要 account 資訊，
      // 我這裡假設 accountOrEmail 在第一步如果是帳號的話就直接用
      // 如果第一步是用 Email，GAS 會處理查表
      await api.resetPasswordWithCode(accountOrEmail, code, newPassword);
      setSuccess('密碼重設成功！3 秒後將為您跳轉至登入頁面...');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message || '重設失敗，驗證碼可能錯誤或已過期');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '450px', margin: '4rem auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
        <button 
          onClick={() => step === 1 ? navigate('/login') : setStep(1)}
          className="btn-icon"
          style={{ padding: '5px' }}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary-color)' }}>
          {step === 1 ? '忘記密碼' : '重設密碼'}
        </h2>
      </div>

      {success && (
        <div style={{ 
          backgroundColor: 'rgba(16, 185, 129, 0.1)', 
          color: '#10b981', 
          padding: '1rem', 
          borderRadius: '8px', 
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          color: 'var(--danger-color)', 
          padding: '1rem', 
          borderRadius: '8px', 
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          {error}
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleRequestCode}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            請輸入您的帳號或註冊時使用的電子郵件，我們將發送一組 6 位數驗證碼給您。
          </p>
          <div className="form-group">
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="帳號 或 Email" 
                style={{ paddingLeft: '40px' }}
                value={accountOrEmail}
                onChange={e => setAccountOrEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : '發送驗證碼'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset}>
          <div className="form-group">
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px', display: 'block' }}>驗證碼</label>
            <div style={{ position: 'relative' }}>
              <ShieldCheck size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="6 位數字" 
                maxLength={6}
                style={{ paddingLeft: '40px', letterSpacing: '0.2em' }}
                value={code}
                onChange={e => setCode(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px', display: 'block' }}>新密碼</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="password" 
                className="form-input" 
                placeholder="請輸入新密碼" 
                style={{ paddingLeft: '40px' }}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px', display: 'block' }}>確認新密碼</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="password" 
                className="form-input" 
                placeholder="再次輸入新密碼" 
                style={{ paddingLeft: '40px' }}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : '重設密碼'}
          </button>
        </form>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link to="/login" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
          返回登入頁面
        </Link>
      </div>
    </div>
  );
}
