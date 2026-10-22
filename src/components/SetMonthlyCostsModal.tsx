import React, { useState, useEffect } from 'react';
import {
  X,
  Home,
  Receipt,
  Plus,
  Trash2,
  DollarSign,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import { getMonthlyCostsConfig, saveMonthlyCostsConfig } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import type { FixedCostItem, FixedCostCategory } from '../types';

interface SetMonthlyCostsModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: string; // YYYY-MM
  onSuccess: () => void;
}

export const SetMonthlyCostsModal: React.FC<SetMonthlyCostsModalProps> = ({
  isOpen,
  onClose,
  period,
  onSuccess,
}) => {
  const { activeSystem, members, settings } = useMealSystem();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'fixed' | 'rent'>('fixed');
  const [fixedCosts, setFixedCosts] = useState<{ id?: string; title: string; amount: number; category: FixedCostCategory }[]>([]);
  const [memberRents, setMemberRents] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeMembers = members.filter((m) => m.status === 'active');
  const memberCount = activeMembers.length || 1;

  useEffect(() => {
    if (!isOpen || !activeSystem) return;

    async function loadConfig() {
      try {
        setLoading(true);
        setError(null);
        const config = await getMonthlyCostsConfig(activeSystem!.id, period);

        if (config.fixedCosts.length > 0) {
          setFixedCosts(config.fixedCosts);
        } else {
          // Initialize with standard empty presets for easy filling
          setFixedCosts([
            { id: '1', title: 'Cook (Khala) Bill', amount: 0, category: 'cook' },
            { id: '2', title: 'WiFi / Internet', amount: 0, category: 'wifi' },
            { id: '3', title: 'Electricity / Utility', amount: 0, category: 'electricity' },
            { id: '4', title: 'Gas Bill', amount: 0, category: 'gas' },
            { id: '5', title: 'Waste Disposal', amount: 0, category: 'waste' },
          ]);
        }

        // Initialize member rents
        const rents: Record<string, number> = {};
        activeMembers.forEach((m) => {
          rents[m.user_id] = config.memberRents[m.user_id] || 0;
        });
        setMemberRents(rents);
      } catch (err) {
        console.error('Failed to load costs config:', err);
        setError('Could not load existing costs.');
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [isOpen, activeSystem?.id, period, members.length]);

  if (!isOpen) return null;

  const totalFixedCost = fixedCosts.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const perMemberFixedCost = Math.round((totalFixedCost / memberCount) * 100) / 100;
  const totalHouseRent = Object.values(memberRents).reduce((sum, r) => sum + (Number(r) || 0), 0);

  const handleAddFixedCost = () => {
    setFixedCosts([
      ...fixedCosts,
      { id: 'fc-' + Date.now(), title: '', amount: 0, category: 'other' },
    ]);
  };

  const handleRemoveFixedCost = (index: number) => {
    setFixedCosts(fixedCosts.filter((_, i) => i !== index));
  };

  const handleUpdateFixedCost = (index: number, field: string, value: any) => {
    const updated = [...fixedCosts];
    updated[index] = { ...updated[index], [field]: value };
    setFixedCosts(updated);
  };

  const handleUpdateRent = (memberId: string, rentValue: string) => {
    const val = parseFloat(rentValue);
    setMemberRents({
      ...memberRents,
      [memberId]: isNaN(val) ? 0 : val,
    });
  };

  const handleSave = async () => {
    if (!activeSystem || !user) return;
    try {
      setSaving(true);
      setError(null);

      // Filter out empty rows
      const validFixedCosts = fixedCosts.filter((f) => f.title.trim() !== '' && f.amount >= 0);

      await saveMonthlyCostsConfig(
        activeSystem.id,
        period,
        {
          fixedCosts: validFixedCosts,
          memberRents,
        },
        user.id
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save monthly costs:', err);
      setError(err?.message || 'Failed to save monthly costs configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '1rem', borderBottom: '1px solid var(--border-card)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <Home size={20} color="var(--brand-primary)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Monthly Fixed Costs & House Rent</h2>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Period: <strong style={{ color: 'var(--text-main)' }}>{period}</strong> • Fixed costs are split equally; room rent varies per member.
            </p>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0 0.5rem 0', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('fixed')}
            className={`btn btn-sm ${activeTab === 'fixed' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, border: 'none' }}
          >
            <Receipt size={14} /> Shared Fixed Costs (Equal for All)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rent')}
            className={`btn btn-sm ${activeTab === 'rent' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, border: 'none' }}
          >
            <Home size={14} /> House Rent (Varies Per Member)
          </button>
        </div>

        {error && (
          <div style={{ margin: '0.75rem 0', padding: '0.75rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-debt)', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem', marginTop: '0.5rem' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading costs configuration...
            </div>
          ) : activeTab === 'fixed' ? (
            <div>
              {/* Highlight summary card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(31, 41, 55, 0.5) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Total Shared Fixed Costs
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-primary)' }}>
                    {formatCurrency(totalFixedCost, settings?.currency_symbol)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Equal Share Per Member ({memberCount} members)
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-teal)' }}>
                    {formatCurrency(perMemberFixedCost, settings?.currency_symbol)} / person
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {fixedCosts.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                      background: 'rgba(11, 15, 25, 0.5)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Cook (Khala) Bill, WiFi, Electricity"
                      value={item.title}
                      onChange={(e) => handleUpdateFixedCost(idx, 'title', e.target.value)}
                      style={{ flex: 2, padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                    />
                    <select
                      className="form-control"
                      value={item.category}
                      onChange={(e) => handleUpdateFixedCost(idx, 'category', e.target.value)}
                      style={{ flex: 1.2, padding: '0.45rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      <option value="cook">Cook / Khala</option>
                      <option value="wifi">WiFi / Internet</option>
                      <option value="electricity">Electricity</option>
                      <option value="gas">Gas / Cylinder</option>
                      <option value="waste">Waste / Cleaner</option>
                      <option value="cleaning">Cleaning Supplies</option>
                      <option value="other">Other Fixed Bill</option>
                    </select>
                    <div style={{ position: 'relative', width: '120px' }}>
                      <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {settings?.currency_symbol || '৳'}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-control"
                        placeholder="0.00"
                        value={item.amount === 0 ? '' : item.amount}
                        onChange={(e) => handleUpdateFixedCost(idx, 'amount', parseFloat(e.target.value) || 0)}
                        style={{ padding: '0.45rem 0.5rem 0.45rem 1.6rem', fontSize: '0.85rem', textAlign: 'right' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFixedCost(idx)}
                      className="btn-icon"
                      style={{ color: 'var(--color-debt)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.4rem' }}
                      title="Remove cost item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddFixedCost}
                className="btn btn-outline btn-sm"
                style={{ marginTop: '0.75rem', width: '100%', borderStyle: 'dashed' }}
              >
                <Plus size={14} /> Add Another Fixed Cost Item
              </button>
            </div>
          ) : (
            <div>
              {/* House Rent Summary Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(31, 41, 55, 0.5) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Total Monthly House Rent
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-indigo)' }}>
                    {formatCurrency(totalHouseRent, settings?.currency_symbol)}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '280px', textAlign: 'right' }}>
                  Each member pays their own room/seat rent according to room allocation.
                </div>
              </div>

              {/* Members Rent Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {activeMembers.map((mem) => {
                  const currentRent = memberRents[mem.user_id] ?? 0;
                  return (
                    <div
                      key={mem.user_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(11, 15, 25, 0.5)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: '#fff',
                        }}>
                          {(mem.profile?.full_name || 'M').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {mem.profile?.full_name || 'Member'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            Role: {mem.role}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Room Rent:</span>
                        <div style={{ position: 'relative', width: '130px' }}>
                          <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                            {settings?.currency_symbol || '৳'}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="form-control"
                            placeholder="0.00"
                            value={currentRent === 0 ? '' : currentRent}
                            onChange={(e) => handleUpdateRent(mem.user_id, e.target.value)}
                            style={{ padding: '0.45rem 0.5rem 0.45rem 1.6rem', fontSize: '0.9rem', textAlign: 'right', fontWeight: 600 }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-card)', marginTop: '1rem' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="btn btn-primary btn-sm" disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save Costs & Update Balances'}
          </button>
        </div>
      </div>
    </div>
  );
};
