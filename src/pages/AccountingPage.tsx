import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calculator,
  Download,
  Info,
  TrendingUp,
  FileCheck2,
  DollarSign,
  UtensilsCrossed,
  ArrowRight,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { getMonthlyAccountingSummary } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { formatCurrency, formatMealRate, getDhakaTodayDateString } from '../utils/formatters';
import { exportMonthlySummaryToCsv } from '../utils/csvExport';
import type { MonthlyAccountingSummary } from '../types';

export const AccountingPage: React.FC = () => {
  const { activeSystem, settings, activeRole } = useMealSystem();
  const currentPeriod = getDhakaTodayDateString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod);
  const [accounting, setAccounting] = useState<MonthlyAccountingSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAccounting = async () => {
    if (!activeSystem) return;
    try {
      setLoading(true);
      const data = await getMonthlyAccountingSummary(activeSystem.id, selectedPeriod);
      setAccounting(data);
    } catch (err) {
      console.error('Failed to load accounting:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSystem) {
      setLoading(false);
      return;
    }
    loadAccounting();
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
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <h1>Monthly Accounting</h1>
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
            <Download size={14} /> Export CSV Statement
          </button>

          {activeRole === 'manager' && (
            <Link to="/closing" className="btn btn-primary btn-sm">
              <FileCheck2 size={14} /> Review & Finalize Month
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Calculating monthly meal rates and balance sheets..." />
      ) : (
        <>
          {/* MATHEMATICAL FORMULA CARD */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(17, 24, 39, 0.85) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              marginBottom: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  Monthly Calculation Formula
                </div>
                <h3 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
                  Meal Rate = {formatCurrency(accounting?.total_expenses, settings?.currency_symbol)} ÷ {accounting?.total_meals} meals ={' '}
                  <span style={{ color: 'var(--brand-primary)' }}>
                    {formatMealRate(accounting?.meal_rate, settings?.currency_symbol)}
                  </span>
                </h3>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${accounting?.status === 'finalized' ? 'badge-credit' : 'badge-warning'}`}>
                  Month Status: {accounting?.status?.toUpperCase()}
                </span>
                {accounting?.status === 'finalized' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>
                    Version: v{accounting.version} • Finalized by {accounting.finalized_by_name}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Key Figures */}
          <div className="grid-cols-4" style={{ marginBottom: '1.75rem' }}>
            <div className="card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Eligible Bazar Expenses</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.2rem 0' }}>
                {formatCurrency(accounting?.total_expenses, settings?.currency_symbol)}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Finalized Total Meals</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-primary)', margin: '0.2rem 0' }}>
                {accounting?.total_meals} meals
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Deposits Collected</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-indigo)', margin: '0.2rem 0' }}>
                {formatCurrency(accounting?.total_deposits, settings?.currency_symbol)}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Personal Bazar Credits</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-teal)', margin: '0.2rem 0' }}>
                {formatCurrency(accounting?.total_personal_credits, settings?.currency_symbol)}
              </div>
            </div>
          </div>

          {/* COMPREHENSIVE TRANSPARENCY MEMBER BALANCE SHEET */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3>Individual Member Accounting & Closing Balances ({selectedPeriod})</h3>
                <p>Standard Equation: Opening + Deposits + Personal Credits + Adjustments − Meal Cost = Closing Balance</p>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member Name</th>
                    <th>Meals</th>
                    <th>Contrib %</th>
                    <th>Meal Cost</th>
                    <th>1. Opening Balance</th>
                    <th>2. Deposits (+)</th>
                    <th>3. Personal Bazar (+)</th>
                    <th>4. Adjustments (±)</th>
                    <th>5. Closing Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accounting?.members.map((m) => {
                    const isCredit = m.closing_balance >= 0;
                    const netAdj = m.positive_adjustments - m.negative_adjustments;

                    return (
                      <tr key={m.member_id}>
                        <td style={{ fontWeight: 700 }}>{m.member_name}</td>
                        <td>{m.meal_count}</td>
                        <td style={{ fontSize: '0.85rem' }}>{m.meal_contribution_pct}%</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-debt)' }}>
                          {formatCurrency(m.meal_cost, settings?.currency_symbol)}
                        </td>
                        <td style={{ color: m.opening_balance >= 0 ? 'var(--color-credit)' : 'var(--color-debt)' }}>
                          {formatCurrency(m.opening_balance, settings?.currency_symbol)}
                        </td>
                        <td style={{ color: 'var(--brand-primary)' }}>
                          +{formatCurrency(m.deposits, settings?.currency_symbol)}
                        </td>
                        <td style={{ color: 'var(--accent-teal)' }}>
                          +{formatCurrency(m.personal_bazar_credits, settings?.currency_symbol)}
                        </td>
                        <td style={{ color: netAdj >= 0 ? 'var(--text-main)' : 'var(--color-debt)' }}>
                          {netAdj >= 0 ? `+${formatCurrency(netAdj, settings?.currency_symbol)}` : formatCurrency(netAdj, settings?.currency_symbol)}
                        </td>
                        <td style={{ fontWeight: 800, fontSize: '1rem', color: isCredit ? 'var(--color-credit)' : 'var(--color-debt)' }}>
                          {formatCurrency(m.closing_balance, settings?.currency_symbol)}
                        </td>
                        <td>
                          <span className={`badge ${isCredit ? 'badge-credit' : 'badge-debt'}`}>
                            {isCredit ? 'Credit (Advance)' : 'Debt (Owes)'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{
              marginTop: '1.25rem',
              padding: '0.85rem 1rem',
              background: 'rgba(11, 15, 25, 0.6)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.825rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}>
              <Info size={16} color="var(--brand-primary)" />
              <span>
                <strong>Carry-Forward Rule:</strong> Upon month finalization, every member's Closing Balance automatically carries forward into next month's Opening Balance.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
