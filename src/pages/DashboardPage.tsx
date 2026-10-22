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
  Home,
  Settings2,
  Receipt,
  Power,
  PowerOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMealSystem } from '../context/MealSystemContext';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { AddDepositModal } from '../components/AddDepositModal';
import { SetMonthlyCostsModal } from '../components/SetMonthlyCostsModal';
import { EmptyState } from '../components/EmptyState';
import { CreateSystemModal } from '../components/CreateSystemModal';
import { formatCurrency, formatMealRate, formatDate, getMealCutoffInfo, getDhakaTodayDateString } from '../utils/formatters';
import {
  getMonthlyAccountingSummary,
  getCookingDays,
  getDailyMealRecords,
  saveDailyMealRecord,
  getFinancialLedger,
  toggleMealSystemActiveStatus,
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
  const [showCostsModal, setShowCostsModal] = useState(false);
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

  const [togglingSystem, setTogglingSystem] = useState(false);
  const isSystemMasterOff = Boolean(settings?.is_meal_system_off);
  const isSystemOffToday = Boolean(
    isSystemMasterOff &&
    (!settings?.meal_system_off_date || todayStr >= settings.meal_system_off_date)
  );

  const isNoCooking = isSystemOffToday || todayCooking?.status === 'no_cooking';

  const handleToggleSystemOff = async () => {
    if (!activeSystem || !user || activeRole !== 'manager') return;
    const newOff = !isSystemMasterOff;

    try {
      setTogglingSystem(true);
      await toggleMealSystemActiveStatus(activeSystem.id, newOff, user.id);
      await refreshSystemData();
      await loadDashboardData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update meal system status');
    } finally {
      setTogglingSystem(false);
    }
  };

  // Slot states
  const isAfternoonOff = isNoCooking || (todayMealRecord?.lunch_turned_off ?? todayMealRecord?.is_turned_off ?? false);
  const isNightOff = isNoCooking || (todayMealRecord?.dinner_turned_off ?? todayMealRecord?.is_turned_off ?? false);
  const isFullMealOff = isAfternoonOff && isNightOff;

  // Toggle Afternoon (Lunch) meal
  const handleToggleAfternoon = async () => {
    if (!activeSystem || !user) return;
    if (isSystemOffToday) {
      alert('Meal system is fully turned off. Meals remain 0 until opened.');
      return;
    }
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
            <h1>{activeSystem?.name || 'MealTrack Dashboard'}</h1>
            <span className={`badge badge-${activeRole}`}>{activeRole}</span>
          </div>
          <p style={{ marginTop: '0.2rem' }}>
            Period: <strong>{currentPeriod}</strong> • Currency: <strong>BDT (৳)</strong> • Timezone: <strong>Asia/Dhaka</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
              Personal
            </button>
            <button
              onClick={() => setActiveTab('manager')}
              className={`btn btn-sm ${activeTab === 'manager' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
            >
              Overview
            </button>
          </div>

          <button onClick={() => setShowExpenseModal(true)} className="btn btn-outline btn-sm">
            <ShoppingBag size={15} /> + Expense
          </button>
          {activeRole === 'manager' && (
            <>
              <button
                onClick={() => setShowCostsModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'rgba(99, 102, 241, 0.4)' }}
              >
                <Settings2 size={14} color="var(--accent-indigo)" /> Set Costs & Rent
              </button>
              <button onClick={() => setShowDepositModal(true)} className="btn btn-primary btn-sm">
                <Wallet size={15} /> Log Deposit
              </button>
              <button
                onClick={handleToggleSystemOff}
                disabled={togglingSystem}
                className={`btn btn-sm ${isSystemMasterOff ? 'btn-primary' : 'btn-outline'}`}
                style={isSystemMasterOff ? { fontWeight: 600 } : { borderColor: 'rgba(244, 63, 94, 0.4)', color: 'var(--color-debt)', fontWeight: 600 }}
              >
                {isSystemMasterOff ? (
                  <>
                    <Power size={14} /> Open Meal System
                  </>
                ) : (
                  <>
                    <PowerOff size={14} /> Turn Off Meal System
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* SYSTEM OFF ALERT BANNER */}
      {isSystemMasterOff && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PowerOff size={18} color="var(--color-debt)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-debt)' }}>
              Meal System is OFF • All meals count as 0 until opened
            </span>
          </div>
          {activeRole === 'manager' && (
            <button
              onClick={handleToggleSystemOff}
              disabled={togglingSystem}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Power size={14} /> Open Meal System
            </button>
          )}
        </div>
      )}

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
              <span className={`badge ${isSystemOffToday ? 'badge-debt' : isNoCooking ? 'badge-debt' : 'badge-credit'}`}>
                {isSystemOffToday ? 'System OFF (0 Meals)' : isNoCooking ? 'No Cooking' : 'Cooking Today'}
              </span>
            </div>

            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.35rem' }}>
              {isSystemOffToday ? (
                <span style={{ color: 'var(--color-debt)' }}>Meal System is OFF (All Meals: 0)</span>
              ) : isNoCooking ? (
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
          {/* PROMINENT NEED TO PAY / SURPLUS BANNER */}
          {mySummary && (
            <div
              className="card"
              style={{
                background: mySummary.amount_need_to_pay > 0
                  ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%)'
                  : 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%)',
                border: mySummary.amount_need_to_pay > 0
                  ? '1px solid rgba(244, 63, 94, 0.4)'
                  : '1px solid rgba(16, 185, 129, 0.4)',
                marginBottom: '1.75rem',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: mySummary.amount_need_to_pay > 0 ? 'var(--color-debt)' : 'var(--brand-primary)', marginBottom: '0.15rem' }}>
                    {mySummary.amount_need_to_pay > 0 ? 'Due' : 'Balance'}
                  </div>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', margin: '0.1rem 0', color: mySummary.amount_need_to_pay > 0 ? 'var(--color-debt)' : 'var(--brand-primary)' }}>
                    {mySummary.amount_need_to_pay > 0 ? (
                      `Due: ${formatCurrency(mySummary.amount_need_to_pay, settings?.currency_symbol)}`
                    ) : mySummary.surplus_advance > 0 ? (
                      `+${formatCurrency(mySummary.surplus_advance, settings?.currency_symbol)}`
                    ) : (
                      '৳0.00'
                    )}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Billed: <strong>{formatCurrency(mySummary.total_billed, settings?.currency_symbol)}</strong> • Paid: <strong>{formatCurrency(mySummary.total_paid, settings?.currency_symbol)}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button onClick={() => setShowDepositModal(true)} className="btn btn-primary btn-sm">
                    <Wallet size={14} /> Deposit
                  </button>
                  <Link to="/accounting" className="btn btn-secondary btn-sm">
                    Statement <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="grid-cols-4" style={{ marginBottom: '1.25rem' }}>
            <StatCard
              title="Due"
              value={
                mySummary && mySummary.amount_need_to_pay > 0
                  ? formatCurrency(mySummary.amount_need_to_pay, settings?.currency_symbol)
                  : mySummary && mySummary.surplus_advance > 0
                  ? `+${formatCurrency(mySummary.surplus_advance, settings?.currency_symbol)}`
                  : '৳0'
              }
              subtitle="Current status"
              icon={Wallet}
              variant={mySummary && mySummary.amount_need_to_pay > 0 ? 'debt' : 'credit'}
            />

            <StatCard
              title="Meals"
              value={`${mySummary?.meal_count ?? 0}`}
              subtitle={`${accounting?.days_elapsed ?? 0} days counted`}
              icon={UtensilsCrossed}
              variant="info"
            />

            <StatCard
              title="Bazar Trips"
              value={`${mySummary?.bazar_trips_count ?? 0} times`}
              subtitle="Visits outside"
              icon={ShoppingBag}
              variant="primary"
            />

            <StatCard
              title="Rent & Bills"
              value={formatCurrency((mySummary?.house_rent ?? 0) + (mySummary?.shared_fixed_cost ?? 0), settings?.currency_symbol)}
              subtitle="Fixed + Rent"
              icon={Home}
              variant="warning"
            />
          </div>

          {/* Account Breakdown Summary Card */}
          <div className="card" style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Breakdown</h2>
              <Link to="/accounting" className="btn btn-secondary btn-sm">
                Statement <ArrowRight size={13} />
              </Link>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(11, 15, 25, 0.6)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Meals</span>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-debt)' }}>
                  {formatCurrency(mySummary?.meal_cost, settings?.currency_symbol)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bills</span>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent-teal)' }}>
                  {formatCurrency(mySummary?.shared_fixed_cost, settings?.currency_symbol)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rent</span>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent-indigo)' }}>
                  {formatCurrency(mySummary?.house_rent, settings?.currency_symbol)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Billed</span>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-debt)' }}>
                  {formatCurrency(mySummary?.total_billed, settings?.currency_symbol)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Deposits</span>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--brand-primary)' }}>
                  +{formatCurrency(mySummary?.deposits, settings?.currency_symbol)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bazar Trips</span>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent-teal)' }}>
                  {mySummary?.bazar_trips_count ?? 0} times
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 700 }}>Due</span>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: mySummary && mySummary.amount_need_to_pay > 0 ? 'var(--color-debt)' : 'var(--color-credit)' }}>
                  {mySummary && mySummary.amount_need_to_pay > 0
                    ? formatCurrency(mySummary.amount_need_to_pay, settings?.currency_symbol)
                    : mySummary && mySummary.surplus_advance > 0
                    ? `+${formatCurrency(mySummary.surplus_advance, settings?.currency_symbol)}`
                    : '৳0'}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Ledger */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Recent Transactions</h2>
              <Link to="/deposits" className="btn btn-secondary btn-sm">
                Transactions <ArrowRight size={13} />
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

      {/* VIEW: OVERVIEW DASHBOARD */}
      {activeTab === 'manager' && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}>
            <StatCard
              title="Total Fund"
              value={formatCurrency(accounting?.fund_balance_remaining, settings?.currency_symbol)}
              subtitle={`Deposits: ${formatCurrency(accounting?.total_deposits, settings?.currency_symbol)}`}
              icon={Wallet}
              variant={(accounting?.fund_balance_remaining ?? 0) >= 0 ? 'credit' : 'debt'}
            />

            <StatCard
              title="Total Expense"
              value={formatCurrency(accounting?.total_expenses, settings?.currency_symbol)}
              subtitle="All Bazar Expenses"
              icon={ShoppingBag}
              variant="warning"
            />

            <StatCard
              title="Total Meals"
              value={`${accounting?.total_meals ?? 0}`}
              subtitle={`${accounting?.members.length ?? 0} members`}
              icon={UtensilsCrossed}
              variant="primary"
            />

            <StatCard
              title="Meal Rate"
              value={formatMealRate(accounting?.meal_rate, settings?.currency_symbol)}
              subtitle="Per meal"
              icon={TrendingUp}
              variant="info"
            />

            <StatCard
              title="Payment"
              value={formatCurrency(accounting?.total_deposits, settings?.currency_symbol)}
              subtitle="Total Deposits"
              icon={Wallet}
              variant="credit"
            />

            <StatCard
              title="Total Due"
              value={formatCurrency(accounting?.total_amount_due, settings?.currency_symbol)}
              subtitle="Uncollected"
              icon={DollarSign}
              variant="debt"
            />
          </div>

          {/* Member Roster & Balance Status */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Members Summary</h2>
                <span className="badge badge-credit" style={{ fontSize: '0.7rem' }}>
                  Rate: {formatMealRate(accounting?.meal_rate, settings?.currency_symbol)}
                </span>
                <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                  Total Meals: {accounting?.total_meals ?? 0}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {activeRole === 'manager' && (
                  <button
                    onClick={() => setShowCostsModal(true)}
                    className="btn btn-secondary btn-sm"
                  >
                    <Settings2 size={13} /> Costs & Rent
                  </button>
                )}
                <Link to="/accounting" className="btn btn-primary btn-sm">
                  Accounting <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Meals</th>
                    <th>Meal Cost</th>
                    <th>Bazar Trips</th>
                    <th>Bills</th>
                    <th>Rent</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th style={{ textAlign: 'right' }}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {accounting?.members.map((m) => (
                    <tr key={m.member_id}>
                      <td style={{ fontWeight: 600 }}>{m.member_name}</td>
                      <td style={{ fontWeight: 700 }}>{m.meal_count}</td>
                      <td>{formatCurrency(m.meal_cost, settings?.currency_symbol)}</td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>
                          {m.bazar_trips_count ?? 0} times
                        </span>
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
                      <td style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
                        {formatCurrency(m.deposits, settings?.currency_symbol)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {m.amount_need_to_pay > 0 ? (
                          <span className="badge badge-debt" style={{ fontWeight: 700 }}>
                            Due: {formatCurrency(m.amount_need_to_pay, settings?.currency_symbol)}
                          </span>
                        ) : m.surplus_advance > 0 ? (
                          <span className="badge badge-credit" style={{ fontWeight: 700 }}>
                            +{formatCurrency(m.surplus_advance, settings?.currency_symbol)}
                          </span>
                        ) : (
                          <span className="badge badge-secondary">৳0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 800, borderTop: '2px solid var(--border-card)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <td>Total</td>
                    <td style={{ color: 'var(--brand-primary)' }}>{accounting?.total_meals ?? 0}</td>
                    <td>{formatCurrency(accounting?.total_expenses, settings?.currency_symbol)}</td>
                    <td style={{ color: 'var(--accent-teal)' }}>
                      {accounting?.members.reduce((sum, m) => sum + (m.bazar_trips_count ?? 0), 0) ?? 0} times
                    </td>
                    <td style={{ color: 'var(--accent-teal)' }}>
                      {formatCurrency(accounting?.total_fixed_costs, settings?.currency_symbol)}
                    </td>
                    <td style={{ color: 'var(--accent-indigo)' }}>
                      {formatCurrency(accounting?.total_house_rent, settings?.currency_symbol)}
                    </td>
                    <td style={{ color: 'var(--color-debt)' }}>
                      {formatCurrency(accounting?.members.reduce((sum, m) => sum + (m.total_billed ?? 0), 0), settings?.currency_symbol)}
                    </td>
                    <td style={{ color: 'var(--brand-primary)' }}>
                      {formatCurrency(accounting?.total_deposits, settings?.currency_symbol)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-debt)' }}>
                      Due: {formatCurrency(accounting?.total_amount_due, settings?.currency_symbol)}
                    </td>
                  </tr>
                </tfoot>
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

      <SetMonthlyCostsModal
        isOpen={showCostsModal}
        onClose={() => setShowCostsModal(false)}
        period={currentPeriod}
        onSuccess={() => {
          loadDashboardData();
          refreshSystemData();
        }}
      />
    </div>
  );
};
