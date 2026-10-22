import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  ChevronDown,
  Plus,
  Bell,
  User,
  Shield,
  CheckCircle,
  Menu,
  Clock,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMealSystem } from '../context/MealSystemContext';
import { getMealCutoffInfo } from '../utils/formatters';

interface NavbarProps {
  onToggleSidebar?: () => void;
  onOpenCreateSystem?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onOpenCreateSystem }) => {
  const { user, signOut, isConfigured } = useAuth();
  const {
    systems,
    activeSystem,
    activeRole,
    settings,
    notifications,
    unreadCount,
    setActiveSystem,
    markAsRead,
  } = useMealSystem();
  const navigate = useNavigate();

  const [showSystemMenu, setShowSystemMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const cutoff = getMealCutoffInfo({
    lunchCutoffTime: settings?.lunch_cutoff_time,
    dinnerCutoffTime: settings?.dinner_cutoff_time,
  });

  return (
    <header className="navbar" style={{
      height: 'var(--header-height)',
      background: 'rgba(17, 24, 39, 0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      {/* Left: Mobile Toggle & System Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={onToggleSidebar}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', padding: '0.4rem', border: 'none' }}
          aria-label="Toggle Menu"
        >
          <Menu size={20} />
        </button>

        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '0.5rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <UtensilsCrossed size={19} color="#ffffff" />
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            MealTrack
          </div>
        </Link>

        {/* System Switcher */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSystemMenu(!showSystemMenu)}
            className="btn btn-secondary btn-sm"
            style={{
              background: 'rgba(31, 41, 55, 0.7)',
              border: '1px solid var(--border-card)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600,
            }}
          >
            <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeSystem?.name || 'Select Mess'}
            </span>
            <ChevronDown size={14} />
          </button>

          {showSystemMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '0.5rem',
                width: '260px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '0.5rem',
                zIndex: 100,
              }}
            >
              <div style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Meal Systems
              </div>
              {systems.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSystem(s);
                    setShowSystemMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.6rem 0.75rem',
                    background: activeSystem?.id === s.id ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: activeSystem?.id === s.id ? 'var(--brand-primary)' : 'var(--text-main)',
                    fontWeight: activeSystem?.id === s.id ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.875rem' }}>{s.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Code: {s.code}</div>
                  </div>
                  {activeSystem?.id === s.id && <CheckCircle size={14} />}
                </button>
              ))}

              <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0.4rem 0' }} />
              <button
                onClick={() => {
                  setShowSystemMenu(false);
                  if (onOpenCreateSystem) onOpenCreateSystem();
                }}
                className="btn btn-outline btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Plus size={14} /> Create New Mess
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: Sequential Cutoff Information */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {settings?.lunch_cutoff_time && settings?.dinner_cutoff_time && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: cutoff.isFullPastCutoff
              ? 'rgba(244, 63, 94, 0.12)'
              : cutoff.isAfternoonPastCutoff
              ? 'rgba(245, 158, 11, 0.12)'
              : 'rgba(16, 185, 129, 0.12)',
            border: `1px solid ${
              cutoff.isFullPastCutoff
                ? 'rgba(244, 63, 94, 0.3)'
                : cutoff.isAfternoonPastCutoff
                ? 'rgba(245, 158, 11, 0.3)'
                : 'rgba(16, 185, 129, 0.3)'
            }`,
            padding: '0.35rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.775rem',
            fontWeight: 600,
          }}>
            <Clock size={13} />
            <span>
              Afternoon: {settings.lunch_cutoff_time.slice(0, 5)} ({cutoff.afternoonTimeLeft}) • Night: {settings.dinner_cutoff_time.slice(0, 5)} ({cutoff.nightTimeLeft})
            </span>
          </div>
        )}

        <span className={`badge badge-${activeRole}`}>
          {activeRole === 'manager' ? <Shield size={12} /> : <User size={12} />}
          {activeRole}
        </span>
      </div>

      {/* Right: Notifications & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="btn btn-secondary btn-sm"
            style={{ position: 'relative', padding: '0.5rem' }}
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: 'var(--accent-rose)',
                color: 'white',
                fontSize: '0.65rem',
                fontWeight: 800,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              width: '320px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '0.75rem',
              zIndex: 100,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Notifications</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{notifications.length} total</span>
              </div>
              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    No notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      style={{
                        padding: '0.6rem',
                        background: n.is_read ? 'transparent' : 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.825rem', color: n.is_read ? 'var(--text-main)' : 'var(--brand-primary)' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {n.message}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(31, 41, 55, 0.8)',
              border: '1px solid var(--border-card)',
            }}
          >
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>
              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
              {user?.full_name || 'Account'}
            </span>
            <ChevronDown size={14} />
          </button>

          {showUserMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              width: '240px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '0.75rem',
              zIndex: 100,
            }}>
              <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{user?.full_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email || 'Logged In'}</div>
                <div style={{ marginTop: '0.35rem' }}>
                  <span className={`badge badge-${activeRole}`} style={{ fontSize: '0.65rem' }}>
                    {activeRole}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                >
                  <User size={14} /> Profile
                </Link>
                <button
                  onClick={() => {
                    signOut();
                    setShowUserMenu(false);
                    navigate('/login');
                  }}
                  className="btn btn-danger btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
