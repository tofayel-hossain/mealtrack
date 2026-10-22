import React, { useState } from 'react';
import { X, AlertTriangle, Sun, Moon } from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import { saveDailyMealRecord } from '../services/api';
import type { DailyMealRecord } from '../types';

interface PostCutoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DailyMealRecord | null;
  memberName: string;
  onSuccess: () => void;
}

export const PostCutoffModal: React.FC<PostCutoffModalProps> = ({
  isOpen,
  onClose,
  record,
  memberName,
  onSuccess,
}) => {
  const { activeSystem } = useMealSystem();
  const { user } = useAuth();

  const [lunchOff, setLunchOff] = useState<boolean>(
    record?.lunch_turned_off ?? record?.is_turned_off ?? false
  );
  const [dinnerOff, setDinnerOff] = useState<boolean>(
    record?.dinner_turned_off ?? record?.is_turned_off ?? false
  );
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSystem || !user) return;

    if (!reason.trim()) {
      setError('Reason is required for post-cutoff meal change.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const isFullOff = lunchOff && dinnerOff;
      const lunchCount = lunchOff ? 0 : 1.0;
      const dinnerCount = dinnerOff ? 0 : 1.0;
      const mealCount = isFullOff ? 0 : lunchCount + dinnerCount;

      await saveDailyMealRecord({
        systemId: activeSystem.id,
        memberId: record.member_id,
        date: record.date,
        lunchTurnedOff: lunchOff,
        dinnerTurnedOff: dinnerOff,
        lunchCount,
        dinnerCount,
        mealCount,
        isTurnedOff: isFullOff,
        isPostCutoff: true,
        reason: reason.trim(),
        actorId: user.id,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to apply meal change.');
    } finally {
      setLoading(false);
    }
  };

  const handleFullCut = () => {
    setLunchOff(true);
    setDinnerOff(true);
  };

  const handleBothOn = () => {
    setLunchOff(false);
    setDinnerOff(false);
  };

  const totalEffective = (lunchOff ? 0 : 1) + (dinnerOff ? 0 : 1);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="var(--accent-amber)" />
            <h3 style={{ fontSize: '1.1rem' }}>Meal Adjustment</h3>
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
                color: 'var(--color-debt)',
                padding: '0.6rem 0.8rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                marginBottom: '0.75rem',
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div><strong>Member:</strong> {memberName}</div>
              <div><strong>Date:</strong> {record.date}</div>
            </div>

            {/* Slot Toggles */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Slots</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                {/* Afternoon Meal Slot */}
                <div style={{
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-md)',
                  border: lunchOff ? '1px solid var(--border-subtle)' : '1px solid rgba(245, 158, 11, 0.4)',
                  background: lunchOff ? 'rgba(255, 255, 255, 0.02)' : 'rgba(245, 158, 11, 0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, fontSize: '0.85rem' }}>
                      <Sun size={15} color="var(--accent-amber)" /> Afternoon
                    </span>
                    <span style={{ fontSize: '0.75rem', color: lunchOff ? 'var(--accent-rose)' : 'var(--brand-primary)', fontWeight: 600 }}>
                      {lunchOff ? 'Cut' : 'Active'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLunchOff(!lunchOff)}
                    className={lunchOff ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
                    style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem' }}
                  >
                    {lunchOff ? 'Take' : 'Cut'}
                  </button>
                </div>

                {/* Night Meal Slot */}
                <div style={{
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-md)',
                  border: dinnerOff ? '1px solid var(--border-subtle)' : '1px solid rgba(99, 102, 241, 0.4)',
                  background: dinnerOff ? 'rgba(255, 255, 255, 0.02)' : 'rgba(99, 102, 241, 0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, fontSize: '0.85rem' }}>
                      <Moon size={15} color="var(--brand-secondary)" /> Night
                    </span>
                    <span style={{ fontSize: '0.75rem', color: dinnerOff ? 'var(--accent-rose)' : 'var(--brand-primary)', fontWeight: 600 }}>
                      {dinnerOff ? 'Cut' : 'Active'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDinnerOff(!dinnerOff)}
                    className={dinnerOff ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
                    style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem' }}
                  >
                    {dinnerOff ? 'Take' : 'Cut'}
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleFullCut}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', color: 'var(--accent-rose)' }}
                >
                  Cut Full
                </button>
                <button
                  type="button"
                  onClick={handleBothOn}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem' }}
                >
                  Take Full
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reason</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
