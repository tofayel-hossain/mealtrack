import React, { useState } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import type { ExpenseCategory, FundingSource } from '../types';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import { recordBazarExpense, uploadReceiptImage } from '../services/api';
import { getDhakaTodayDateString } from '../utils/formatters';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'rice', label: 'Rice' },
  { value: 'vegetables', label: 'Vegetables' },
  { value: 'fish', label: 'Fish' },
  { value: 'meat', label: 'Meat' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'oil', label: 'Oil' },
  { value: 'spices', label: 'Spices' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'household', label: 'Household' },
  { value: 'other', label: 'Other' },
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeSystem, members, activeRole } = useMealSystem();
  const { user } = useAuth();

  const [date, setDate] = useState<string>(getDhakaTodayDateString());
  const [category, setCategory] = useState<ExpenseCategory>('vegetables');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [shopName, setShopName] = useState<string>('');
  const [purchaserId, setPurchaserId] = useState<string>(user?.id || members[0]?.user_id || '');
  const [fundingSource, setFundingSource] = useState<FundingSource>('shared_fund');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setReceiptPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSystem || !user) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let receiptUrl: string | null = null;
      if (receiptFile) {
        receiptUrl = await uploadReceiptImage(receiptFile);
      }

      const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label || 'Bazar';
      const finalDescription = description.trim() || categoryLabel;
      const isManager = activeRole === 'manager';

      await recordBazarExpense({
        system_id: activeSystem.id,
        date,
        category,
        description: finalDescription,
        amount: numAmount,
        shop_name: shopName.trim() || null,
        purchaser_id: purchaserId || user.id,
        created_by: user.id,
        funding_source: fundingSource,
        receipt_url: receiptUrl,
        no_receipt_reason: null,
        isManager,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Add Expense</h3>
            {activeRole !== 'manager' && (
              <span
                className="badge"
                style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontSize: '0.725rem',
                  padding: '0.15rem 0.45rem',
                }}
              >
                Approval Needed
              </span>
            )}
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

            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
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
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">Purchaser</label>
                <select
                  className="form-control"
                  value={purchaserId}
                  onChange={(e) => setPurchaserId(e.target.value)}
                >
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.profile?.full_name || m.user_id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Source</label>
                <select
                  className="form-control"
                  value={fundingSource}
                  onChange={(e) => setFundingSource(e.target.value as FundingSource)}
                >
                  <option value="shared_fund">Shared Fund</option>
                  <option value="personal_credit">Personal Credit</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Shop</label>
              <input
                type="text"
                className="form-control"
                placeholder="Shop Name"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Receipt</label>
              <div style={{
                border: '1px dashed var(--border-card)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(11, 15, 25, 0.4)',
                position: 'relative',
              }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                  }}
                />
                {receiptPreview ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                    <img
                      src={receiptPreview}
                      alt="Receipt"
                      style={{ height: '32px', borderRadius: '4px', objectFit: 'cover' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--brand-primary)' }}>Attached</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <Upload size={16} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Upload Receipt
                    </span>
                  </div>
                )}
              </div>
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
