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
  Home,
  Receipt,
  Wallet,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Users,
  CalendarCheck,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { getMonthlyAccountingSummary } from '../services/api';
import { SetMonthlyCostsModal } from '../components/SetMonthlyCostsModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { formatCurrency, formatMealRate, formatDate, getDhakaTodayDateString } from '../utils/formatters';
import { exportMonthlySummaryToCsv } from '../utils/csvExport';
import type { MonthlyAccountingSummary } from '../types';

export const AccountingPage: React.FC = () => {
  const { activeSystem, settings, activeRole } = useMealSystem();
  const currentPeriod = getDhakaTodayDateString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod);
  const [accounting, setAccounting] = useState<MonthlyAccountingSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCostsModal, setShowCostsModal] = useState<boolean>(false);

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
    return <LoadingSpinner message="Loading monthly accounting calculations..." />;
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

  const isFundSurplus = (accounting?.fund_balance_remaining ?? 0) >= 0;

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <h1>Accounting</h1>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="month"
            className="form-control"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{ width: 'auto', padding: '0.5rem 0.75rem' }}
          />

          {activeRole === 'manager' && (
            <button
              onClick={() => setShowCostsModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'rgba(99, 102, 241, 0.4)' }}
            >
              <Settings2 size={15} color="var(--accent-indigo)" /> Costs & Rent
            </button>
          )}

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

          {activeRole === 'manager' && (
            <Link to="/closing" className="btn btn-primary btn-sm">
              <FileCheck2 size={14} /> Finalize
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading..." />
      ) : (
        <>
          {/* DAY-BY-DAY INDICATOR STRIP */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <CalendarCheck size={18} color="var(--accent-indigo)" />
              <div style={{ fontSize: '0.85rem' }}>
                <strong style={{ color: 'var(--brand-primary)' }}>
                  {accounting?.days_elapsed ?? 0} of {accounting?.total_days_in_period ?? 30} Days
                </strong>{' '}
                • Opened {formatDate(accounting?.meal_open_date)}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="badge badge-credit" style={{ fontSize: '0.75rem' }}>
                Active
              </span>
            </div>
          </div>

          {/* FUND BALANCE CARD */}
          <div
            className="card"
            style={{
              background: isFundSurplus
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(15, 23, 42, 0.9) 100%)'
                : 'linear-gradient(135deg, rgba(244, 63, 94, 0.14) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: isFundSurplus ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(244, 63, 94, 0.35)',
              marginBottom: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <Wallet size={18} color={isFundSurplus ? 'var(--brand-primary)' : 'var(--color-debt)'} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: isFundSurplus ? 'var(--brand-primary)' : 'var(--color-debt)' }}>
                    Fund Balance
                  </span>
                </div>
                <h2 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-mono)', fontWeight: 800, margin: '0.2rem 0', color: isFundSurplus ? 'var(--brand-primary)' : 'var(--color-debt)' }}>
                  {formatCurrency(accounting?.fund_balance_remaining, settings?.currency_symbol)}
                </h2>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Deposits</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-indigo)' }}>
                    +{formatCurrency(accounting?.total_deposits, settings?.currency_symbol)}
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Spent</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-debt)' }}>
                    −{formatCurrency(accounting?.total_shared_fund_spent, settings?.currency_symbol)}
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Due</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-warning)' }}>
                    {formatCurrency(accounting?.total_amount_due, settings?.currency_symbol)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Figures Strip */}
          <div className="grid-cols-4" style={{ marginBottom: '1.75rem' }}>
            <div className="card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bazar</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.2rem 0' }}>
                {formatCurrency(accounting?.total_expenses, settings?.currency_symbol)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Rate: {formatMealRate(accounting?.meal_rate, settings?.currency_symbol)}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Meals</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-primary)', margin: '0.2rem 0' }}>
                {accounting?.total_meals}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {accounting?.members.length} members
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fixed Bills</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-teal)', margin: '0.2rem 0' }}>
                {formatCurrency(accounting?.per_member_fixed_cost, settings?.currency_symbol)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Total: {formatCurrency(accounting?.total_fixed_costs, settings?.currency_symbol)}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>House Rent</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-indigo)', margin: '0.2rem 0' }}>
                {formatCurrency(accounting?.total_house_rent, settings?.currency_symbol)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Total
              </div>
            </div>
          </div>

          {/* MONTHLY FIXED COSTS BREAKDOWN STRIP */}
          {accounting?.fixed_costs_items && accounting.fixed_costs_items.length > 0 && (
            <div className="card" style={{ marginBottom: '1.75rem', background: 'rgba(15, 23, 42, 0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Receipt size={16} color="var(--accent-teal)" />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Fixed Costs</span>
                </div>
                {activeRole === 'manager' && (
                  <button onClick={() => setShowCostsModal(true)} className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
                    Edit
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {accounting.fixed_costs_items.map((fc) => (
                  <div
                    key={fc.id}
                    style={{
                      background: 'rgba(31, 41, 55, 0.6)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.45rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.825rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{fc.title}:</span>
                    <strong style={{ color: 'var(--brand-primary)' }}>{formatCurrency(fc.amount, settings?.currency_symbol)}</strong>
                  </div>
                ))}
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.45rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.825rem',
                    marginLeft: 'auto',
                  }}
                >
                  <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>Per Member:</span>
                  <strong>{formatCurrency(accounting.per_member_fixed_cost, settings?.currency_symbol)}</strong>
                </div>
              </div>
            </div>
          )}

          {/* MEMBER BALANCE SHEET */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3>Member Balances</h3>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Meals</th>
                    <th>Meal Cost</th>
                    <th>Fixed</th>
                    <th>Rent</th>
                    <th style={{ color: 'var(--color-debt)' }}>Billed</th>
                    <th>Opening</th>
                    <th>Paid</th>
                    <th>Bazar Trips</th>
                    <th style={{ color: 'var(--brand-primary)', textAlign: 'right' }}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {accounting?.members.map((m) => {
                    const needsToPay = m.amount_need_to_pay > 0;

                    return (
                      <tr key={m.member_id}>
                        <td style={{ fontWeight: 700 }}>
                          <div>{m.member_name}</div>
                        </td>
                        <td>{m.meal_count}</td>
                        <td style={{ fontWeight: 600 }}>
                          {formatCurrency(m.meal_cost, settings?.currency_symbol)}
                        </td>
                        <td style={{ color: 'var(--accent-teal)' }}>
                          {formatCurrency(m.shared_fixed_cost, settings?.currency_symbol)}
                        </td>
                        <td style={{ color: 'var(--accent-indigo)' }}>
                          {formatCurrency(m.house_rent, settings?.currency_symbol)}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--color-debt)' }}>
                          {formatCurrency(m.total_billed, settings?.currency_symbol)}
                        </td>
                        <td style={{ color: m.opening_balance >= 0 ? 'var(--color-credit)' : 'var(--color-debt)', fontSize: '0.85rem' }}>
                          {formatCurrency(m.opening_balance, settings?.currency_symbol)}
                        </td>
                        <td style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
                          +{formatCurrency(m.deposits, settings?.currency_symbol)}
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>
                            {m.bazar_trips_count ?? 0} times
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {needsToPay ? (
                            <span
                              className="badge badge-debt"
                              style={{
                                fontSize: '0.88rem',
                                padding: '0.35rem 0.65rem',
                                fontWeight: 800,
                              }}
                            >
                              Due: {formatCurrency(m.amount_need_to_pay, settings?.currency_symbol)}
                            </span>
                          ) : m.surplus_advance > 0 ? (
                            <span
                              className="badge badge-credit"
                              style={{
                                fontSize: '0.85rem',
                                padding: '0.3rem 0.6rem',
                                fontWeight: 700,
                              }}
                            >
                              +{formatCurrency(m.surplus_advance, settings?.currency_symbol)}
                            </span>
                          ) : (
                            <span className="badge badge-secondary" style={{ fontSize: '0.8rem' }}>
                              ৳0
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Set Monthly Costs Modal */}
      <SetMonthlyCostsModal
        isOpen={showCostsModal}
        onClose={() => setShowCostsModal(false)}
        period={selectedPeriod}
        onSuccess={() => {
          loadAccounting();
        }}
      />
    </div>
  );
};

