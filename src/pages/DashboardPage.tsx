import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UtensilsCrossed,
  DollarSign,
  TrendingUp,
  AlertCircle,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShoppingBag,
  Wallet,
  Users,
  Shield,
  FileCheck2,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMealSystem } from '../context/MealSystemContext';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { AddDepositModal } from '../components/AddDepositModal';
import { EmptyState } from '../components/EmptyState';
import { CreateSystemModal } from '../components/CreateSystemModal';
import { formatCurrency, formatMealRate, formatDate, getMealCutoffInfo, getDhakaTodayDateString } from '../utils/formatters';
import {
  getMonthlyAccountingSummary,
  getCookingDays,
  getDailyMealRecords,
  saveDailyMealRecord,
  getFinancialLedger,
} from '../services/api';
import type {
  MonthlyAccountingSummary,
  MonthlyMemberSummary,
  CookingDay,
  DailyMealRecord,
  FinancialLedgerEntry,
} from '../types';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { activeSystem, activeRole, settings, refreshSystemData } = useMealSystem();

  const [activeTab, setActiveTab] = useState<'personal' | 'manager'>('personal');
  const [loading, setLoading] = useState(true);
  const [accounting, setAccounting] = useState<MonthlyAccountingSummary | null>(null);
  const [todayCooking, setTodayCooking] = useState<CookingDay | null>(null);
  const [todayMealRecord, setTodayMealRecord] = useState<DailyMealRecord | null>(null);
  const [recentLedger, setRecentLedger] = useState<FinancialLedgerEntry[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const todayStr = getDhakaTodayDateString();
  const currentPeriod = todayStr.slice(0, 7);

  const cutoff = getMealCutoffInfo({
    lunchCutoffTime: settings?.lunch_cutoff_time,
    dinnerCutoffTime: settings?.dinner_cutoff_time,
    targetDateStr: todayStr,
  });

  const loadDashboardData = async () => {
    if (!activeSystem || !user) return;
    try {
      setLoading(true);
      const [summary, cookingList, meals, ledger] = await Promise.all([
        getMonthlyAccountingSummary(activeSystem.id, currentPeriod),
        getCookingDays(activeSystem.id, todayStr, todayStr),
        getDailyMealRecords(activeSystem.id, todayStr, todayStr),
        getFinancialLedger(activeSystem.id, currentPeriod, user.id),
      ]);

      setAccounting(summary);
      setTodayCooking(cookingList[0] || null);
      setTodayMealRecord(meals.find((m) => m.member_id === user.id) || null);
      setRecentLedger(ledger.slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSystem) {
      setLoading(false);
      return;
    }
    loadDashboardData();
  }, [activeSystem?.id, user?.id]);

  const mySummary: MonthlyMemberSummary | undefined = accounting?.members.find(
    (m) => m.member_id === user?.id
  );

  const isNoCooking = todayCooking?.status === 'no_cooking';

  // Slot states
  const isAfternoonOff = isNoCooking || (todayMealRecord?.lunch_turned_off ?? todayMealRecord?.is_turned_off ?? false);
  const isNightOff = isNoCooking || (todayMealRecord?.dinner_turned_off ?? todayMealRecord?.is_turned_off ?? false);
  const isFullMealOff = isAfternoonOff && isNightOff;

  // Toggle Afternoon (Lunch) meal
  const handleToggleAfternoon = async () => {
    if (!activeSystem || !user) return;
    if (isNoCooking) {
      alert('Today is a No Cooking day.');
      return;
    }
    if (cutoff.isAfternoonPastCutoff && activeRole !== 'manager') {
      alert('Afternoon meal cutoff has passed. Contact the manager for corrections.');
      return;
    }

    const newLunchOff = !isAfternoonOff;
    await saveDailyMealRecord({
      systemId: activeSystem.id,
      memberId: user.id,
      date: todayStr,
      lunchTurnedOff: newLunchOff,
      dinnerTurnedOff: isNightOff,
      lunchCount: newLunchOff ? 0 : 1,
      dinnerCount: isNightOff ? 0 : 1,
      isTurnedOff: newLunchOff && isNightOff,
      isPostCutoff: cutoff.isAfternoonPastCutoff,
      reason: cutoff.isAfternoonPastCutoff ? 'Manager override on dashboard' : undefined,
      actorId: user.id,
    });
    await loadDashboardData();
  };

  // Toggle Night (Dinner) meal
  const handleToggleNight = async () => {
    if (!activeSystem || !user) return;
    if (isNoCooking) {
      alert('Today is a No Cooking day.');
      return;
    }
    if (cutoff.isNightPastCutoff && activeRole !== 'manager') {
      alert('Night meal cutoff has passed. Contact the manager for corrections.');
      return;
    }

    const newNightOff = !isNightOff;
    await saveDailyMealRecord({
      systemId: activeSystem.id,
      memberId: user.id,
      date: todayStr,
      lunchTurnedOff: isAfternoonOff,
      dinnerTurnedOff: newNightOff,
      lunchCount: isAfternoonOff ? 0 : 1,
      dinnerCount: newNightOff ? 0 : 1,
      isTurnedOff: isAfternoonOff && newNightOff,
      isPostCutoff: cutoff.isNightPastCutoff,
      reason: cutoff.isNightPastCutoff ? 'Manager override on dashboard' : undefined,
      actorId: user.id,
    });
    await loadDashboardData();
  };

  // Cut full day meals (both afternoon and night off)
  const handleToggleFullMeal = async () => {
    if (!activeSystem || !user) return;
    if (isNoCooking) return;

    const willTurnOff = !isFullMealOff;
    if (willTurnOff) {
      // If turning off full meal, check if cutoffs passed
      if (cutoff.isFullPastCutoff && activeRole !== 'manager') {
        alert('All meal cutoffs have passed for today.');
        return;
      }
    }

    await saveDailyMealRecord({
      systemId: activeSystem.id,
      memberId: user.id,
      date: todayStr,
      lunchTurnedOff: willTurnOff,
      dinnerTurnedOff: willTurnOff,
      lunchCount: willTurnOff ? 0 : 1,
      dinnerCount: willTurnOff ? 0 : 1,
      isTurnedOff: willTurnOff,
      isPostCutoff: cutoff.isAfternoonPastCutoff || cutoff.isNightPastCutoff,
      reason: (cutoff.isAfternoonPastCutoff || cutoff.isNightPastCutoff) ? 'Manager override on full meal' : undefined,
      actorId: user.id,
    });
    await loadDashboardData();
  };

  if (loading) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (!activeSystem) {
    return (
      <div className="page-wrapper">
        <EmptyState
          title="No Mess System"
          description="Create a mess system or join with an invite code."
          actionText="Create Mess System"
          onAction={() => setShowCreateModal(true)}
        />
        <CreateSystemModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => refreshSystemData()}
        />
      </div>
    );
  }

  const effectiveMealsToday = isNoCooking ? 0 : (isAfternoonOff ? 0 : 1) + (isNightOff ? 0 : 1);

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1>{activeSystem?.name || 'Meal Hisab Dashboard'}</h1>
            <span className={`badge badge-${activeRole}`}>{activeRole}</span>
          </div>
          <p style={{ marginTop: '0.2rem' }}>
            Period: <strong>{currentPeriod}</strong> • Currency: <strong>BDT (৳)</strong> • Timezone: <strong>Asia/Dhaka</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {activeRole === 'manager' && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)',
              padding: '0.25rem',
              display: 'flex',
              gap: '0.25rem',
            }}>
              <button
                onClick={() => setActiveTab('personal')}
                className={`btn btn-sm ${activeTab === 'personal' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none' }}
              >
                Personal View
              </button>
              <button
                onClick={() => setActiveTab('manager')}
                className={`btn btn-sm ${activeTab === 'manager' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none' }}
              >
                Manager Overview
              </button>
            </div>
          )}

          <button onClick={() => setShowExpenseModal(true)} className="btn btn-outline btn-sm">
            <ShoppingBag size={15} /> Add Expense
          </button>
          {activeRole === 'manager' && (
            <button onClick={() => setShowDepositModal(true)} className="btn btn-primary btn-sm">
              <Wallet size={15} /> Log Deposit
            </button>
          )}
        </div>
      </div>

      {/* 2-MEAL (AFTERNOON & NIGHT) HERO SECTION */}
      <div
        className="card"
        style={{
          background: isNoCooking
            ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(17, 24, 39, 0.8) 100%)'
            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(17, 24, 39, 0.8) 100%)',
          border: `1px solid ${isNoCooking ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          marginBottom: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: isNoCooking ? 'var(--color-debt)' : 'var(--brand-primary)' }}>
                Today: {formatDate(todayStr, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className={`badge ${isNoCooking ? 'badge-debt' : 'badge-credit'}`}>
                {isNoCooking ? 'No Cooking' : 'Cooking Today'}
              </span>
            </div>

            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.35rem' }}>
              {isNoCooking ? (
                'Cooking is cancelled for today. 0 meals charged.'
              ) : isFullMealOff ? (
                <span style={{ color: 'var(--accent-rose)' }}>Full Meal Turned OFF (0 meals today)</span>
              ) : (
                <span style={{ color: 'var(--brand-primary)' }}>
                  Meals Active Today: {effectiveMealsToday} {effectiveMealsToday === 1 ? 'Meal' : 'Meals'} ({!isAfternoonOff ? 'Afternoon' : ''}{!isAfternoonOff && !isNightOff ? ' + ' : ''}{!isNightOff ? 'Night' : ''})
                </span>
              )}
            </h3>

            <p style={{ fontSize: '0.85rem' }}>
              {todayCooking?.note ? `Note: "${todayCooking.note}" • ` : ''}
              Afternoon Cutoff: <strong>{settings?.lunch_cutoff_time?.slice(0, 5) || '10:00 AM'}</strong> ({cutoff.afternoonTimeLeft}) • Night Cutoff: <strong>{settings?.dinner_cutoff_time?.slice(0, 5) || '5:00 PM'}</strong> ({cutoff.nightTimeLeft})
            </p>
          </div>

          {!isNoCooking && (
            <button
              onClick={handleToggleFullMeal}
              className={`btn btn-sm ${isFullMealOff ? 'btn-primary' : 'btn-danger'}`}
            >
              {isFullMealOff ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              {isFullMealOff ? 'Turn Full Meal ON (2 meals)' : 'Cut Full Meal (0 meals)'}
            </button>
          )}
        </div>

        {/* 2 MEALS: INDIVIDUAL SLOT CONTROLS (CUT ONE BY ONE) */}
        {!isNoCooking && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
            marginTop: '1.25rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            {/* Slot 1: Afternoon Meal */}
            <div style={{
              background: 'rgba(11, 15, 25, 0.7)',
              border: `1px solid ${!isAfternoonOff ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem' }}>
                  <Sun size={17} color="var(--accent-amber)" />
                  Afternoon Meal
                </div>
                <div style={{ fontSize: '0.8rem', color: !isAfternoonOff ? 'var(--brand-primary)' : 'var(--color-debt)', marginTop: '0.2rem', fontWeight: 600 }}>
                  {!isAfternoonOff ? '1 Meal Active' : 'Cut (0 meals)'}
                </div>
              </div>

              <div>
                <button
                  onClick={handleToggleAfternoon}
                  disabled={cutoff.isAfternoonPastCutoff && activeRole !== 'manager'}
                  className={`btn btn-sm ${!isAfternoonOff ? 'btn-danger' : 'btn-primary'}`}
                >
                  {!isAfternoonOff ? 'Cut Afternoon' : 'Take Afternoon'}
                </button>
              </div>
            </div>

            {/* Slot 2: Night Meal */}
            <div style={{
              background: 'rgba(11, 15, 25, 0.7)',
              border: `1px solid ${!isNightOff ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem' }}>
                  <Moon size={17} color="#a5b4fc" />
                  Night Meal
                </div>
                <div style={{ fontSize: '0.8rem', color: !isNightOff ? 'var(--brand-primary)' : 'var(--color-debt)', marginTop: '0.2rem', fontWeight: 600 }}>
                  {!isNightOff ? '1 Meal Active' : 'Cut (0 meals)'}
                </div>
              </div>

              <div>
                <button
                  onClick={handleToggleNight}
                  disabled={cutoff.isNightPastCutoff && activeRole !== 'manager'}
                  className={`btn btn-sm ${!isNightOff ? 'btn-danger' : 'btn-primary'}`}
                >
                  {!isNightOff ? 'Cut Night' : 'Take Night'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VIEW: PERSONAL MEMBER DASHBOARD */}
      {activeTab === 'personal' && (
        <>
          <div className="grid-cols-4" style={{ marginBottom: '1.75rem' }}>
            <StatCard
              title="Current Balance"
              value={formatCurrency(mySummary?.closing_balance, settings?.currency_symbol)}
              subtitle={
                mySummary && mySummary.closing_balance >= 0
                  ? 'Available credit'
                  : 'Outstanding debt'
              }
              icon={Wallet}
              variant={mySummary && mySummary.closing_balance >= 0 ? 'credit' : 'debt'}
              badgeText={mySummary?.balance_status?.toUpperCase()}
            />

            <StatCard
              title="My Monthly Meals"
              value={`${mySummary?.meal_count ?? 0} meals`}
              subtitle={`Contribution: ${mySummary?.meal_contribution_pct ?? 0}%`}
              icon={UtensilsCrossed}
              variant="info"
            />

            <StatCard
              title="Meal Rate"
              value={formatMealRate(accounting?.meal_rate, settings?.currency_symbol)}
              subtitle={`Total Bazar: ${formatCurrency(accounting?.total_expenses, settings?.currency_symbol)}`}
              icon={TrendingUp}
              variant="primary"
            />

            <StatCard
              title="My Meal Cost"
              value={formatCurrency(mySummary?.meal_cost, settings?.currency_symbol)}
              subtitle={`Deposits: ${formatCurrency(mySummary?.deposits, settings?.currency_symbol)}`}
              icon={DollarSign}
              variant="warning"
            />
          </div>

          {/* Account Breakdown Summary Card */}
          <div className="card" style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3>Personal Financial Statement ({currentPeriod})</h3>
                <p>Opening + Deposits + Personal Credits + Adjustments − Meal Cost = Closing Balance</p>
              </div>
              <Link to="/accounting" className="btn btn-secondary btn-sm">
                Full Statement <ArrowRight size={14} />
              </Link>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '1rem',
              padding: '1rem',
              background: 'rgba(11, 15, 25, 0.6)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>1. Opening Balance</span>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: mySummary && mySummary.opening_balance >= 0 ? 'var(--color-credit)' : 'var(--color-debt)' }}>
                  {formatCurrency(mySummary?.opening_balance, settings?.currency_symbol)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>2. Deposits (+)</span>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--brand-primary)' }}>
                  +{formatCurrency(mySummary?.deposits, settings?.currency_symbol)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>3. Personal Bazar Credits (+)</span>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-teal)' }}>
                  +{formatCurrency(mySummary?.personal_bazar_credits, settings?.currency_symbol)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>4. Meal Cost (−)</span>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-debt)' }}>
                  -{formatCurrency(mySummary?.meal_cost, settings?.currency_symbol)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>5. Closing Balance</span>
                <div style={{ fontWeight: 800, fontSize: '1.25rem', color: mySummary && mySummary.closing_balance >= 0 ? 'var(--color-credit)' : 'var(--color-debt)' }}>
                  {formatCurrency(mySummary?.closing_balance, settings?.currency_symbol)}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Ledger */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3>Recent Transactions</h3>
                <p>Auditable records for your account</p>
              </div>
              <Link to="/deposits" className="btn btn-secondary btn-sm">
                View Ledger <ArrowRight size={14} />
              </Link>
            </div>

            {recentLedger.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-dim)' }}>
                No financial transactions recorded this month yet.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLedger.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDate(entry.date)}</td>
                        <td>
                          <span className={`badge ${entry.amount >= 0 ? 'badge-credit' : 'badge-debt'}`}>
                            {entry.transaction_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>{entry.description}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: entry.amount >= 0 ? 'var(--color-credit)' : 'var(--color-debt)' }}>
                          {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount, settings?.currency_symbol)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW: MANAGER OVERVIEW DASHBOARD */}
      {activeTab === 'manager' && activeRole === 'manager' && (
        <>
          <div className="grid-cols-4" style={{ marginBottom: '1.75rem' }}>
            <StatCard
              title="Total Bazar Expenses"
              value={formatCurrency(accounting?.total_expenses, settings?.currency_symbol)}
              subtitle={`${accounting?.members.length} members`}
              icon={ShoppingBag}
              variant="warning"
            />

            <StatCard
              title="Finalized Meals"
              value={`${accounting?.total_meals ?? 0} meals`}
              subtitle={`Rate: ${formatMealRate(accounting?.meal_rate, settings?.currency_symbol)}`}
              icon={UtensilsCrossed}
              variant="primary"
            />

            <StatCard
              title="Total Deposits"
              value={formatCurrency(accounting?.total_deposits, settings?.currency_symbol)}
              subtitle="Mess fund collected"
              icon={Wallet}
              variant="credit"
            />

            <StatCard
              title="Active Members"
              value={accounting?.members.length ?? 0}
              subtitle="Registered members"
              icon={Users}
              variant="info"
            />
          </div>

          {/* Member Roster & Balance Status */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3>Member Balances ({currentPeriod})</h3>
                <p>Transparent figures across all members</p>
              </div>
              <Link to="/accounting" className="btn btn-secondary btn-sm">
                Full Accounting <ArrowRight size={14} />
              </Link>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Meals</th>
                    <th>Contrib %</th>
                    <th>Meal Cost</th>
                    <th>Opening</th>
                    <th>Deposits</th>
                    <th>Personal Credits</th>
                    <th>Closing Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accounting?.members.map((m) => (
                    <tr key={m.member_id}>
                      <td style={{ fontWeight: 600 }}>{m.member_name}</td>
                      <td>{m.meal_count}</td>
                      <td>{m.meal_contribution_pct}%</td>
                      <td>{formatCurrency(m.meal_cost, settings?.currency_symbol)}</td>
                      <td style={{ color: m.opening_balance >= 0 ? 'var(--color-credit)' : 'var(--color-debt)' }}>
                        {formatCurrency(m.opening_balance, settings?.currency_symbol)}
                      </td>
                      <td style={{ color: 'var(--brand-primary)' }}>
                        {formatCurrency(m.deposits, settings?.currency_symbol)}
                      </td>
                      <td style={{ color: 'var(--accent-teal)' }}>
                        {formatCurrency(m.personal_bazar_credits, settings?.currency_symbol)}
                      </td>
                      <td style={{ fontWeight: 700, color: m.closing_balance >= 0 ? 'var(--color-credit)' : 'var(--color-debt)' }}>
                        {formatCurrency(m.closing_balance, settings?.currency_symbol)}
                      </td>
                      <td>
                        <span className={`badge ${m.closing_balance >= 0 ? 'badge-credit' : 'badge-debt'}`}>
                          {m.closing_balance >= 0 ? 'Credit' : 'Debt'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <AddExpenseModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSuccess={() => {
          loadDashboardData();
          refreshSystemData();
        }}
      />

      <AddDepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={() => {
          loadDashboardData();
          refreshSystemData();
        }}
      />
    </div>
  );
};
