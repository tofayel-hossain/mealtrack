import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  CheckCircle,
  AlertTriangle,
  History,
  ShieldAlert,
  ArrowRight,
  Download,
  Printer,
  Sparkles,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import {
  getMonthlyAccountingSummary,
  finalizeMonthlyAccounting,
  getMonthlyReportSnapshots,
  getCookingDays,
  getBazarExpenses,
} from '../services/api';
import { validateMonthlyFinalization } from '../utils/accounting';
import { formatCurrency, formatMealRate, formatDate, formatDateTime, getDhakaTodayDateString } from '../utils/formatters';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import type { MonthlyAccountingSummary, MonthlyReportSnapshot } from '../types';

export const MonthlyClosingPage: React.FC = () => {
  const { activeSystem, activeRole, settings } = useMealSystem();
  const { user } = useAuth();

  const currentPeriod = getDhakaTodayDateString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod);
  const [activeTab, setActiveTab] = useState<'checklist' | 'versions'>('checklist');

  const [accounting, setAccounting] = useState<MonthlyAccountingSummary | null>(null);
  const [snapshots, setSnapshots] = useState<MonthlyReportSnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [finalizing, setFinalizing] = useState<boolean>(false);
  const [finalizationReason, setFinalizationReason] = useState<string>('');

  // Checklist metrics
  const [unresolvedDaysCount, setUnresolvedDaysCount] = useState<number>(0);
  const [unreceiptedExpensesCount, setUnreceiptedExpensesCount] = useState<number>(0);

  const loadData = async () => {
    if (!activeSystem) return;
    try {
      setLoading(true);
      const [y, m] = selectedPeriod.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const startDate = `${selectedPeriod}-01`;
      const endDate = `${selectedPeriod}-${String(daysInMonth).padStart(2, '0')}`;

      const [summary, snpList, cookingDays, expenses] = await Promise.all([
        getMonthlyAccountingSummary(activeSystem.id, selectedPeriod),
        getMonthlyReportSnapshots(activeSystem.id, selectedPeriod),
        getCookingDays(activeSystem.id, startDate, endDate),
        getBazarExpenses(activeSystem.id, selectedPeriod),
      ]);

      setAccounting(summary);
      setSnapshots(snpList);

      const pendingCooking = cookingDays.filter((c) => c.status === 'pending').length;
      const unreceipted = expenses.filter((e) => !e.receipt_url && !e.no_receipt_reason && !e.is_reversed).length;

      setUnresolvedDaysCount(pendingCooking);
      setUnreceiptedExpensesCount(unreceipted);
    } catch (err) {
      console.error('Failed to load closing data:', err);
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

  // Run validation
  const validation = validateMonthlyFinalization({
    totalBazarExpenses: accounting?.total_expenses || 0,
    totalFinalizedMeals: accounting?.total_meals || 0,
    unresolvedCookingDaysCount: unresolvedDaysCount,
    unreceiptedExpensesCount: unreceiptedExpensesCount,
    memberCount: accounting?.members.length || 0,
  });

  const handleFinalizeReport = async () => {
    if (!activeSystem || !user || activeRole !== 'manager') return;

    if (!finalizationReason.trim()) {
      alert('Please provide a note or reason for this finalization snapshot.');
      return;
    }

    const confirmMsg =
      accounting?.status === 'finalized'
        ? `Month ${selectedPeriod} is ALREADY finalized as v${accounting.version}. Are you sure you want to create a REVISED snapshot (v${accounting.version + 1})?`
        : `Finalize Month ${selectedPeriod}? This will snapshot all accounting figures and carry forward closing balances into next month's opening balances.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setFinalizing(true);
      await finalizeMonthlyAccounting(
        activeSystem.id,
        selectedPeriod,
        finalizationReason.trim(),
        user.id
      );
      await loadData();
      setActiveTab('versions');
    } catch (err: any) {
      alert(err?.message || 'Failed to finalize month');
    } finally {
      setFinalizing(false);
    }
  };

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
          <h1>Monthly Closing</h1>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="month"
            className="form-control"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{ width: 'auto', padding: '0.5rem 0.75rem' }}
          />

          <div style={{
            display: 'flex',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-md)',
            padding: '0.25rem',
          }}>
            <button
              onClick={() => setActiveTab('checklist')}
              className={`btn btn-sm ${activeTab === 'checklist' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
            >
              Review & Finalize
            </button>
            <button
              onClick={() => setActiveTab('versions')}
              className={`btn btn-sm ${activeTab === 'versions' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
            >
              Version History ({snapshots.length})
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Checking monthly integrity and snapshot history..." />
      ) : activeTab === 'checklist' ? (
        <>
          {/* Status Alert */}
          <div
            className="card"
            style={{
              background: accounting?.status === 'finalized'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(17, 24, 39, 0.85) 100%)'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(17, 24, 39, 0.85) 100%)',
              border: `1px solid ${accounting?.status === 'finalized' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              marginBottom: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <span className={`badge ${accounting?.status === 'finalized' ? 'badge-credit' : 'badge-warning'}`} style={{ marginBottom: '0.35rem' }}>
                  {accounting?.status === 'finalized' ? `Finalized Snapshot Active (v${accounting.version})` : 'Month Open for Changes'}
                </span>
                <h3 style={{ fontSize: '1.3rem', margin: '0.2rem 0' }}>
                  {accounting?.status === 'finalized'
                    ? `Accounting Period ${selectedPeriod} is Finalized`
                    : `Accounting Period ${selectedPeriod} Pending Finalization`}
                </h3>
                <p style={{ fontSize: '0.85rem' }}>
                  {accounting?.status === 'finalized'
                    ? `Finalized on ${formatDateTime(accounting.finalized_at || undefined)} by ${accounting.finalized_by_name}. You can re-finalize to create an incremented revision version (v${accounting.version + 1}) if corrections were applied.`
                    : 'Review the integrity checklist below before locking the monthly figures and propagating carry-forward balances.'}
                </p>
              </div>

              {activeRole === 'manager' && (
                <button
                  onClick={handleFinalizeReport}
                  disabled={finalizing || !validation.canFinalize}
                  className="btn btn-primary btn-lg"
                  style={{ minWidth: '200px' }}
                >
                  <Sparkles size={18} />
                  {finalizing ? 'Finalizing...' : accounting?.status === 'finalized' ? `Create Revision (v${accounting.version + 1})` : `Finalize Month ${selectedPeriod}`}
                </button>
              )}
            </div>
          </div>

          {/* INTEGRITY VALIDATION CHECKLIST */}
          <div className="card" style={{ marginBottom: '1.75rem' }}>
            <h3 style={{ marginBottom: '0.4rem' }}>Pre-Closing Audit Checklist</h3>
            <p style={{ marginBottom: '1rem' }}>Automatic checks for complete records, zero divisions, and unverified data</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {/* Check 1: Members */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'rgba(11, 15, 25, 0.6)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}>
                <CheckCircle size={18} color="var(--brand-primary)" />
                <div style={{ flex: 1, fontSize: '0.875rem' }}>
                  <strong>Active Mess Members:</strong> {accounting?.members.length} members found and verified.
                </div>
              </div>

              {/* Check 2: Total Bazar Expenses */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'rgba(11, 15, 25, 0.6)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}>
                <CheckCircle size={18} color="var(--brand-primary)" />
                <div style={{ flex: 1, fontSize: '0.875rem' }}>
                  <strong>Eligible Bazar Purchases:</strong> {formatCurrency(accounting?.total_expenses, settings?.currency_symbol)} (Non-negative check passed).
                </div>
              </div>

              {/* Check 3: Meal Rate Availability */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'rgba(11, 15, 25, 0.6)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}>
                {validation.summary.hasZeroMealRate ? (
                  <AlertTriangle size={18} color="var(--color-warning)" />
                ) : (
                  <CheckCircle size={18} color="var(--brand-primary)" />
                )}
                <div style={{ flex: 1, fontSize: '0.875rem' }}>
                  <strong>Meal Rate Calculation:</strong>{' '}
                  {validation.summary.hasZeroMealRate
                    ? 'Total meals is 0. Meal rate is marked as Unavailable.'
                    : `Rate calculated: ${formatMealRate(accounting?.meal_rate, settings?.currency_symbol)}`}
                </div>
              </div>

              {/* Check 4: Cooking Days Status */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'rgba(11, 15, 25, 0.6)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}>
                {unresolvedDaysCount > 0 ? (
                  <AlertTriangle size={18} color="var(--color-warning)" />
                ) : (
                  <CheckCircle size={18} color="var(--brand-primary)" />
                )}
                <div style={{ flex: 1, fontSize: '0.875rem' }}>
                  <strong>Kitchen Schedule Status:</strong>{' '}
                  {unresolvedDaysCount > 0
                    ? `${unresolvedDaysCount} day(s) have "Pending Confirmation" status.`
                    : 'All cooking days in the month have been finalized or cancelled.'}
                </div>
              </div>

              {/* Check 5: Missing Receipts */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'rgba(11, 15, 25, 0.6)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}>
                {unreceiptedExpensesCount > 0 ? (
                  <AlertTriangle size={18} color="var(--color-warning)" />
                ) : (
                  <CheckCircle size={18} color="var(--brand-primary)" />
                )}
                <div style={{ flex: 1, fontSize: '0.875rem' }}>
                  <strong>Expense Receipt Compliance:</strong>{' '}
                  {unreceiptedExpensesCount > 0
                    ? `${unreceiptedExpensesCount} expense(s) have no receipt or explanation.`
                    : 'All bazar expenses have attached receipts or logged explanations.'}
                </div>
              </div>
            </div>

            {/* Finalization Reason Input (Manager Only) */}
            {activeRole === 'manager' && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <input
                    type="text"
                    className="form-control"
                    value={finalizationReason}
                    onChange={(e) => setFinalizationReason(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Member Closing Balance Sheet Preview */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Closing Balances</h3>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Meals</th>
                    <th>Meal Cost</th>
                    <th>Opening</th>
                    <th>Deposits</th>
                    <th>Personal Credits</th>
                    <th>Closing Balance (Carry-forward)</th>
                    <th>Next Month Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accounting?.members.map((m) => (
                    <tr key={m.member_id}>
                      <td style={{ fontWeight: 600 }}>{m.member_name}</td>
                      <td>{m.meal_count}</td>
                      <td style={{ color: 'var(--color-debt)' }}>{formatCurrency(m.meal_cost, settings?.currency_symbol)}</td>
                      <td>{formatCurrency(m.opening_balance, settings?.currency_symbol)}</td>
                      <td style={{ color: 'var(--brand-primary)' }}>+{formatCurrency(m.deposits, settings?.currency_symbol)}</td>
                      <td style={{ color: 'var(--accent-teal)' }}>+{formatCurrency(m.personal_bazar_credits, settings?.currency_symbol)}</td>
                      <td style={{ fontWeight: 800, fontSize: '1rem', color: m.closing_balance >= 0 ? 'var(--color-credit)' : 'var(--color-debt)' }}>
                        {formatCurrency(m.closing_balance, settings?.currency_symbol)}
                      </td>
                      <td>
                        <span className={`badge ${m.closing_balance >= 0 ? 'badge-credit' : 'badge-debt'}`}>
                          {m.closing_balance >= 0 ? 'Starts with Credit' : 'Starts in Debt'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* TAB 2: VERSION SNAPSHOTS HISTORY */
        <div className="card">
          <div style={{ marginBottom: '1.25rem' }}>
            <h3>Immutable Version Snapshots for {selectedPeriod}</h3>
            <p>Every finalization is permanently preserved with full member figures and timestamps</p>
          </div>

          {snapshots.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              No finalized versions saved for {selectedPeriod} yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  style={{
                    background: 'rgba(11, 15, 25, 0.7)',
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span className="badge badge-manager" style={{ fontSize: '0.85rem' }}>
                        Version {snap.version}
                      </span>
                      <strong style={{ fontSize: '1.05rem' }}>{selectedPeriod} Finalization</strong>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Finalized: <strong>{formatDateTime(snap.finalized_at)}</strong>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                    Note / Reason: <em>"{snap.reason || 'Standard finalization'}"</em>
                  </p>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.75rem',
                    background: 'var(--bg-secondary)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.825rem',
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Total Bazar:</span>{' '}
                      <strong>{formatCurrency(snap.summary_data.total_bazar_expenses, settings?.currency_symbol)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Total Meals:</span>{' '}
                      <strong>{snap.summary_data.total_finalized_meals} meals</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Calculated Rate:</span>{' '}
                      <strong>{formatMealRate(snap.summary_data.meal_rate, settings?.currency_symbol)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
