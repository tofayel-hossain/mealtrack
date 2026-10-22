import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Edit2,
  CalendarCheck,
  Sun,
  Moon,
  Power,
  PowerOff,
  UtensilsCrossed,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import {
  getCookingDays,
  getDailyMealRecords,
  saveDailyMealRecord,
  updateCookingDayStatus,
  toggleMealSystemActiveStatus,
} from '../services/api';
import { PostCutoffModal } from '../components/PostCutoffModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import {
  formatDate,
  getMealCutoffInfo,
  getDhakaTodayDateString,
} from '../utils/formatters';
import type { CookingDay, DailyMealRecord } from '../types';

export const MealsPage: React.FC = () => {
  const { activeSystem, activeRole, settings, members, refreshSystemData } = useMealSystem();
  const { user } = useAuth();

  const todayStr = getDhakaTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [cookingDays, setCookingDays] = useState<CookingDay[]>([]);
  const [mealRecords, setMealRecords] = useState<DailyMealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingSystem, setTogglingSystem] = useState(false);

  // Manager post-cutoff modal state
  const [editingRecord, setEditingRecord] = useState<DailyMealRecord | null>(null);
  const [editingMemberName, setEditingMemberName] = useState<string>('');
  const [showPostCutoffModal, setShowPostCutoffModal] = useState(false);

  // Cooking status edit state (Manager)
  const [editingCookingStatus, setEditingCookingStatus] = useState<boolean>(false);
  const [statusVal, setStatusVal] = useState<'cooking' | 'no_cooking' | 'pending'>('cooking');
  const [statusNote, setStatusNote] = useState<string>('');

  const currentPeriod = selectedDate.slice(0, 7);
  const openDate = settings?.meal_start_date || (activeSystem?.created_at ? activeSystem.created_at.slice(0, 10) : undefined) || `${currentPeriod}-01`;
  const isBeforeOpen = selectedDate < openDate;
  const isFutureDate = selectedDate > todayStr;

  // Master Meal System Off status
  const isSystemMasterOff = Boolean(settings?.is_meal_system_off);
  const isSystemOffForSelectedDate = Boolean(
    isSystemMasterOff &&
    (!settings?.meal_system_off_date || selectedDate >= settings.meal_system_off_date)
  );

  const cutoff = getMealCutoffInfo({
    lunchCutoffTime: settings?.lunch_cutoff_time,
    dinnerCutoffTime: settings?.dinner_cutoff_time,
    targetDateStr: selectedDate,
  });

  const loadMealData = async () => {
    if (!activeSystem) return;
    try {
      setLoading(true);
      const sel = new Date(selectedDate);
      const start = new Date(sel);
      start.setDate(start.getDate() - 7);
      const end = new Date(sel);
      end.setDate(end.getDate() + 7);

      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);

      const [cDays, mRecords] = await Promise.all([
        getCookingDays(activeSystem.id, startStr, endStr),
        getDailyMealRecords(activeSystem.id, startStr, endStr),
      ]);

      setCookingDays(cDays);
      setMealRecords(mRecords);

      const currentDay = cDays.find((c) => c.date === selectedDate);
      if (currentDay) {
        setStatusVal(currentDay.status);
        setStatusNote(currentDay.note || '');
      } else {
        setStatusVal('cooking');
        setStatusNote('');
      }
    } catch (err) {
      console.error('Failed to load meal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSystem) {
      setLoading(false);
      return;
    }
    loadMealData();
  }, [activeSystem?.id, selectedDate]);

  const todayCooking = cookingDays.find((c) => c.date === selectedDate);
  const cookingStatus = todayCooking?.status || 'cooking';
  const isNoCooking = isBeforeOpen || isSystemOffForSelectedDate || cookingStatus === 'no_cooking';

  // Current user's record on selected date
  const myRecord = mealRecords.find((r) => r.member_id === user?.id && r.date === selectedDate);
  const isAfternoonOff = isNoCooking || (myRecord?.lunch_turned_off ?? myRecord?.is_turned_off ?? false);
  const isNightOff = isNoCooking || (myRecord?.dinner_turned_off ?? myRecord?.is_turned_off ?? false);
  const isFullMealOff = isAfternoonOff && isNightOff;
  const myEffectiveMeals = (isBeforeOpen || isSystemOffForSelectedDate || isNoCooking)
    ? 0
    : (isAfternoonOff ? 0 : 1) + (isNightOff ? 0 : 1);

  // Toggle meal system ON/OFF (Manager)
  const handleToggleSystemOff = async () => {
    if (!activeSystem || !user || activeRole !== 'manager') return;
    const newOff = !isSystemMasterOff;

    try {
      setTogglingSystem(true);
      await toggleMealSystemActiveStatus(activeSystem.id, newOff, user.id);
      await refreshSystemData();
      await loadMealData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update meal system status');
    } finally {
      setTogglingSystem(false);
    }
  };

  // Toggle user's afternoon meal
  const handleToggleAfternoon = async () => {
    if (!activeSystem || !user) return;
    if (isSystemOffForSelectedDate) {
      alert('Meal system is fully turned off. Meals remain 0 until opened by manager.');
      return;
    }
    if (isNoCooking) {
      alert('Cooking is cancelled for this day.');
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
      date: selectedDate,
      lunchTurnedOff: newLunchOff,
      dinnerTurnedOff: isNightOff,
      lunchCount: newLunchOff ? 0 : 1,
      dinnerCount: isNightOff ? 0 : 1,
      isTurnedOff: newLunchOff && isNightOff,
      isPostCutoff: cutoff.isAfternoonPastCutoff,
      reason: cutoff.isAfternoonPastCutoff ? 'Manager override' : undefined,
      actorId: user.id,
    });
    await loadMealData();
  };

  // Toggle user's night meal
  const handleToggleNight = async () => {
    if (!activeSystem || !user) return;
    if (isSystemOffForSelectedDate) {
      alert('Meal system is fully turned off. Meals remain 0 until opened by manager.');
      return;
    }
    if (isNoCooking) {
      alert('Cooking is cancelled for this day.');
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
      date: selectedDate,
      lunchTurnedOff: isAfternoonOff,
      dinnerTurnedOff: newNightOff,
      lunchCount: isAfternoonOff ? 0 : 1,
      dinnerCount: newNightOff ? 0 : 1,
      isTurnedOff: isAfternoonOff && newNightOff,
      isPostCutoff: cutoff.isNightPastCutoff,
      reason: cutoff.isNightPastCutoff ? 'Manager override' : undefined,
      actorId: user.id,
    });
    await loadMealData();
  };

  // Cut full day meals
  const handleToggleFullMeal = async () => {
    if (!activeSystem || !user) return;
    if (isSystemOffForSelectedDate || isNoCooking) return;

    const willTurnOff = !isFullMealOff;
    if (willTurnOff && cutoff.isFullPastCutoff && activeRole !== 'manager') {
      alert('All cutoffs have passed for this date.');
      return;
    }

    await saveDailyMealRecord({
      systemId: activeSystem.id,
      memberId: user.id,
      date: selectedDate,
      lunchTurnedOff: willTurnOff,
      dinnerTurnedOff: willTurnOff,
      lunchCount: willTurnOff ? 0 : 1,
      dinnerCount: willTurnOff ? 0 : 1,
      isTurnedOff: willTurnOff,
      isPostCutoff: cutoff.isAfternoonPastCutoff || cutoff.isNightPastCutoff,
      reason: (cutoff.isAfternoonPastCutoff || cutoff.isNightPastCutoff) ? 'Manager override' : undefined,
      actorId: user.id,
    });
    await loadMealData();
  };

  // Save cooking status (Manager only)
  const handleSaveCookingStatus = async () => {
    if (!activeSystem || !user || activeRole !== 'manager') return;
    await updateCookingDayStatus(
      activeSystem.id,
      selectedDate,
      statusVal,
      statusNote.trim(),
      user.id
    );
    setEditingCookingStatus(false);
    await loadMealData();
  };

  // 7-day strip
  const dateStrip: string[] = [];
  const baseDate = new Date(selectedDate);
  for (let i = -3; i <= 3; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    dateStrip.push(d.toISOString().slice(0, 10));
  }

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
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>Daily Meals</h1>
          {isSystemMasterOff ? (
            <span className="badge badge-debt" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
              <PowerOff size={13} /> System OFF (0 Meals)
            </span>
          ) : (
            <span className="badge badge-credit" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
              <Power size={13} /> System Open
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Manager Master ON/OFF Button */}
          {activeRole === 'manager' && (
            <button
              onClick={handleToggleSystemOff}
              disabled={togglingSystem}
              className={`btn btn-sm ${isSystemMasterOff ? 'btn-primary' : 'btn-danger'}`}
              style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
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
          )}

          <input
            type="date"
            className="form-control"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: '0.45rem 0.65rem', width: 'auto' }}
          />
          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`btn btn-sm ${selectedDate === todayStr ? 'btn-primary' : 'btn-secondary'}`}
          >
            Today
          </button>
        </div>
      </div>

      {/* 7-DAY DATE STRIP */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '0.5rem',
        marginBottom: '1.25rem',
        overflowX: 'auto',
      }}>
        {dateStrip.map((dStr) => {
          const isSelected = dStr === selectedDate;
          const isToday = dStr === todayStr;
          const dayCooking = cookingDays.find((c) => c.date === dStr);
          const status = dayCooking?.status || 'cooking';
          const isDayBeforeOpen = dStr < openDate;
          const isDaySystemOff = isSystemMasterOff && (!settings?.meal_system_off_date || dStr >= settings.meal_system_off_date);

          return (
            <button
              key={dStr}
              onClick={() => setSelectedDate(dStr)}
              className="card card-hover"
              style={{
                padding: '0.75rem 0.5rem',
                textAlign: 'center',
                background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                border: isSelected
                  ? '1px solid var(--brand-primary)'
                  : isToday
                  ? '1px solid rgba(255, 255, 255, 0.3)'
                  : '1px solid var(--border-card)',
                cursor: 'pointer',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: isSelected ? 'var(--brand-primary)' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                {formatDate(dStr, { weekday: 'short' })}
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.2rem 0' }}>
                {formatDate(dStr, { day: 'numeric' })}
              </div>
              <div>
                {isDaySystemOff ? (
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-debt)', fontWeight: 700 }}>OFF</span>
                ) : isDayBeforeOpen ? (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Closed</span>
                ) : status === 'no_cooking' ? (
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-debt)', fontWeight: 700 }}>No Cook</span>
                ) : (
                  <span style={{ fontSize: '0.65rem', color: 'var(--brand-primary)' }}>Open</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* SYSTEM STATUS CARD */}
      {isSystemOffForSelectedDate ? (
        <div className="card" style={{
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <PowerOff size={18} color="var(--color-debt)" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--color-debt)' }}>
                Meal System is OFF
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              All meals are 0 until opened by manager.
            </p>
          </div>

          {activeRole === 'manager' && (
            <button
              onClick={handleToggleSystemOff}
              disabled={togglingSystem}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Power size={15} /> Open Meal System
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{
          marginBottom: '1.25rem',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <UtensilsCrossed size={18} color="var(--brand-primary)" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                {isNoCooking ? 'No Cooking Today (0 Meals)' : 'Kitchen Open'}
              </h2>
              <span className={`badge ${isNoCooking ? 'badge-debt' : 'badge-credit'}`} style={{ fontSize: '0.7rem' }}>
                {isNoCooking ? 'Closed' : 'Active'}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={13} />
              <span>
                Cutoffs: Afternoon <strong>{settings?.lunch_cutoff_time?.slice(0, 5) || '10:00'}</strong> • Night <strong>{settings?.dinner_cutoff_time?.slice(0, 5) || '17:00'}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {activeRole === 'manager' && (
              <button
                onClick={() => setEditingCookingStatus(!editingCookingStatus)}
                className="btn btn-secondary btn-sm"
              >
                <Edit2 size={13} /> {editingCookingStatus ? 'Close' : 'No Cook / Note'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Manager Cooking Status Form */}
      {editingCookingStatus && activeRole === 'manager' && !isSystemOffForSelectedDate && (
        <div className="card" style={{ marginBottom: '1.25rem', border: '1px solid var(--border-focus)' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Cooking Status for {selectedDate}</h3>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Cooking Status</label>
              <select
                className="form-control"
                value={statusVal}
                onChange={(e) => setStatusVal(e.target.value as any)}
              >
                <option value="cooking">Cooking Scheduled (2 Meals)</option>
                <option value="no_cooking">No Cooking (0 Meals)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Note</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Cook on leave"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={() => setEditingCookingStatus(false)} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button onClick={handleSaveCookingStatus} className="btn btn-primary btn-sm">
              Save Status
            </button>
          </div>
        </div>
      )}

      {/* PERSONAL SLOT CONTROLS */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>My Meal Status</h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isSystemOffForSelectedDate
                ? '0 Meals (System is OFF)'
                : isNoCooking
                ? 'Cooking cancelled (0 Meals)'
                : `${myEffectiveMeals} ${myEffectiveMeals === 1 ? 'Meal' : 'Meals'}`}
            </p>
          </div>

          {!isNoCooking && !isSystemOffForSelectedDate && (
            <button
              onClick={handleToggleFullMeal}
              className={`btn btn-sm ${isFullMealOff ? 'btn-primary' : 'btn-danger'}`}
            >
              {isFullMealOff ? 'Take Full Day' : 'Cut Full Day'}
            </button>
          )}
        </div>

        {!isNoCooking && !isSystemOffForSelectedDate && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '0.75rem',
          }}>
            {/* Afternoon Slot */}
            <div style={{
              background: 'rgba(11, 15, 25, 0.7)',
              border: `1px solid ${!isAfternoonOff ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem' }}>
                  <Sun size={16} color="var(--accent-amber)" />
                  Afternoon Meal
                </div>
                <div style={{ fontSize: '0.78rem', color: !isAfternoonOff ? 'var(--brand-primary)' : 'var(--color-debt)', marginTop: '0.15rem', fontWeight: 600 }}>
                  {!isAfternoonOff ? 'Taking (1 meal)' : 'Cut (0 meals)'}
                </div>
              </div>

              <button
                onClick={handleToggleAfternoon}
                disabled={cutoff.isAfternoonPastCutoff && activeRole !== 'manager'}
                className={`btn btn-sm ${!isAfternoonOff ? 'btn-danger' : 'btn-primary'}`}
              >
                {!isAfternoonOff ? 'Cut' : 'Take'}
              </button>
            </div>

            {/* Night Slot */}
            <div style={{
              background: 'rgba(11, 15, 25, 0.7)',
              border: `1px solid ${!isNightOff ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem' }}>
                  <Moon size={16} color="var(--accent-indigo)" />
                  Night Meal
                </div>
                <div style={{ fontSize: '0.78rem', color: !isNightOff ? 'var(--brand-primary)' : 'var(--color-debt)', marginTop: '0.15rem', fontWeight: 600 }}>
                  {!isNightOff ? 'Taking (1 meal)' : 'Cut (0 meals)'}
                </div>
              </div>

              <button
                onClick={handleToggleNight}
                disabled={cutoff.isNightPastCutoff && activeRole !== 'manager'}
                className={`btn btn-sm ${!isNightOff ? 'btn-danger' : 'btn-primary'}`}
              >
                {!isNightOff ? 'Cut' : 'Take'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DAILY MEALS SHEET (ALL MEMBERS) */}
      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Members Daily Sheet</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedDate}</span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.85rem' }}>
            <span>Total Meals:</span>
            <strong style={{ fontSize: '1.15rem', color: isNoCooking ? 'var(--text-dim)' : 'var(--brand-primary)' }}>
              {isNoCooking
                ? 0
                : (members.filter((m) => m.status === 'active').length > 0 ? members.filter((m) => m.status === 'active') : members).reduce((sum, mem) => {
                    const rec = mealRecords.find((r) => r.member_id === mem.user_id && r.date === selectedDate);
                    const lOff = rec ? (rec.lunch_turned_off || rec.is_turned_off) : false;
                    const dOff = rec ? (rec.dinner_turned_off || rec.is_turned_off) : false;
                    return sum + (lOff ? 0 : 1) + (dOff ? 0 : 1);
                  }, 0)}
            </strong>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading records..." />
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Afternoon</th>
                  <th>Night</th>
                  <th>Total</th>
                  <th>Status</th>
                  {activeRole === 'manager' && <th style={{ textAlign: 'right' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {(members.filter((m) => m.status === 'active').length > 0 ? members.filter((m) => m.status === 'active') : members).map((mem) => {
                  const rec = mealRecords.find((r) => r.member_id === mem.user_id && r.date === selectedDate);
                  const lOff = isBeforeOpen || isSystemOffForSelectedDate || isNoCooking || (rec ? (rec.lunch_turned_off || rec.is_turned_off) : false);
                  const dOff = isBeforeOpen || isSystemOffForSelectedDate || isNoCooking || (rec ? (rec.dinner_turned_off || rec.is_turned_off) : false);
                  const effectiveTotal = (isBeforeOpen || isSystemOffForSelectedDate || isNoCooking)
                    ? 0
                    : (lOff ? 0 : (rec?.lunch_count ?? 1)) + (dOff ? 0 : (rec?.dinner_count ?? 1));
                  const memberName = mem.profile?.full_name || rec?.member_name || mem.user_id;

                  return (
                    <tr key={mem.id || mem.user_id}>
                      <td style={{ fontWeight: 600 }}>
                        {memberName}
                        {mem.user_id === user?.id && (
                          <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--brand-primary)' }}>
                            (You)
                          </span>
                        )}
                      </td>
                      <td>
                        {isSystemOffForSelectedDate ? (
                          <span className="badge badge-debt">OFF (0)</span>
                        ) : isBeforeOpen ? (
                          <span className="badge badge-secondary">Not Open</span>
                        ) : isNoCooking ? (
                          <span className="badge badge-debt">No Cook</span>
                        ) : lOff ? (
                          <span className="badge badge-debt">Cut (0)</span>
                        ) : (
                          <span className="badge badge-credit">Active (1)</span>
                        )}
                      </td>
                      <td>
                        {isSystemOffForSelectedDate ? (
                          <span className="badge badge-debt">OFF (0)</span>
                        ) : isBeforeOpen ? (
                          <span className="badge badge-secondary">Not Open</span>
                        ) : isNoCooking ? (
                          <span className="badge badge-debt">No Cook</span>
                        ) : dOff ? (
                          <span className="badge badge-debt">Cut (0)</span>
                        ) : (
                          <span className="badge badge-credit">Active (1)</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 800, color: effectiveTotal > 0 ? 'var(--brand-primary)' : 'var(--text-dim)' }}>
                        {effectiveTotal}
                      </td>
                      <td>
                        {isSystemOffForSelectedDate ? (
                          <span className="badge badge-debt">System OFF</span>
                        ) : isBeforeOpen ? (
                          <span className="badge badge-secondary">Not Open</span>
                        ) : isNoCooking ? (
                          <span className="badge badge-debt">No Cook</span>
                        ) : effectiveTotal === 0 ? (
                          <span className="badge badge-debt">Cut (0)</span>
                        ) : (
                          <span className="badge badge-credit">{effectiveTotal} Meals</span>
                        )}
                      </td>

                      {activeRole === 'manager' && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => {
                              setEditingRecord(rec || {
                                id: 'rec-' + mem.user_id + '-' + selectedDate,
                                system_id: activeSystem.id,
                                member_id: mem.user_id,
                                date: selectedDate,
                                meal_count: effectiveTotal,
                                is_turned_off: effectiveTotal === 0,
                                is_post_cutoff_change: false,
                              });
                              setEditingMemberName(memberName);
                              setShowPostCutoffModal(true);
                            }}
                            disabled={isBeforeOpen || isSystemOffForSelectedDate}
                            className="btn btn-secondary btn-sm"
                          >
                            <Edit2 size={13} /> Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PostCutoffModal
        isOpen={showPostCutoffModal}
        onClose={() => {
          setShowPostCutoffModal(false);
          setEditingRecord(null);
        }}
        record={editingRecord}
        memberName={editingMemberName}
        onSuccess={() => {
          loadMealData();
        }}
      />
    </div>
  );
};
