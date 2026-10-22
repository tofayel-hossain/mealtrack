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
import { formatDate } from '../utils/formatters';

export const MembersPage: React.FC = () => {
  const { activeSystem, activeRole, members, refreshSystemData } = useMealSystem();
  const { user } = useAuth();

  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);

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
