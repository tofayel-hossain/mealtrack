import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Shield,
  Clock,
  User,
  ArrowRight,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { getAuditLogs } from '../services/api';
import { formatDateTime } from '../utils/formatters';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import type { AuditLogEntry } from '../types';

export const AuditHistoryPage: React.FC = () => {
  const { activeSystem } = useMealSystem();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const loadAuditLogs = async () => {
    if (!activeSystem) return;
    try {
      setLoading(true);
      const data = await getAuditLogs(activeSystem.id);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSystem) {
      setLoading(false);
      return;
    }
    loadAuditLogs();
  }, [activeSystem?.id]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.actor_name && log.actor_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.reason && log.reason.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;

    return matchesSearch && matchesAction;
  });

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
          <h1>Audit History</h1>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by actor, action, or reason..."
              className="form-control"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.2rem' }}
            />
          </div>

          <div style={{ flex: '0 1 220px' }}>
            <select
              className="form-control"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">All Action Types</option>
              <option value="POST_CUTOFF_MEAL_CORRECTION">Post-Cutoff Meal Correction</option>
              <option value="EXPENSE_RECORDED">Expense Recorded</option>
              <option value="EXPENSE_REVERSED">Expense Reversed</option>
              <option value="DEPOSIT_RECORDED">Deposit Recorded</option>
              <option value="DEPOSIT_REVERSED">Deposit Reversed</option>
              <option value="COOKING_STATUS_CHANGED">Cooking Status Changed</option>
              <option value="MANAGER_ROLE_TRANSFERRED">Manager Role Transferred</option>
              <option value="MONTHLY_REPORT_FINALIZED">Monthly Report Finalized</option>
              <option value="SYSTEM_SETTINGS_UPDATED">System Settings Updated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Stream */}
      <div className="card">
        {loading ? (
          <LoadingSpinner message="Retrieving audit history..." />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={History}
            title="No Audit Records Found"
            description="No audit logs matched your search filters."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '1rem',
                  background: 'rgba(11, 15, 25, 0.6)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
                      {log.action_type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Target: <strong style={{ color: 'var(--text-main)' }}>{log.target_type}</strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    <Clock size={13} />
                    <span>{formatDateTime(log.created_at)}</span>
                  </div>
                </div>

                <div style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  Action taken by <strong>{log.actor_name || 'System Member'}</strong>: {log.reason ? `"${log.reason}"` : 'No explicit reason given.'}
                </div>

                {/* Diff Viewer if previous or new values exist */}
                {(log.previous_value || log.new_value) && (
                  <div style={{
                    background: 'var(--bg-secondary)',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.775rem',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}>
                    {log.previous_value && (
                      <div style={{ color: 'var(--color-debt)' }}>
                        <span style={{ color: 'var(--text-dim)' }}>Previous:</span> {JSON.stringify(log.previous_value)}
                      </div>
                    )}
                    {log.new_value && (
                      <div style={{ color: 'var(--brand-primary)' }}>
                        <span style={{ color: 'var(--text-dim)' }}>New Value:</span> {JSON.stringify(log.new_value)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
