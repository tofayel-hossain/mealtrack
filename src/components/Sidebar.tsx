import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  ShoppingBag,
  Wallet,
  Users,
  Calculator,
  FileCheck2,
  FileSpreadsheet,
  History,
  UserPlus,
  Settings,
  Shield,
  HelpCircle,
  X,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activeSystem, activeRole } = useMealSystem();

  const navItems = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    { label: 'Daily Meals', to: '/meals', icon: CalendarCheck },
    { label: 'Bazar Tracker', to: '/bazar', icon: ShoppingBag },
    { label: 'Deposits & Ledger', to: '/deposits', icon: Wallet },
    { label: 'Members & Roles', to: '/members', icon: Users },
    { label: 'Monthly Accounting', to: '/accounting', icon: Calculator },
    { label: 'Monthly Closing', to: '/closing', icon: FileCheck2, highlight: true },
    { label: 'Transparency Reports', to: '/reports', icon: FileSpreadsheet },
    { label: 'Audit History', to: '/audit', icon: History },
    { label: 'Invitations', to: '/invitations', icon: UserPlus },
    { label: 'Mess Settings', to: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 40,
          }}
          className="sidebar-backdrop"
        />
      )}

      <aside
        style={{
          width: 'var(--sidebar-width)',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 45,
          transition: 'transform 0.2s ease',
        }}
        className={`sidebar ${isOpen ? 'open' : ''}`}
      >
        {/* Active Mess Info Card */}
        <div style={{
          padding: '1.25rem 1rem 1rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
              Active Mess
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '0.1rem' }}>
              {activeSystem?.name || 'No Mess Selected'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Code: <span style={{ fontFamily: 'var(--font-mono)' }}>{activeSystem?.code || 'N/A'}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm mobile-close-btn"
            style={{ display: 'none', padding: '0.3rem' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  background: isActive ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)' : 'transparent',
                  border: isActive ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid transparent',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                })}
              >
                <Icon size={18} color="currentColor" />
                <span>{item.label}</span>
                {item.highlight && activeRole === 'manager' && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '0.65rem',
                      background: 'rgba(99, 102, 241, 0.25)',
                      color: '#a5b4fc',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 700,
                    }}
                  >
                    Action
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

      </aside>
    </>
  );
};
