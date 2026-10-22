import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  RotateCcw,
  Sliders,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import {
  getDeposits,
  reverseDeposit,
  getFinancialLedger,
  recordAdjustment,
  getMonthlyAccountingSummary,
} from '../services/api';
import { AddDepositModal } from '../components/AddDepositModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { formatCurrency, formatDate, getDhakaTodayDateString } from '../utils/formatters';
import type { Deposit, FinancialLedgerEntry, MonthlyAccountingSummary } from '../types';

export const DepositsPage: React.FC = () => {
  const { activeSystem, activeRole, members, settings } = useMealSystem();
  const { user } = useAuth();

  const currentPeriod = getDhakaTodayDateString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod);
  const [activeTab, setActiveTab] = useState<'deposits' | 'ledger'>('deposits');
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [ledger, setLedger] = useState<FinancialLedgerEntry[]>([]);
  const [accounting, setAccounting] = useState<MonthlyAccountingSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [memberFilter, setMemberFilter] = useState<string>('all');

  const [showAddDepositModal, setShowAddDepositModal] = useState<boolean>(false);

  // Adjustment modal state (Manager only)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<boolean>(false);
  const [adjMemberId, setAdjMemberId] = useState<string>(members[0]?.user_id || '');
  const [adjAmount, setAdjAmount] = useState<string>('');
  const [adjType, setAdjType] = useState<'credit' | 'debit'>('credit');
  const [adjReason, setAdjReason] = useState<string>('');
  const [adjLoading, setAdjLoading] = useState<boolean>(false);

  const loadData = async () => {
    if (!activeSystem) return;
    try {
      setLoading(true);
      const [deps, ledg, summary] = await Promise.all([
        getDeposits(activeSystem.id, selectedPeriod),
        getFinancialLedger(activeSystem.id, selectedPeriod),
        getMonthlyAccountingSummary(activeSystem.id, selectedPeriod),
      ]);
      setDeposits(deps);
      setLedger(ledg);
      setAccounting(summary);
    } catch (err) {
      console.error('Failed to load financial records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSystem) {
      setLoading(false);
      return;
    }
    loadData();
  }, [activeSystem?.id, selectedPeriod]);

  // Manager reverse deposit
  const handleReverseDeposit = async (dep: Deposit) => {
    if (activeRole !== 'manager' || !user) return;
    const reason = window.prompt(
      `Enter mandatory reversal reason for deposit of ৳${dep.amount} from ${dep.member_name}:`
    );
    if (!reason || !reason.trim()) return;

    try {
      await reverseDeposit(dep.id, reason.trim(), user.id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to reverse deposit');
    }
  };

  // Submit financial adjustment
  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSystem || !user || activeRole !== 'manager') return;

    const num = parseFloat(adjAmount);
    if (isNaN(num) || num <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!adjReason.trim()) {
      alert('Please provide a mandatory reason for the balance adjustment.');
      return;
    }

    try {
      setAdjLoading(true);
      const finalAmount = adjType === 'credit' ? num : -num;
      await recordAdjustment(
        activeSystem.id,
        adjMemberId,
        finalAmount,
        adjReason.trim(),
        selectedPeriod,
        user.id
      );
      setShowAdjustmentModal(false);
      setAdjAmount('');
      setAdjReason('');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to create adjustment');
    } finally {
      setAdjLoading(false);
    }
  };

  // Filtered deposits
  const filteredDeposits = deposits.filter((d) => {
    return memberFilter === 'all' || d.member_id === memberFilter;
  });

  // Filtered ledger
  const filteredLedger = ledger.filter((l) => {
    return memberFilter === 'all' || l.member_id === memberFilter;
  });

  const totalDeposits = deposits
    .filter((d) => !d.is_reversed)
    .reduce((sum, d) => sum + d.amount, 0);

  if (loading) {
    return <LoadingSpinner message="Loading..." />;
  }

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
          <h1>Deposits & Ledger</h1>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="month"
            className="form-control"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{ width: 'auto', padding: '0.5rem 0.75rem' }}
          />

          {activeRole === 'manager' && (
            <>
              <button
                onClick={() => setShowAdjustmentModal(true)}
                className="btn btn-secondary btn-sm"
              >
                <Sliders size={14} /> New Adjustment
              </button>
              <button
                onClick={() => setShowAddDepositModal(true)}
                className="btn btn-primary btn-sm"
              >
                <Plus size={14} /> Log Member Deposit
              </button>
            </>
          )}
        </div>
      </div>

      {/* TOTAL FUND IN ACCOUNT & CASH IN HAND OVERVIEW */}
      <div className="grid-cols-4" style={{ marginBottom: '1.75rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--brand-primary)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Fund in Account</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: (accounting?.fund_balance_remaining ?? 0) >= 0 ? 'var(--brand-primary)' : 'var(--color-debt)', margin: '0.2rem 0' }}>
            {formatCurrency(accounting?.fund_balance_remaining, settings?.currency_symbol)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Cash in hand after expenses
          </span>
        </div>

        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Deposits Collected</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-indigo)', margin: '0.2rem 0' }}>
            {formatCurrency(totalDeposits, settings?.currency_symbol)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {deposits.filter((d) => !d.is_reversed).length} verified deposits
          </span>
        </div>

        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Fund Spent</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-debt)', margin: '0.2rem 0' }}>
            {formatCurrency(accounting?.total_shared_fund_spent, settings?.currency_symbol)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Shared bazar & fixed bills
          </span>
        </div>

        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Outstanding Dues</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-warning)', margin: '0.2rem 0' }}>
            {formatCurrency(accounting?.total_amount_due, settings?.currency_symbol)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Owed by members for {selectedPeriod}
          </span>
        </div>
      </div>

      {/* Navigation Tabs & Member Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-md)',
          padding: '0.25rem',
        }}>
          <button
            onClick={() => setActiveTab('deposits')}
            className={`btn btn-sm ${activeTab === 'deposits' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            Deposits
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`btn btn-sm ${activeTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            Ledger
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Member:</span>
          <select
            className="form-control"
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            style={{ width: 'auto', padding: '0.4rem 0.75rem' }}
          >
            <option value="all">All Members</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profile?.full_name || m.user_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TAB 1: MEMBER DEPOSITS */}
      {activeTab === 'deposits' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3>Deposits for {selectedPeriod}</h3>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Total: <strong style={{ color: 'var(--brand-primary)', fontSize: '1.15rem' }}>{formatCurrency(totalDeposits, settings?.currency_symbol)}</strong>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner message="Loading deposit transactions..." />
          ) : filteredDeposits.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No Deposits Logged"
              description={`No member deposits recorded for ${selectedPeriod}.`}
              actionText={activeRole === 'manager' ? 'Log First Deposit' : undefined}
              onAction={activeRole === 'manager' ? () => setShowAddDepositModal(true) : undefined}
            />
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Member</th>
                    <th>Payment Method</th>
                    <th>Transaction Reference</th>
                    <th>Note</th>
                    <th>Recorded By</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    {activeRole === 'manager' && <th style={{ textAlign: 'center' }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredDeposits.map((dep) => (
                    <tr
                      key={dep.id}
                      style={{
                        opacity: dep.is_reversed ? 0.6 : 1,
                        textDecoration: dep.is_reversed ? 'line-through' : 'none',
                      }}
                    >
                      <td>{formatDate(dep.date)}</td>
                      <td style={{ fontWeight: 600 }}>{dep.member_name}</td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(31, 41, 55, 0.8)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)' }}>
                          {dep.payment_method.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                        {dep.transaction_reference || 'N/A'}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {dep.note || '—'}
                        {dep.is_reversed && (
                          <div style={{ color: 'var(--color-debt)', fontSize: '0.75rem', textDecoration: 'none' }}>
                            REVERSED: {dep.reversal_reason}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {dep.recorder_name || 'Manager'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--brand-primary)', fontSize: '1rem' }}>
                        +{formatCurrency(dep.amount, settings?.currency_symbol)}
                      </td>
                      {activeRole === 'manager' && (
                        <td style={{ textAlign: 'center' }}>
                          {!dep.is_reversed && (
                            <button
                              onClick={() => handleReverseDeposit(dep)}
                              className="btn btn-secondary btn-sm"
                              title="Reverse deposit"
                              style={{ padding: '0.25rem 0.5rem', color: 'var(--color-debt)' }}
                            >
                              <RotateCcw size={12} /> Reverse
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UNIFIED FINANCIAL LEDGER */}
      {activeTab === 'ledger' && (
        <div className="card">
          <div style={{ marginBottom: '1rem' }}>
            <h3>Unified Financial Ledger ({selectedPeriod})</h3>
            <p>Single source of truth accounting ledger containing opening balances, deposits, personal bazar credits, adjustments, and reversals.</p>
          </div>

          {loading ? (
            <LoadingSpinner message="Loading financial ledger..." />
          ) : filteredLedger.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No Ledger Entries"
              description={`No accounting transactions recorded in the ledger for ${selectedPeriod}.`}
            />
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Member</th>
                    <th>Transaction Type</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Ledger Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.date)}</td>
                      <td style={{ fontWeight: 600 }}>{entry.member_name}</td>
                      <td>
                        <span className={`badge ${entry.amount >= 0 ? 'badge-credit' : 'badge-debt'}`}>
                          {entry.transaction_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>{entry.description}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: entry.amount >= 0 ? 'var(--color-credit)' : 'var(--color-debt)' }}>
                        {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount, settings?.currency_symbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Deposit Modal */}
      <AddDepositModal
        isOpen={showAddDepositModal}
        onClose={() => setShowAddDepositModal(false)}
        onSuccess={() => loadData()}
      />

      {/* Financial Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="modal-overlay" onClick={() => setShowAdjustmentModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem' }}>Make Financial Balance Adjustment</h3>
              <button onClick={() => setShowAdjustmentModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdjustment}>
              <div className="modal-body">
                <div style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  color: '#a5b4fc',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                }}>
                  Adjustments allow the manager to correct member balances with an explicit audit justification, avoiding silent data overwrites.
                </div>

                <div className="form-group">
                  <label className="form-label">Member</label>
                  <select
                    className="form-control"
                    value={adjMemberId}
                    onChange={(e) => setAdjMemberId(e.target.value)}
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
                    <label className="form-label">Adjustment Type</label>
                    <select
                      className="form-control"
                      value={adjType}
                      onChange={(e) => setAdjType(e.target.value as any)}
                    >
                      <option value="credit">Credit (+) Increase Member Balance</option>
                      <option value="debit">Debit (−) Decrease Member Balance</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Amount (BDT ৳)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-control"
                      placeholder="0.00"
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason / Justification (Mandatory)</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="e.g. Compensating member for shared cooking supplies purchased outside bazar"
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowAdjustmentModal(false)} className="btn btn-secondary btn-sm" disabled={adjLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={adjLoading}>
                  {adjLoading ? 'Saving...' : 'Post Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
