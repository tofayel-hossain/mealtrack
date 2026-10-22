import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  UtensilsCrossed,
  ShoppingBag,
  Wallet,
  Shield,
  FileCheck2,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { getMonthlyAccountingSummary, getBazarExpenses } from '../services/api';
import { formatCurrency, formatMealRate, formatDate, formatDateTime, getDhakaTodayDateString } from '../utils/formatters';
import { exportMonthlySummaryToCsv } from '../utils/csvExport';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import type { MonthlyAccountingSummary, BazarExpense } from '../types';

export const ReportsPage: React.FC = () => {
  const { activeSystem, settings } = useMealSystem();
  const currentPeriod = getDhakaTodayDateString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod);
  const [accounting, setAccounting] = useState<MonthlyAccountingSummary | null>(null);
  const [expenses, setExpenses] = useState<BazarExpense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadReport = async () => {
    if (!activeSystem) return;
    try {
      setLoading(true);
      const [summary, expList] = await Promise.all([
        getMonthlyAccountingSummary(activeSystem.id, selectedPeriod),
        getBazarExpenses(activeSystem.id, selectedPeriod),
      ]);
      setAccounting(summary);
      setExpenses(expList.filter((e) => !e.is_reversed));
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSystem) {
      setLoading(false);
      return;
    }
    loadReport();
  }, [activeSystem?.id, selectedPeriod]);

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
      {/* Header (Hidden on print) */}
      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <h1>Monthly Report</h1>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="month"
            className="form-control"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{ width: 'auto', padding: '0.5rem 0.75rem' }}
          />

          <button
            onClick={() => {
              if (accounting) {
                exportMonthlySummaryToCsv(
                  selectedPeriod,
                  accounting.members,
                  accounting.total_expenses,
                  accounting.total_meals,
                  accounting.meal_rate
                );
              }
            }}
            className="btn btn-secondary btn-sm"
            disabled={!accounting || accounting.members.length === 0}
          >
            <Download size={14} /> Export CSV
          </button>

          <button onClick={() => window.print()} className="btn btn-primary btn-sm">
            <Printer size={14} /> Print Statement
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Generating transparent monthly report..." />
      ) : (
        <div className="printable-report" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Print Report Header */}
          <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--brand-primary)', fontWeight: 800, letterSpacing: '0.05em' }}>
              Monthly Statement
            </div>
            <h2 style={{ fontSize: '1.75rem', margin: '0.35rem 0' }}>{activeSystem?.name}</h2>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Mess Code: <strong>{activeSystem?.code}</strong> • Accounting Period: <strong>{selectedPeriod}</strong> • Currency: <strong>{settings?.currency_code || ''}</strong>
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--brand-primary)', marginTop: '0.35rem', fontWeight: 600 }}>
              Day-by-Day Accounting: {accounting?.days_elapsed ?? 0} of {accounting?.total_days_in_period ?? 30} days elapsed (Opened: {formatDate(accounting?.meal_open_date)})
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
              Generated on {formatDateTime(new Date())}
            </div>
          </div>

          {/* Key Figures Header Bar */}
          <div className="grid-cols-4">
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Fund in Account</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: (accounting?.fund_balance_remaining ?? 0) >= 0 ? 'var(--brand-primary)' : 'var(--color-debt)', marginTop: '0.2rem' }}>
                {formatCurrency(accounting?.fund_balance_remaining, settings?.currency_symbol)}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Cash in Hand after expenses</span>
            </div>

            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Bazar Expenses</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {formatCurrency(accounting?.total_expenses, settings?.currency_symbol)}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Rate: {formatMealRate(accounting?.meal_rate, settings?.currency_symbol)}/meal</span>
            </div>

            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shared Fixed Bills</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-teal)', marginTop: '0.2rem' }}>
                {formatCurrency(accounting?.total_fixed_costs, settings?.currency_symbol)}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{formatCurrency(accounting?.per_member_fixed_cost, settings?.currency_symbol)} / person</span>
            </div>

            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Outstanding Dues</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: '0.2rem' }}>
                {formatCurrency(accounting?.total_amount_due, settings?.currency_symbol)}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>To collect from members</span>
            </div>
          </div>

          {/* MEMBER BALANCE STATEMENT TABLE */}
          <div className="card">
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1.15rem' }}>1. Member Balances & Cost Allocation</h3>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Meals ({accounting?.days_elapsed ?? 0}d)</th>
                    <th>Meal Cost</th>
                    <th>Shared Bills (Fix)</th>
                    <th>Room Rent</th>
                    <th>Total Billed</th>
                    <th>Deposits</th>
                    <th>Bazar Shopped</th>
                    <th>Closing Bal</th>
                    <th style={{ textAlign: 'right' }}>Need to Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {accounting?.members.map((m) => {
                    return (
                      <tr key={m.member_id}>
                        <td style={{ fontWeight: 700 }}>{m.member_name}</td>
                        <td>{m.meal_count}</td>
                        <td>{formatCurrency(m.meal_cost, settings?.currency_symbol)}</td>
                        <td style={{ color: 'var(--accent-teal)' }}>{formatCurrency(m.shared_fixed_cost, settings?.currency_symbol)}</td>
                        <td style={{ color: 'var(--accent-indigo)' }}>{formatCurrency(m.house_rent, settings?.currency_symbol)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-debt)' }}>{formatCurrency(m.total_billed, settings?.currency_symbol)}</td>
                        <td style={{ color: 'var(--brand-primary)' }}>+{formatCurrency(m.deposits, settings?.currency_symbol)}</td>
                        <td style={{ color: 'var(--accent-teal)' }}>+{formatCurrency(m.total_bazar_done, settings?.currency_symbol)}</td>
                        <td style={{ fontWeight: 700, color: m.closing_balance >= 0 ? 'var(--color-credit)' : 'var(--color-debt)' }}>
                          {formatCurrency(m.closing_balance, settings?.currency_symbol)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {m.amount_need_to_pay > 0 ? (
                            <span className="badge badge-debt" style={{ fontWeight: 800 }}>
                              Need to Pay: {formatCurrency(m.amount_need_to_pay, settings?.currency_symbol)}
                            </span>
                          ) : m.surplus_advance > 0 ? (
                            <span className="badge badge-credit" style={{ fontWeight: 700 }}>
                              Advance: +{formatCurrency(m.surplus_advance, settings?.currency_symbol)}
                            </span>
                          ) : (
                            <span className="badge badge-secondary">Settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ITEMIZED BAZAR PURCHASES STATEMENT */}
          <div className="card">
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1.15rem' }}>2. Itemized Bazar Expense Log</h3>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Shop / Vendor</th>
                    <th>Purchaser</th>
                    <th>Funding Source</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td>{formatDate(exp.date)}</td>
                      <td>{exp.category}</td>
                      <td style={{ fontWeight: 600 }}>{exp.description}</td>
                      <td>{exp.shop_name || 'N/A'}</td>
                      <td>{exp.purchaser_name || exp.purchaser_id}</td>
                      <td>
                        {exp.funding_source === 'personal_credit' ? 'Personally Paid (Credit)' : 'Shared Mess Fund'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {formatCurrency(exp.amount, settings?.currency_symbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signature Block for Print Statements */}
          <div
            className="card print-signatures"
            style={{
              padding: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '2rem',
              marginTop: '1rem',
            }}
          >
            <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Manager Signature</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verified & Finalized</div>
            </div>

            <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Member Auditor Signature</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Inspected & Confirmed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
