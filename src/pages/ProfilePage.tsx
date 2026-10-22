import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Shield,
  Building,
  LogOut,
  Save,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMealSystem } from '../context/MealSystemContext';

export const ProfilePage: React.FC = () => {
  const { user, signOut } = useAuth();
  const { systems, activeSystem, setActiveSystem } = useMealSystem();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saved, setSaved] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      user.full_name = fullName.trim();
      user.phone = phone.trim();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <div className="page-wrapper" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1>User Profile</h1>
      </div>

      {saved && (
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
          <span>Profile saved</span>
        </div>
      )}

      {/* Profile Info Form */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user?.full_name}
              style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--brand-primary)' }}
            />
          ) : (
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand-primary) 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '1.5rem',
              fontWeight: 800,
            }}>
              {user?.full_name?.charAt(0).toUpperCase() || <User size={28} />}
            </div>
          )}
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>{user?.full_name}</h3>
            <p style={{ fontSize: '0.85rem' }}>{user?.email || ''}</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile}>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-control"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-control"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone Number"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary btn-sm">
              <Save size={14} /> Update Profile
            </button>
          </div>
        </form>
      </div>

      {/* Systems Membership List */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>My Meal Systems</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {systems.map((s) => {
            const isActive = s.id === activeSystem?.id;
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(11, 15, 25, 0.6)',
                  border: isActive ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    System Code: <span style={{ fontFamily: 'var(--font-mono)' }}>{s.code}</span>
                  </div>
                </div>

                <div>
                  {isActive ? (
                    <span className="badge badge-credit">Active System</span>
                  ) : (
                    <button
                      onClick={() => setActiveSystem(s)}
                      className="btn btn-secondary btn-sm"
                    >
                      Switch to This Mess
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sign Out Card */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ color: 'var(--color-debt)' }}>Sign Out</h4>
        </div>
        <button
          onClick={() => signOut()}
          className="btn btn-danger btn-sm"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </div>
  );
};
