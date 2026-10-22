import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { PaymentMethod } from '../types';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import { recordDeposit } from '../services/api';
import { getDhakaTodayDateString } from '../utils/formatters';

interface AddDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

export const AddDepositModal: React.FC<AddDepositModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeSystem, members } = useMealSystem();
  const { user } = useAuth();

  const [memberId, setMemberId] = useState<string>(members[0]?.user_id || '');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(getDhakaTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [trxRef, setTrxRef] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSystem || !user) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive deposit amount in BDT.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await recordDeposit({
        system_id: activeSystem.id,
        member_id: memberId,
        amount: numAmount,
        date,
        payment_method: paymentMethod,
        transaction_reference: trxRef.trim() || null,
        note: note.trim() || null,
        recorded_by: user.id,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record deposit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.15rem' }}>Record Member Deposit</h3>
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
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
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

            <div className="form-group">
              <label className="form-label">Member</label>
              <select
                className="form-control"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                required
              >
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile?.full_name || m.user_id}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Deposit Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-control"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm.value} value={pm.value}>
                      {pm.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Trx Reference</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Reference"
                  value={trxRef}
                  onChange={(e) => setTrxRef(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Note</label>
              <input
                type="text"
                className="form-control"
                placeholder="Note"
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
              {loading ? 'Recording...' : 'Record Deposit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
