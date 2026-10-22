import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Lock, Mail, AlertCircle, Eye, EyeOff, CheckCircle, KeyRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { user, loading: authLoading, signIn, resetPassword, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide an email address.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await signIn(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setResetError('Please enter your email address.');
      return;
    }

    try {
      setResetLoading(true);
      setResetError(null);
      setResetSuccess(null);
      await resetPassword(resetEmail);
      setResetSuccess('Password reset link sent! Please check your email inbox.');
    } catch (err: any) {
      setResetError(err?.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.12) 0%, transparent 50%), var(--bg-primary)',
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '0.75rem',
            borderRadius: '14px',
            marginBottom: '0.5rem',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
          }}>
            <UtensilsCrossed size={28} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.1rem' }}>MealTrack</h1>
        </div>

        <div className="card" style={{ padding: '1.75rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Login</h2>

          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.65rem 0.75rem',
              color: 'var(--color-debt)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="form-group">
              <label className="form-label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  className="form-control"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '2.2rem' }}
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setShowForgotModal(true);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--brand-primary)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontWeight: 500,
                    padding: 0,
                  }}
                >
                  Forgot?
                </button>
              </div>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '2.2rem', paddingRight: '2.4rem' }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                  }}
                  title="Toggle"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.65rem' }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <Link to="/register" style={{ color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Register
            </Link>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={18} color="var(--brand-primary)" />
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Reset Password</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setResetSuccess(null);
                  setResetError(null);
                }}
                className="btn-icon"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {resetSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                padding: '0.65rem',
                borderRadius: 'var(--radius-md)',
                color: 'var(--brand-primary)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
              }}>
                <CheckCircle size={16} />
                <span>{resetSuccess}</span>
              </div>
            )}

            {resetError && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                padding: '0.65rem',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-debt)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
              }}>
                <AlertCircle size={16} />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    style={{ paddingLeft: '2.2rem' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

