import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Copy,
  Check,
  Clock,
  XCircle,
  Share2,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import {
  getSystemInvitations,
  createSystemInvitation,
  revokeInvitation,
} from '../services/api';
import { formatDate } from '../utils/formatters';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import type { SystemInvitation } from '../types';

export const InvitationsPage: React.FC = () => {
  const { activeSystem, activeRole } = useMealSystem();
  const { user } = useAuth();

  const [invitations, setInvitations] = useState<SystemInvitation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<'member' | 'manager'>('member');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  const loadInvitations = async () => {
    if (!activeSystem) return;
    try {
      setLoading(true);
      const data = await getSystemInvitations(activeSystem.id);
      setInvitations(data);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSystem) {
      setLoading(false);
      return;
    }
    loadInvitations();
  }, [activeSystem?.id]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSystem || !user || activeRole !== 'manager') return;

    try {
      setCreating(true);
      await createSystemInvitation(
        activeSystem.id,
        user.id,
        inviteEmail.trim() || undefined,
        inviteRole
      );
      setInviteEmail('');
      await loadInvitations();
    } catch (err: any) {
      alert(err?.message || 'Failed to generate invitation');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (invId: string) => {
    if (!activeSystem || !user || activeRole !== 'manager') return;
    if (!window.confirm('Are you sure you want to revoke this invitation token?')) return;
    try {
      await revokeInvitation(invId, activeSystem.id, user.id);
      await loadInvitations();
    } catch (err: any) {
      alert(err?.message || 'Failed to revoke invitation');
    }
  };

  const copyToClipboard = (token: string) => {
    const inviteUrl = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
  };

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
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Invitations</h1>
        </div>

        <div style={{
          background: 'rgba(31, 41, 55, 0.8)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-md)',
          padding: '0.35rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code:</span>
          <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)', fontSize: '0.95rem' }}>
            {activeSystem.code}
          </strong>
        </div>
      </div>

      {/* Manager Invite Generator Form */}
      {activeRole === 'manager' && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>Invite Member</h3>

          <form onSubmit={handleCreateInvite}>
            <div className="grid-cols-3" style={{ alignItems: 'flex-end', gap: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Role</label>
                <select
                  className="form-control"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                >
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={creating}
                style={{ height: '38px', padding: '0 1rem' }}
              >
                <UserPlus size={15} /> {creating ? 'Generating...' : 'Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invitations Table */}
      <div className="card">
        <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>Invitations</h3>

        {loading ? (
          <LoadingSpinner message="Loading..." />
        ) : invitations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            No invitations.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-primary)' }}>
                        {inv.token}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${inv.role}`} style={{ textTransform: 'capitalize' }}>{inv.role}</span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{inv.email || 'Open'}</td>
                    <td>{formatDate(inv.expires_at)}</td>
                    <td>
                      <span className={`badge ${inv.status === 'pending' ? 'badge-credit' : 'badge-debt'}`} style={{ textTransform: 'capitalize' }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        {inv.status === 'pending' && (
                          <>
                            <button
                              onClick={() => copyToClipboard(inv.token)}
                              className="btn btn-secondary btn-sm"
                            >
                              {copiedToken === inv.token ? (
                                <>
                                  <Check size={12} color="var(--brand-primary)" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy size={12} /> Copy
                                </>
                              )}
                            </button>

                            {activeRole === 'manager' && (
                              <button
                                onClick={() => handleRevoke(inv.id)}
                                className="btn btn-danger btn-sm"
                              >
                                <XCircle size={12} /> Revoke
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
