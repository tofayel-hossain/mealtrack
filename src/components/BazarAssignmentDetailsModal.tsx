import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  ShoppingBag,
  Eye,
  Check,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import type { BazarAssignment } from '../types';
import { useAuth } from '../context/AuthContext';
import { useMealSystem } from '../context/MealSystemContext';
import { reviewBazarReport, confirmBazarReturn } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

interface BazarAssignmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assignment: BazarAssignment | null;
  onOpenSubmitModal?: (assignment: BazarAssignment) => void;
}

export const BazarAssignmentDetailsModal: React.FC<BazarAssignmentDetailsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  assignment,
  onOpenSubmitModal,
}) => {
  const { user } = useAuth();
  const { activeRole } = useMealSystem();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReturnNow, setConfirmReturnNow] = useState(true);

  if (!isOpen || !assignment) return null;

  const isManager = activeRole === 'manager';
  const isAssignedMember = user?.id === assignment.assigned_to;
  const remaining = assignment.remaining_balance ?? (assignment.assigned_amount - (assignment.total_spent || 0));

  const handleApprove = async () => {
    if (!isManager || !user) return;
    try {
      setLoading(true);
      setError(null);

      await reviewBazarReport({
        assignment_id: assignment.id,
        manager_id: user.id,
        status: 'approved',
      });

      // If manager chose to confirm receipt of returned money simultaneously
      if (remaining > 0 && confirmReturnNow) {
        await confirmBazarReturn({
          assignment_id: assignment.id,
          manager_id: user.id,
          returned_amount: remaining,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to approve report.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!isManager || !user) return;
    const reason = window.prompt(
      `Enter reason for rejecting expense report from ${assignment.member_name || 'member'}:`
    );
    if (reason === null) return;

    try {
      setLoading(true);
      setError(null);

      await reviewBazarReport({
        assignment_id: assignment.id,
        manager_id: user.id,
        status: 'rejected',
        rejection_reason: reason.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to reject report.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReturnOnly = async () => {
    if (!isManager || !user) return;
    try {
      setLoading(true);
      setError(null);

      await confirmBazarReturn({
        assignment_id: assignment.id,
        manager_id: user.id,
        returned_amount: remaining,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to confirm return.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShoppingBag size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Bazar Details</h3>
            <span
              className="badge"
              style={{
                textTransform: 'capitalize',
                background:
                  assignment.status === 'completed'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : assignment.status === 'rejected'
                    ? 'rgba(244, 63, 94, 0.15)'
                    : assignment.status === 'approved'
                    ? 'rgba(139, 92, 246, 0.15)'
                    : assignment.status === 'submitted'
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'rgba(245, 158, 11, 0.15)',
                color:
                  assignment.status === 'completed'
                    ? 'var(--brand-primary)'
                    : assignment.status === 'rejected'
                    ? 'var(--color-debt)'
                    : assignment.status === 'approved'
                    ? '#a78bfa'
                    : assignment.status === 'submitted'
                    ? '#60a5fa'
                    : '#fbbf24',
                border: '1px solid currentColor',
              }}
            >
              {assignment.status}
            </span>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem' }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              padding: '0.65rem',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-debt)',
              fontSize: '0.85rem',
              marginBottom: '0.75rem',
            }}>
              {error}
            </div>
          )}

          {/* Member & Date Info */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            background: 'rgba(11, 15, 25, 0.5)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
          }}>
            <div>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Member</span>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{assignment.member_name || assignment.assigned_to}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Assigned By</span>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{assignment.manager_name || assignment.assigned_by}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Date</span>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatDate(assignment.assigned_date)}</div>
            </div>
          </div>

          {/* 4 Financial Metrics Tracked Separately */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}>
            <div className="card" style={{ padding: '0.65rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Assigned</span>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {formatCurrency(assignment.assigned_amount)}
              </div>
            </div>

            <div className="card" style={{ padding: '0.65rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Actual Spent</span>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-indigo)', marginTop: '0.2rem' }}>
                {formatCurrency(assignment.total_spent || 0)}
              </div>
            </div>

            <div className="card" style={{ padding: '0.65rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Remaining</span>
              <div style={{
                fontWeight: 800,
                fontSize: '1rem',
                color: remaining > 0 ? '#fbbf24' : 'var(--brand-primary)',
                marginTop: '0.2rem',
              }}>
                {formatCurrency(remaining)}
              </div>
            </div>

            <div className="card" style={{ padding: '0.65rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Returned</span>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--brand-primary)', marginTop: '0.2rem' }}>
                {formatCurrency(assignment.returned_amount || 0)}
              </div>
            </div>
          </div>

          {/* Rejection notice if any */}
          {assignment.status === 'rejected' && assignment.rejection_reason && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.65rem 0.85rem',
              fontSize: '0.85rem',
              color: 'var(--color-debt)',
              marginBottom: '1rem',
            }}>
              <strong>Rejection Reason:</strong> {assignment.rejection_reason}
            </div>
          )}

          {/* Note from manager */}
          {assignment.note && (
            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              <strong>Instructions:</strong> {assignment.note}
            </div>
          )}

          {/* Items Breakdown Table */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Itemized Expenses ({assignment.items?.length || 0} items)
            </div>

            {!assignment.items || assignment.items.length === 0 ? (
              <div style={{
                padding: '1.25rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-md)',
              }}>
                No items submitted yet.
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item Name</th>
                      <th>Quantity</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignment.items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                        <td style={{ color: 'var(--text-dim)' }}>{item.quantity || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {formatCurrency(item.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ fontWeight: 700, textAlign: 'right' }}>
                        Total Spent:
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-indigo)' }}>
                        {formatCurrency(assignment.total_spent || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Receipt View if attached */}
          {assignment.receipt_url && (
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Attached Receipt:
              </span>
              <a
                href={assignment.receipt_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--brand-primary)',
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                }}
              >
                <Eye size={14} /> View Receipt Photo
              </a>
            </div>
          )}

          {/* Return Confirmation Prompt for Manager when Approving */}
          {isManager && assignment.status === 'submitted' && remaining > 0 && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.85rem',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={confirmReturnNow}
                  onChange={(e) => setConfirmReturnNow(e.target.checked)}
                />
                <span>
                  Confirm member returned remaining <strong>{formatCurrency(remaining)}</strong> cash to manager right now
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            {isAssignedMember && (assignment.status === 'assigned' || assignment.status === 'rejected') && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenSubmitModal) onOpenSubmitModal(assignment);
                }}
                className="btn btn-primary btn-sm"
              >
                {assignment.status === 'rejected' ? 'Re-submit Report' : 'Submit Expense Report'}
              </button>
            )}

            {isManager && assignment.status === 'approved' && remaining > 0 && (
              <button
                type="button"
                onClick={handleConfirmReturnOnly}
                disabled={loading}
                className="btn btn-primary btn-sm"
                style={{ background: '#10b981', border: 'none' }}
              >
                <Check size={14} /> Confirm Remaining Return ({formatCurrency(remaining)})
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isManager && assignment.status === 'submitted' && (
              <>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={loading}
                  className="btn btn-secondary btn-sm"
                  style={{ color: 'var(--color-debt)' }}
                >
                  <X size={14} /> Reject
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading}
                  className="btn btn-primary btn-sm"
                  style={{ background: '#10b981', border: 'none' }}
                >
                  <Check size={14} /> Approve Report
                </button>
              </>
            )}

            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
