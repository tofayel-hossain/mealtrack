import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Clock,
  DollarSign,
  Globe,
  UtensilsCrossed,
  CheckCircle,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import { updateSystemSettings } from '../services/api';
import { EmptyState } from '../components/EmptyState';
import type { SystemSettings } from '../types';

export const SettingsPage: React.FC = () => {
  const { activeSystem, settings, activeRole, refreshSystemData } = useMealSystem();
  const { user } = useAuth();

  const [currencySymbol, setCurrencySymbol] = useState('');
  const [currencyCode, setCurrencyCode] = useState('');
  const [timezone, setTimezone] = useState('');
  const [defaultMeals, setDefaultMeals] = useState<number | ''>('');
  const [lunchCutoffTime, setLunchCutoffTime] = useState('');
  const [dinnerCutoffTime, setDinnerCutoffTime] = useState('');
  const [allowCustomMeals, setAllowCustomMeals] = useState(false);
  const [autoAssignMeals, setAutoAssignMeals] = useState(false);
  const [mealStartDate, setMealStartDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setCurrencySymbol(settings.currency_symbol || '');
      setCurrencyCode(settings.currency_code || '');
      setTimezone(settings.timezone || '');
      setDefaultMeals(settings.default_daily_meals ?? '');
      setLunchCutoffTime(settings.lunch_cutoff_time || settings.cutoff_time || '');
      setDinnerCutoffTime(settings.dinner_cutoff_time || '');
      setAllowCustomMeals(settings.allow_custom_meals ?? false);
      setAutoAssignMeals(settings.auto_assign_meals ?? false);
      setMealStartDate(settings.meal_start_date || (activeSystem?.created_at ? activeSystem.created_at.slice(0, 10) : ''));
    }
  }, [settings, activeSystem?.created_at]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSystem || !user || activeRole !== 'manager') return;

    try {
      setSaving(true);
      setSuccessMsg(null);

      const formattedLunch = lunchCutoffTime.length === 5 ? `${lunchCutoffTime}:00` : lunchCutoffTime;
      const formattedDinner = dinnerCutoffTime.length === 5 ? `${dinnerCutoffTime}:00` : dinnerCutoffTime;

      await updateSystemSettings(
        activeSystem.id,
        {
          currency_symbol: currencySymbol.trim(),
          currency_code: currencyCode.trim(),
          timezone: timezone.trim(),
          default_daily_meals: typeof defaultMeals === 'number' ? defaultMeals : 0,
          lunch_cutoff_time: formattedLunch,
          dinner_cutoff_time: formattedDinner,
          cutoff_time: formattedLunch,
          allow_custom_meals: allowCustomMeals,
          auto_assign_meals: autoAssignMeals,
          meal_start_date: mealStartDate || null,
        },
        user.id
      );

      await refreshSystemData();
      setSuccessMsg('Settings updated successfully');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (!activeSystem) {
    return (
      <div className="page-wrapper" style={{ maxWidth: '850px' }}>
        <EmptyState
          title="No Mess System"
          description="Please create or join a mess system first."
        />
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ maxWidth: '850px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <h1>Mess Settings</h1>
        </div>

        {activeRole !== 'manager' && (
          <span className="badge badge-member">
            Read-Only
          </span>
        )}
      </div>

      {successMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          color: 'var(--brand-primary)',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Meals & Cutoffs</h3>

          <div className="grid-cols-3">
            <div className="form-group">
              <label className="form-label">Daily Meals</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="6"
                className="form-control"
                value={defaultMeals}
                onChange={(e) => setDefaultMeals(e.target.value === '' ? '' : parseFloat(e.target.value))}
                disabled={activeRole !== 'manager'}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Afternoon Cutoff</label>
              <input
                type="time"
                step="1"
                className="form-control"
                value={lunchCutoffTime.slice(0, 5)}
                onChange={(e) => setLunchCutoffTime(e.target.value)}
                disabled={activeRole !== 'manager'}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Night Cutoff</label>
              <input
                type="time"
                step="1"
                className="form-control"
                value={dinnerCutoffTime.slice(0, 5)}
                onChange={(e) => setDinnerCutoffTime(e.target.value)}
                disabled={activeRole !== 'manager'}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Meal System Start Date</label>
              <input
                type="date"
                className="form-control"
                value={mealStartDate}
                onChange={(e) => setMealStartDate(e.target.value)}
                disabled={activeRole !== 'manager'}
              />
            </div>
          </div>

          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: activeRole === 'manager' ? 'pointer' : 'default' }}>
              <input
                type="checkbox"
                checked={allowCustomMeals}
                onChange={(e) => setAllowCustomMeals(e.target.checked)}
                disabled={activeRole !== 'manager'}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-main)' }}>
                Allow custom meal counts
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: activeRole === 'manager' ? 'pointer' : 'default' }}>
              <input
                type="checkbox"
                checked={autoAssignMeals}
                onChange={(e) => setAutoAssignMeals(e.target.checked)}
                disabled={activeRole !== 'manager'}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-main)' }}>
                Auto assign default meals
              </span>
            </label>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Currency & Region</h3>

          <div className="grid-cols-3">
            <div className="form-group">
              <label className="form-label">Currency Symbol</label>
              <input
                type="text"
                className="form-control"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                disabled={activeRole !== 'manager'}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Currency Code</label>
              <input
                type="text"
                className="form-control"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                disabled={activeRole !== 'manager'}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Timezone</label>
              <input
                type="text"
                className="form-control"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={activeRole !== 'manager'}
                required
              />
            </div>
          </div>
        </div>

        {activeRole === 'manager' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={saving}
            >
              <Save size={18} /> {saving ? 'Saving Changes...' : 'Save System Settings'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
