import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Edit2,
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

  // Manager edit modal
  const [editingRecord, setEditingRecord] = useState<DailyMealRecord | null>(null);
  const [editingMemberName, setEditingMemberName] = useState<string>('');
  const [showPostCutoffModal, setShowPostCutoffModal] = useState(false);

  // Cooking status edit (Manager)
  const [editingCookingStatus, setEditingCookingStatus] = useState<boolean>(false);
  const [statusVal, setStatusVal] = useState<'cooking' | 'no_cooking' | 'pending'>('cooking');
  const [statusNote, setStatusNote] = useState<string>('');

  const currentPeriod = selectedDate.slice(0, 7);
  const openDate = settings?.meal_start_date || (activeSystem?.created_at ? activeSystem.created_at.slice(0, 10) : undefined) || `${currentPeriod}-01`;
  const isBeforeOpen = selectedDate < openDate;

  // Master Meal System Off status
  const isSystemOff = Boolean(settings?.is_meal_system_off);

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

      const [cDays, mRecords] = await Promise.all([
        getCookingDays(activeSystem.id, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)),
        getDailyMealRecords(activeSystem.id, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)),
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
      console.error(err);
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
  const isNoCooking = isBeforeOpen || isSystemOff || cookingStatus === 'no_cooking';

  // User's record
  const myRecord = mealRecords.find((r) => r.member_id === user?.id && r.date === selectedDate);
  const isAfternoonOff = isNoCooking || (myRecord?.lunch_turned_off ?? myRecord?.is_turned_off ?? false);
  const isNightOff = isNoCooking || (myRecord?.dinner_turned_off ?? myRecord?.is_turned_off ?? false);
  const isFullMealOff = isAfternoonOff && isNightOff;
  const myEffectiveMeals = (isBeforeOpen || isSystemOff || isNoCooking)
    ? 0
    : (isAfternoonOff ? 0 : 1) + (isNightOff ? 0 : 1);

  // Toggle master status
  const handleToggleSystemOff = async () => {
    if (!activeSystem || !user || activeRole !== 'manager') return;
    const newOff = !isSystemOff;

    try {
      setTogglingSystem(true);
      await toggleMealSystemActiveStatus(activeSystem.id, newOff, user.id);
      await refreshSystemData();
      await loadMealData();
    } catch (err: any) {
      alert(err?.message || 'Error');
    } finally {
      setTogglingSystem(false);
    }
  };

  // Toggle Afternoon
  const handleToggleAfternoon = async () => {
    if (!activeSystem || !user || isSystemOff || isNoCooking) return;
    if (cutoff.isAfternoonPastCutoff && activeRole !== 'manager') {
      alert('Cutoff passed');
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
      actorId: user.id,
    });
    await loadMealData();
  };

  // Toggle Night
  const handleToggleNight = async () => {
    if (!activeSystem || !user || isSystemOff || isNoCooking) return;
    if (cutoff.isNightPastCutoff && activeRole !== 'manager') {
      alert('Cutoff passed');
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
      actorId: user.id,
    });
    await loadMealData();
  };

  // Toggle Full
  const handleToggleFullMeal = async () => {
    if (!activeSystem || !user || isSystemOff || isNoCooking) return;
    const willTurnOff = !isFullMealOff;
    if (willTurnOff && cutoff.isFullPastCutoff && activeRole !== 'manager') {
      alert('Cutoff passed');
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
      actorId: user.id,
    });
    await loadMealData();
  };

  // Save cooking status
  const handleSaveCookingStatus = async () => {
    if (!activeSystem || !user || activeRole !== 'manager') return;
    await updateCookingDayStatus(activeSystem.id, selectedDate, statusVal, statusNote.trim(), user.id);
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

  if (loading) return <LoadingSpinner message="Loading..." />;

  if (!activeSystem) {
    return (
      <div className="page-wrapper">
        <EmptyState title="No System" description="Select or create a mess." />
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>Meals</h1>
          <span className={`badge ${isSystemOff ? 'badge-debt' : 'badge-credit'}`}>
            {isSystemOff ? 'System OFF' : 'Active'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {activeRole === 'manager' && (
            <button
              onClick={handleToggleSystemOff}
              disabled={togglingSystem}
              className={`btn btn-sm ${isSystemOff ? 'btn-primary' : 'btn-danger'}`}
            >
              {isSystemOff ? <Power size={14} /> : <PowerOff size={14} />}
              {isSystemOff ? 'Open Meals' : 'Turn Off Meals'}
            </button>
          )}

          <input
            type="date"
            className="form-control"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', width: 'auto' }}
          />
          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`btn btn-sm ${selectedDate === todayStr ? 'btn-primary' : 'btn-secondary'}`}
          >
            Today
          </button>
        </div>
      </div>

      {/* Date Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem', marginBottom: '1rem', overflowX: 'auto' }}>
        {dateStrip.map((dStr) => {
          const isSelected = dStr === selectedDate;
          const isToday = dStr === todayStr;
          const dayCooking = cookingDays.find((c) => c.date === dStr);
          const status = dayCooking?.status || 'cooking';

          return (
            <button
              key={dStr}
              onClick={() => setSelectedDate(dStr)}
              className="card"
              style={{
                padding: '0.6rem 0.35rem',
                textAlign: 'center',
                background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-card)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: isSelected ? 'var(--brand-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                {formatDate(dStr, { weekday: 'short' })}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.15rem 0' }}>
                {formatDate(dStr, { day: 'numeric' })}
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: isSystemOff ? 'var(--color-debt)' : status === 'no_cooking' ? 'var(--color-debt)' : 'var(--brand-primary)' }}>
                {isSystemOff ? 'OFF' : status === 'no_cooking' ? 'No Cook' : 'Open'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kitchen Status Strip */}
      <div className="card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <UtensilsCrossed size={17} color="var(--brand-primary)" />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {isSystemOff ? 'Meal System OFF (0 Meals)' : isNoCooking ? 'No Cooking (0 Meals)' : 'Cooking Active'}
          </span>
          {!isSystemOff && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>
              Cutoffs: Lunch {settings?.lunch_cutoff_time?.slice(0, 5) || '10:00'} • Dinner {settings?.dinner_cutoff_time?.slice(0, 5) || '17:00'}
            </span>
          )}
        </div>

        {activeRole === 'manager' && !isSystemOff && (
          <button
            onClick={() => setEditingCookingStatus(!editingCookingStatus)}
            className="btn btn-secondary btn-sm"
          >
            <Edit2 size={13} /> {editingCookingStatus ? 'Close' : 'Cooking Status'}
          </button>
        )}
      </div>

      {/* Cooking Status Form (Manager) */}
      {editingCookingStatus && activeRole === 'manager' && !isSystemOff && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div className="grid-cols-2">
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label className="form-label">Status</label>
              <select className="form-control" value={statusVal} onChange={(e) => setStatusVal(e.target.value as any)}>
                <option value="cooking">Cooking</option>
                <option value="no_cooking">No Cooking</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label className="form-label">Note</label>
              <input
                type="text"
                className="form-control"
                placeholder="Reason"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={() => setEditingCookingStatus(false)} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={handleSaveCookingStatus} className="btn btn-primary btn-sm">Save</button>
          </div>
        </div>
      )}

      {/* Personal Meal Control */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (!isNoCooking && !isSystemOff) ? '0.75rem' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 600 }}>My Meals:</span>
            <span style={{ fontWeight: 700, color: myEffectiveMeals > 0 ? 'var(--brand-primary)' : 'var(--text-dim)' }}>
              {myEffectiveMeals}
            </span>
          </div>

          {!isNoCooking && !isSystemOff && (
            <button
              onClick={handleToggleFullMeal}
              className={`btn btn-sm ${isFullMealOff ? 'btn-primary' : 'btn-danger'}`}
            >
              {isFullMealOff ? 'Take Full' : 'Cut Full'}
            </button>
          )}
        </div>

        {!isNoCooking && !isSystemOff && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                <Sun size={15} color="var(--accent-amber)" /> Lunch: {!isAfternoonOff ? '1' : '0'}
              </div>
              <button
                onClick={handleToggleAfternoon}
                disabled={cutoff.isAfternoonPastCutoff && activeRole !== 'manager'}
                className={`btn btn-sm ${!isAfternoonOff ? 'btn-danger' : 'btn-primary'}`}
              >
                {!isAfternoonOff ? 'Cut' : 'Take'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                <Moon size={15} color="var(--accent-indigo)" /> Dinner: {!isNightOff ? '1' : '0'}
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

      {/* Member Sheet */}
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Daily Sheet ({selectedDate})</h2>
          <div style={{ fontSize: '0.85rem' }}>
            Total Meals: <strong style={{ color: 'var(--brand-primary)' }}>
              {isNoCooking || isSystemOff
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

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Lunch</th>
                <th>Dinner</th>
                <th>Total</th>
                <th>Status</th>
                {activeRole === 'manager' && <th style={{ textAlign: 'right' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {(members.filter((m) => m.status === 'active').length > 0 ? members.filter((m) => m.status === 'active') : members).map((mem) => {
                const rec = mealRecords.find((r) => r.member_id === mem.user_id && r.date === selectedDate);
                const lOff = isBeforeOpen || isSystemOff || isNoCooking || (rec ? (rec.lunch_turned_off || rec.is_turned_off) : false);
                const dOff = isBeforeOpen || isSystemOff || isNoCooking || (rec ? (rec.dinner_turned_off || rec.is_turned_off) : false);
                const effectiveTotal = (isBeforeOpen || isSystemOff || isNoCooking)
                  ? 0
                  : (lOff ? 0 : (rec?.lunch_count ?? 1)) + (dOff ? 0 : (rec?.dinner_count ?? 1));
                const memberName = mem.profile?.full_name || rec?.member_name || mem.user_id;

                return (
                  <tr key={mem.id || mem.user_id}>
                    <td style={{ fontWeight: 600 }}>
                      {memberName} {mem.user_id === user?.id && <span style={{ color: 'var(--brand-primary)', fontSize: '0.75rem' }}>(You)</span>}
                    </td>
                    <td>
                      <span className={`badge ${lOff ? 'badge-debt' : 'badge-credit'}`}>
                        {lOff ? '0' : '1'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${dOff ? 'badge-debt' : 'badge-credit'}`}>
                        {dOff ? '0' : '1'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: effectiveTotal > 0 ? 'var(--brand-primary)' : 'var(--text-dim)' }}>
                      {effectiveTotal}
                    </td>
                    <td>
                      <span className={`badge ${isSystemOff || isNoCooking ? 'badge-debt' : effectiveTotal > 0 ? 'badge-credit' : 'badge-debt'}`}>
                        {isSystemOff ? 'OFF' : isNoCooking ? 'No Cook' : effectiveTotal > 0 ? 'Active' : 'Cut'}
                      </span>
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
                          disabled={isBeforeOpen || isSystemOff}
                          className="btn btn-secondary btn-sm"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PostCutoffModal
        isOpen={showPostCutoffModal}
        onClose={() => {
          setShowPostCutoffModal(false);
          setEditingRecord(null);
        }}
        record={editingRecord}
        memberName={editingMemberName}
        onSuccess={() => loadMealData()}
      />
    </div>
  );
};
