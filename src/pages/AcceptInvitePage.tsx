import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { UtensilsCrossed, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMealSystem } from '../context/MealSystemContext';
import { acceptSystemInvitation } from '../services/api';

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { user } = useAuth();
  const { refreshSystemData } = useMealSystem();
  const navigate = useNavigate();

  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!token) {
      setError('No invitation token found in URL.');
      return;
    }

    if (!user) {
      navigate(`/login?redirect=/accept-invite?token=${token}`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await acceptSystemInvitation(token, user.id);
      await refreshSystemData();
      setJoined(true);
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (e: any) {
      setError(e?.message || 'Failed to accept invitation.');
    } finally {
      setLoading(false);
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
      <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          padding: '0.85rem',
          borderRadius: '16px',
          marginBottom: '1rem',
          boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
        }}>
          <UtensilsCrossed size={32} color="#ffffff" />
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Mess Invitation</h2>
          <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            You have been invited to join a shared mess on MealTrack.
          </p>

          <div style={{
            background: 'rgba(11, 15, 25, 0.7)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-card)',
            marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
              Invitation Token
            </div>
            <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--brand-primary)', marginTop: '0.2rem' }}>
              {token || ''}
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-debt)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {joined ? (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              color: 'var(--brand-primary)',
              fontWeight: 600,
            }}>
              <CheckCircle size={20} style={{ display: 'inline', marginRight: '6px' }} />
              Successfully joined mess! Redirecting to dashboard...
            </div>
          ) : (
            <button
              onClick={handleJoin}
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              {loading ? 'Joining...' : 'Accept & Join Mess as Member'}
            </button>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
              ← Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
