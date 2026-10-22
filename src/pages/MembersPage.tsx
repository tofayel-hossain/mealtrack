import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Shield,
  User,
  UserPlus,
  ShieldAlert,
  Phone,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import { ManagerTransferModal } from '../components/ManagerTransferModal';
import { EmptyState } from '../components/EmptyState';
import { formatDate, formatCurrency, getDhakaTodayDateString } from '../utils/formatters';
import { getMonthlyAccountingSummary } from '../services/api';
import { ShoppingBag, Home, Wallet } from 'lucide-react';
import type { MonthlyAccountingSummary } from '../types';

export const MembersPage: React.FC = () => {
  const { activeSystem, activeRole, members, settings, refreshSystemData } = useMealSystem();
  const { user } = useAuth();

  const currentPeriod = getDhakaTodayDateString().slice(0, 7);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [accounting, setAccounting] = useState<MonthlyAccountingSummary | null>(null);

  React.useEffect(() => {
    if (!activeSystem) return;
    getMonthlyAccountingSummary(activeSystem.id, currentPeriod)
      .then(setAccounting)
      .catch((err) => console.error('Failed to load member summaries:', err));
  }, [activeSystem?.id, currentPeriod]);

  if (!activeSystem) {
    return (
      <div className="page-wrapper">
        <EmptyState
          title="No Mess System"
          description="Please create or join a mess system first."
        />
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <h1>Mess Members</h1>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link to="/invitations" className="btn btn-secondary btn-sm">
            <UserPlus size={15} /> Invite New Member
          </Link>

          {activeRole === 'manager' && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="btn btn-outline btn-sm"
              style={{ color: 'var(--color-warning)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
            >
              <ShieldAlert size={15} /> Transfer Leadership
            </button>
          )}
        </div>
      </div>

      {/* Members Grid */}
      <div className="grid-cols-2" style={{ marginBottom: '1.5rem' }}>
        {members.map((mem) => {
          const isMe = mem.user_id === user?.id;
          const isMgr = mem.role === 'manager';

          return (
            <div
              key={mem.id}
              className="card"
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                position: 'relative',
                border: isMgr ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid var(--border-card)',
              }}
            >
              <img
                src={mem.profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                alt={mem.profile?.full_name}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: isMgr ? '2px solid #8b5cf6' : '2px solid var(--border-subtle)',
                }}
              />

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <h3 style={{ fontSize: '1.1rem' }}>{mem.profile?.full_name || ''}</h3>
                  {isMe && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--brand-primary)', fontWeight: 700 }}>
                      You
                    </span>
                  )}
                  <span className={`badge badge-${mem.role}`} style={{ marginLeft: 'auto' }}>
                    {mem.role}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Phone size={13} color="var(--text-dim)" />
                    <span>{mem.profile?.phone || 'No phone added'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={13} color="var(--text-dim)" />
                    <span>Joined: {formatDate(mem.joined_at)}</span>
                  </div>
                </div>

                {/* Monthly Financial Quick Stats */}
                {accounting && (() => {
                  const mSummary = accounting.members.find((m) => m.member_id === mem.user_id);
                  if (!mSummary) return null;
                  return (
                    <div style={{
                      marginTop: '0.65rem',
                      paddingTop: '0.65rem',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      fontSize: '0.78rem',
                    }}>
                      <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-muted)' }}>
                        <span title="Total Bazar Done this month">
                          🛒 Bazar: <strong style={{ color: 'var(--brand-primary)' }}>{formatCurrency(mSummary.total_bazar_done, settings?.currency_symbol)}</strong>
                        </span>
                        <span title="Room/Seat Rent">
                          🏠 Rent: <strong style={{ color: 'var(--accent-indigo)' }}>{formatCurrency(mSummary.house_rent, settings?.currency_symbol)}</strong>
                        </span>
                      </div>

                      <div>
                        {mSummary.amount_need_to_pay > 0 ? (
                          <span className="badge badge-debt" style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                            Need to Pay: {formatCurrency(mSummary.amount_need_to_pay, settings?.currency_symbol)}
                          </span>
                        ) : mSummary.surplus_advance > 0 ? (
                          <span className="badge badge-credit" style={{ fontSize: '0.75rem' }}>
                            Advance: +{formatCurrency(mSummary.surplus_advance, settings?.currency_symbol)}
                          </span>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                            Settled (৳0)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manager Transfer Modal */}
      <ManagerTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onSuccess={() => {
          refreshSystemData();
        }}
      />
    </div>
  );
};
