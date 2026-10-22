import React, { useState } from 'react';
import { X, ShieldAlert, ArrowRight, AlertCircle } from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import { transferManagerRole } from '../services/api';

interface ManagerTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ManagerTransferModal: React.FC<ManagerTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeSystem, members, refreshSystemData } = useMealSystem();
  const { user } = useAuth();

  // Exclude current manager from candidate list
  const eligibleMembers = members.filter((m) => m.user_id !== user?.id && m.status === 'active');
  const [targetMemberId, setTargetMemberId] = useState<string>(eligibleMembers[0]?.user_id || '');
  const [reason, setReason] = useState<string>('');
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSystem || !user) return;

    if (!targetMemberId) {
      setError('Please select an active member to receive the manager role.');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a mandatory reason for transferring management.');
      return;
    }

    if (!confirmed) {
      setError('Please confirm that you understand this action will demote your account to regular member.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await transferManagerRole(activeSystem.id, targetMemberId, reason.trim(), user.id);
      await refreshSystemData();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to transfer manager role.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} color="var(--accent-amber)" />
            <h3 style={{ fontSize: '1.1rem' }}>Transfer Manager</h3>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleTransfer}>
          <div className="modal-body">
            {error && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
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
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">New Manager</label>
              <select
                className="form-control"
                value={targetMemberId}
                onChange={(e) => setTargetMemberId(e.target.value)}
                required
              >
                {eligibleMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile?.full_name || m.user_id}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Reason</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div style={{
              marginTop: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: 'rgba(11, 15, 25, 0.6)',
              padding: '0.65rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}>
              <input
                type="checkbox"
                id="confirm-transfer"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="confirm-transfer" style={{ fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                Confirm role transfer
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger btn-sm"
              disabled={loading || !confirmed || eligibleMembers.length === 0}
            >
              {loading ? 'Transferring...' : 'Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
