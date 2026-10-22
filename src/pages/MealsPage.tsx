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
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import {
  getCookingDays,
  getDailyMealRecords,
  saveDailyMealRecord,
  updateCookingDayStatus,
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
  const { activeSystem, activeRole, settings, members } = useMealSystem();
  const { user } = useAuth();

  const todayStr = getDhakaTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [cookingDays, setCookingDays] = useState<CookingDay[]>([]);
  const [mealRecords, setMealRecords] = useState<DailyMealRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
  const isNoCooking = isBeforeOpen || cookingStatus === 'no_cooking';

  // Current user's record on selected date
  const myRecord = mealRecords.find((r) => r.member_id === user?.id && r.date === selectedDate);
  const isAfternoonOff = isNoCooking || (myRecord?.lunch_turned_off ?? myRecord?.is_turned_off ?? false);
  const isNightOff = isNoCooking || (myRecord?.dinner_turned_off ?? myRecord?.is_turned_off ?? false);
  const isFullMealOff = isAfternoonOff && isNightOff;
  const myEffectiveMeals = isBeforeOpen ? 0 : (isAfternoonOff ? 0 : 1) + (isNightOff ? 0 : 1);

  // Toggle user's afternoon meal
  const handleToggleAfternoon = async () => {
    if (!activeSystem || !user) return;
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
    if (isNoCooking) return;

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
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <h1>Daily Meals</h1>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '0.5rem 0.75rem' }}
            />
          </div>
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
        marginBottom: '1.5rem',
        overflowX: 'auto',
      }}>
        {dateStrip.map((dStr) => {
          const isSelected = dStr === selectedDate;
          const isToday = dStr === todayStr;
          const dayCooking = cookingDays.find((c) => c.date === dStr);
          const status = dayCooking?.status || 'cooking';
          const isDayBeforeOpen = dStr < openDate;
          const isDayFuture = dStr > todayStr;

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
                {isDayBeforeOpen ? (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Not Open</span>
                ) : isDayFuture ? (
                  <span style={{ fontSize: '0.65rem', color: '#818cf8' }}>Upcoming</span>
                ) : status === 'cooking' ? (
                  <span style={{ fontSize: '0.65rem', color: 'var(--brand-primary)' }}>Cooking</span>
                ) : status === 'no_cooking' ? (
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-debt)', fontWeight: 700 }}>No Cook</span>
                ) : (
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-warning)' }}>Pending</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* SYSTEM COOKING STATUS HERO CARD */}
      <div
        className="card"
        style={{
          background: isBeforeOpen
            ? 'linear-gradient(135deg, rgba(148, 163, 184, 0.12) 0%, rgba(17, 24, 39, 0.85) 100%)'
            : isNoCooking
            ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(17, 24, 39, 0.85) 100%)'
            : cookingStatus === 'pending'
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(17, 24, 39, 0.85) 100%)'
            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(17, 24, 39, 0.85) 100%)',
          border: `1px solid ${
            isBeforeOpen
              ? 'rgba(148, 163, 184, 0.3)'
              : isNoCooking
              ? 'rgba(244, 63, 94, 0.3)'
              : cookingStatus === 'pending'
              ? 'rgba(245, 158, 11, 0.3)'
              : 'rgba(16, 185, 129, 0.3)'
          }`,
          marginBottom: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Kitchen Status for {formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className={`badge ${isBeforeOpen ? 'badge-secondary' : isNoCooking ? 'badge-debt' : isFutureDate ? 'badge-warning' : cookingStatus === 'pending' ? 'badge-warning' : 'badge-credit'}`}>
                {isBeforeOpen ? 'Mess Not Open Yet' : isNoCooking ? 'No Cooking Today' : isFutureDate ? 'Upcoming Day' : cookingStatus === 'pending' ? 'Pending Confirmation' : 'Cooking Scheduled'}
              </span>
            </div>

            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.35rem' }}>
              {isBeforeOpen
                ? `Kitchen Not Open Yet (Mess started on ${formatDate(openDate)})`
                : isNoCooking
                ? 'Kitchen Closed (0 Meals Charged)'
                : isFutureDate
                ? 'Upcoming Day (Meals count day by day when date arrives)'
                : cookingStatus === 'pending'
                ? 'Schedule Pending Confirmation'
                : 'Regular 2 Meals (Afternoon & Night) • Day Counted'}
            </h3>

            {todayCooking?.note && (
              <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '0.4rem' }}>
                "{todayCooking.note}"
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              <Clock size={14} />
              <span>
                Afternoon Cutoff: <strong>{settings?.lunch_cutoff_time?.slice(0, 5) || '10:00 AM'}</strong> ({cutoff.afternoonTimeLeft}) • Night Cutoff: <strong>{settings?.dinner_cutoff_time?.slice(0, 5) || '17:00 PM'}</strong> ({cutoff.nightTimeLeft})
              </span>
            </div>
          </div>

          {activeRole === 'manager' && (
            <button
              onClick={() => setEditingCookingStatus(!editingCookingStatus)}
              className="btn btn-secondary btn-sm"
            >
              <Edit2 size={14} /> {editingCookingStatus ? 'Cancel Edit' : 'Edit Kitchen Status'}
            </button>
          )}
        </div>

        {/* Manager Cooking Status Form */}
        {editingCookingStatus && activeRole === 'manager' && (
          <div style={{
            marginTop: '1.25rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Update Kitchen Status for {selectedDate}</h4>
            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">Cooking Status</label>
                <select
                  className="form-control"
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value as any)}
                >
                  <option value="cooking">Cooking Scheduled (Afternoon & Night)</option>
                  <option value="no_cooking">No Cooking (Overrides all meals to 0)</option>
                  <option value="pending">Pending Confirmation</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Note / Reason</label>
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
      </div>

      {/* 2 MEALS: PERSONAL SLOT CONTROLS */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3>My Meal Status on {selectedDate}</h3>
            <p>
              {isNoCooking ? (
                'Cooking cancelled'
              ) : isFullMealOff ? (
                '0 Meals'
              ) : (
                `${myEffectiveMeals} ${myEffectiveMeals === 1 ? 'Meal' : 'Meals'}`
              )}
            </p>
          </div>

          {!isNoCooking && (
            <button
              onClick={handleToggleFullMeal}
              className={`btn btn-sm ${isFullMealOff ? 'btn-primary' : 'btn-danger'}`}
            >
              {isFullMealOff ? 'Turn Full Meal ON' : 'Cut Full Meal'}
            </button>
          )}
        </div>

        {!isNoCooking && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
          }}>
            {/* Afternoon Slot */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                  <Sun size={17} color="var(--accent-amber)" />
                  Afternoon Meal
                </div>
                <div style={{ fontSize: '0.8rem', color: !isAfternoonOff ? 'var(--brand-primary)' : 'var(--color-debt)', marginTop: '0.2rem', fontWeight: 600 }}>
                  {!isAfternoonOff ? 'ON (1 meal)' : 'Cut (0 meals)'}
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

            {/* Night Slot */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                  <Moon size={17} color="#a5b4fc" />
                  Night Meal
                </div>
                <div style={{ fontSize: '0.8rem', color: !isNightOff ? 'var(--brand-primary)' : 'var(--color-debt)', marginTop: '0.2rem', fontWeight: 600 }}>
                  {!isNightOff ? 'ON (1 meal)' : 'Cut (0 meals)'}
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

      {/* ALL MEMBERS DAILY MATRIX TABLE */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3>Member Meal Matrix ({selectedDate})</h3>
            <p>Breakdown of Afternoon & Night meals per member</p>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total Meals on {selectedDate}:{' '}
            <strong style={{ color: 'var(--brand-primary)', fontSize: '1.05rem' }}>
              {isBeforeOpen
                ? 0
                : isNoCooking
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
          <LoadingSpinner message="Loading member meal records..." />
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Afternoon Meal (Lunch)</th>
                  <th>Night Meal (Dinner)</th>
                  <th>Total Meals</th>
                  <th>Status</th>
                  <th>Correction Audit</th>
                  {activeRole === 'manager' && <th style={{ textAlign: 'right' }}>Manager Action</th>}
                </tr>
              </thead>
              <tbody>
                {(members.filter((m) => m.status === 'active').length > 0 ? members.filter((m) => m.status === 'active') : members).map((mem) => {
                  const rec = mealRecords.find((r) => r.member_id === mem.user_id && r.date === selectedDate);
                  const lOff = isBeforeOpen || isNoCooking || (rec ? (rec.lunch_turned_off || rec.is_turned_off) : false);
                  const dOff = isBeforeOpen || isNoCooking || (rec ? (rec.dinner_turned_off || rec.is_turned_off) : false);
                  const effectiveTotal = isBeforeOpen || isNoCooking ? 0 : (lOff ? 0 : (rec?.lunch_count ?? 1)) + (dOff ? 0 : (rec?.dinner_count ?? 1));
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
                        {isBeforeOpen ? (
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
                        {isBeforeOpen ? (
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
                        {effectiveTotal} meals
                      </td>
                      <td>
                        {isBeforeOpen ? (
                          <span className="badge badge-secondary">Not Open Yet</span>
                        ) : isNoCooking ? (
                          <span className="badge badge-debt">Kitchen Closed</span>
                        ) : isFutureDate ? (
                          <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                            Upcoming ({effectiveTotal})
                          </span>
                        ) : effectiveTotal === 0 ? (
                          <span className="badge badge-debt">Full Off</span>
                        ) : effectiveTotal === 1 ? (
                          <span className="badge badge-warning">1 Meal</span>
                        ) : (
                          <span className="badge badge-credit">2 Meals</span>
                        )}
                      </td>
                      <td>
                        {rec?.is_post_cutoff_change ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-amber)' }}>
                            Corrected: {rec.change_reason || ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Regular</span>
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
                            disabled={isBeforeOpen}
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
