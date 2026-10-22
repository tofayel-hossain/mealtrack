import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Upload, AlertCircle, ShoppingBag } from 'lucide-react';
import type { BazarAssignment, BazarItem } from '../types';
import { submitBazarReport, uploadReceiptImage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

interface SubmitBazarReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assignment: BazarAssignment | null;
}

interface ItemRow {
  id: string;
  item_name: string;
  quantity: string;
  price: string;
}

export const SubmitBazarReportModal: React.FC<SubmitBazarReportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  assignment,
}) => {
  const [items, setItems] = useState<ItemRow[]>([
    { id: 'item-1', item_name: '', quantity: '', price: '' },
  ]);
  const [submissionNote, setSubmissionNote] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (assignment) {
      if (assignment.items && assignment.items.length > 0) {
        setItems(
          assignment.items.map((i, idx) => ({
            id: i.id || `item-${idx}`,
            item_name: i.item_name,
            quantity: i.quantity || '',
            price: i.price.toString(),
          }))
        );
      } else {
        setItems([{ id: 'item-1', item_name: '', quantity: '', price: '' }]);
      }
      setSubmissionNote(assignment.submission_note || '');
      setReceiptPreview(assignment.receipt_url || null);
    }
  }, [assignment]);

  if (!isOpen || !assignment) return null;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: 'item-' + Date.now() + Math.random(), item_name: '', quantity: '', price: '' },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof ItemRow, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setReceiptPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const totalSpent = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  const remainingBalance = assignment.assigned_amount - totalSpent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate items
    const validItems: BazarItem[] = [];
    for (const item of items) {
      if (!item.item_name.trim()) continue;
      const numPrice = parseFloat(item.price);
      if (isNaN(numPrice) || numPrice < 0) {
        setError(`Please enter a valid price for "${item.item_name}".`);
        return;
      }
      validItems.push({
        id: item.id,
        item_name: item.item_name.trim(),
        quantity: item.quantity.trim() || undefined,
        price: numPrice,
      });
    }

    if (validItems.length === 0) {
      setError('Please add at least one item with a valid price.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let receiptUrl = assignment.receipt_url || undefined;
      if (receiptFile) {
        receiptUrl = (await uploadReceiptImage(receiptFile)) || undefined;
      }

      await submitBazarReport({
        assignment_id: assignment.id,
        items: validItems,
        total_spent: totalSpent,
        submission_note: submissionNote,
        receipt_url: receiptUrl,
        actor_id: assignment.assigned_to,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingBag size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Submit Bazar Report</h3>
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

            {/* Assignment Info Header */}
            <div style={{
              background: 'rgba(11, 15, 25, 0.6)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Date</span>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatDate(assignment.assigned_date)}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Amount</span>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--brand-primary)' }}>
                  {formatCurrency(assignment.assigned_amount)}
                </div>
              </div>
            </div>

            {/* Dynamic Items Table */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                  Items Breakdown
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', gap: '0.25rem' }}
                >
                  <Plus size={13} /> Add Item
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 100px 110px 32px',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="text"
                      className="form-control"
                      placeholder={`Item #${idx + 1} (e.g. Potato)`}
                      value={item.item_name}
                      onChange={(e) => handleItemChange(item.id, 'item_name', e.target.value)}
                      required
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Qty (2 kg)"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      placeholder="Price ৳"
                      value={item.price}
                      onChange={(e) => handleItemChange(item.id, 'price', e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.35rem', color: 'var(--color-debt)' }}
                      disabled={items.length <= 1}
                      title="Remove Item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary Card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
              textAlign: 'center',
              marginBottom: '1rem',
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned</span>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', marginTop: '0.15rem' }}>
                  {formatCurrency(assignment.assigned_amount)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Spent</span>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--accent-indigo)', marginTop: '0.15rem' }}>
                  {formatCurrency(totalSpent)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {remainingBalance >= 0 ? 'To Return' : 'Overspent'}
                </span>
                <div style={{
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  color: remainingBalance > 0 ? '#fbbf24' : remainingBalance === 0 ? 'var(--brand-primary)' : 'var(--color-debt)',
                  marginTop: '0.15rem',
                }}>
                  {formatCurrency(Math.abs(remainingBalance))}
                </div>
              </div>
            </div>

            {/* Receipt Upload & Notes */}
            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">Receipt (Optional)</label>
                <div style={{
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem',
                  textAlign: 'center',
                  position: 'relative',
                  cursor: 'pointer',
                  background: 'rgba(255, 255, 255, 0.02)',
                }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                    }}
                  />
                  {receiptPreview ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <img
                        src={receiptPreview}
                        alt="Receipt"
                        style={{ height: '30px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--brand-primary)' }}>Receipt Attached</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                      <Upload size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Upload Image</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Market was crowded"
                  value={submissionNote}
                  onChange={(e) => setSubmissionNote(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
