import React, { useState } from 'react';
import { X, AlertCircle, ShoppingBag } from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import { assignBazarMoney } from '../services/api';
import { getDhakaTodayDateString } from '../utils/formatters';

interface AssignBazarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignBazarModal: React.FC<AssignBazarModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeSystem, members } = useMealSystem();
  const { user } = useAuth();

  const [assignedTo, setAssignedTo] = useState<string>(members[0]?.user_id || '');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(getDhakaTodayDateString());
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSystem || !user) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid assigned amount.');
      return;
    }

    if (!assignedTo) {
      setError('Please select a member.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await assignBazarMoney({
        system_id: activeSystem.id,
        assigned_to: assignedTo,
        assigned_by: user.id,
        assigned_amount: numAmount,
        assigned_date: date,
        note: note.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to assign money.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingBag size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Assign Bazar Money</h3>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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
              <label className="form-label">Member</label>
              <select
                className="form-control"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                required
              >
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile?.full_name || m.user_id} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">Assigned Amount (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="form-control"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Instructions / Note (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Fish, Vegetables, Rice"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? 'Assigning...' : 'Assign Money'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
