import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Shield,
  KeyRound,
  LogOut,
  Save,
  CheckCircle,
  AlertCircle,
  Building,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMealSystem } from '../context/MealSystemContext';

export const ProfilePage: React.FC = () => {
  const { user, signOut, updateProfile, updatePassword } = useAuth();
  const { systems, activeSystem, setActiveSystem, refreshSystemData } = useMealSystem();

  // Profile Edit State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Sync state if user reloads
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  // Handle Save Profile (Name & Phone)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);

    const cleanName = fullName.trim();
    if (!cleanName) {
      setProfileErrorMsg('Full name cannot be empty.');
      return;
    }

    try {
      setProfileSaving(true);
      await updateProfile(cleanName, phone.trim() || undefined);
      await refreshSystemData();
      setProfileSuccessMsg('Profile updated successfully! Your updated name will now appear on all mess records.');
      setTimeout(() => setProfileSuccessMsg(null), 5000);
    } catch (err: any) {
      setProfileErrorMsg(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    if (newPassword.length < 6) {
      setPasswordErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('New password and confirm password do not match.');
      return;
    }

    try {
      setPasswordSaving(true);
      await updatePassword(newPassword, currentPassword || undefined);
      setPasswordSuccessMsg('Password changed successfully! Please use your new password next time you sign in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccessMsg(null), 6000);
    } catch (err: any) {
      setPasswordErrorMsg(err?.message || 'Failed to change password. Please check your current password and try again.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ maxWidth: '820px', margin: '0 auto' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <User size={28} color="var(--brand-primary)" />
          Profile
        </h1>
      </div>

      {/* CARD 1: PROFILE INFORMATION */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user?.full_name}
              style={{ width: '68px', height: '68px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--brand-primary)' }}
            />
          ) : (
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand-primary) 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '1.75rem',
              fontWeight: 800,
            }}>
              {user?.full_name?.charAt(0).toUpperCase() || <User size={30} />}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>{user?.full_name || 'Member'}</h2>
              <span className="badge badge-credit" style={{ fontSize: '0.72rem' }}>
                Active
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Mail size={14} color="var(--text-dim)" />
              {user?.email || 'No email'}
            </p>
          </div>
        </div>

        {profileSuccessMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            color: 'var(--brand-primary)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            marginBottom: '1.25rem',
          }}>
            <CheckCircle size={18} />
            <span>{profileSuccessMsg}</span>
          </div>
        )}

        {profileErrorMsg && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-debt)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            marginBottom: '1.25rem',
          }}>
            <AlertCircle size={18} />
            <span>{profileErrorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile}>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                Full Name <span style={{ color: 'var(--color-debt)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '2.4rem' }}
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Phone</label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="tel"
                  className="form-control"
                  style={{ paddingLeft: '2.4rem' }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={profileSaving}
              style={{ minWidth: '120px' }}
            >
              <Save size={16} />
              {profileSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      {/* CARD 2: PASSWORD */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <KeyRound size={20} color="var(--accent-indigo)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Password</h2>
        </div>

        {passwordSuccessMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            color: 'var(--brand-primary)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            marginBottom: '1.25rem',
          }}>
            <CheckCircle size={18} />
            <span>{passwordSuccessMsg}</span>
          </div>
        )}

        {passwordErrorMsg && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-debt)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            marginBottom: '1.25rem',
          }}>
            <AlertCircle size={18} />
            <span>{passwordErrorMsg}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              Current Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                className="form-control"
                style={{ paddingLeft: '2.4rem', paddingRight: '2.5rem' }}
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                }}
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="grid-cols-2" style={{ marginBottom: '0.5rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                New Password <span style={{ color: 'var(--color-debt)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="form-control"
                  style={{ paddingLeft: '2.4rem', paddingRight: '2.5rem' }}
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                  }}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                Confirm New Password <span style={{ color: 'var(--color-debt)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-control"
                  style={{ paddingLeft: '2.4rem', paddingRight: '2.5rem' }}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={passwordSaving || (!!confirmPassword && newPassword !== confirmPassword)}
              style={{ minWidth: '150px' }}
            >
              <KeyRound size={16} />
              {passwordSaving ? 'Saving...' : 'Save Password'}
            </button>
          </div>
        </form>
      </div>

      {/* CARD 3: MY MEAL SYSTEMS */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Building size={20} color="var(--brand-primary)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Mess Systems</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {systems.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No mess systems found.
            </p>
          ) : (
            systems.map((s) => {
              const isActive = s.id === activeSystem?.id;
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    background: isActive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(11, 15, 25, 0.5)',
                    border: isActive ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Code: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.code}</span>
                    </div>
                  </div>

                  <div>
                    {isActive ? (
                      <span className="badge badge-credit">Active</span>
                    ) : (
                      <button
                        onClick={() => setActiveSystem(s)}
                        className="btn btn-secondary btn-sm"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CARD 4: SIGN OUT */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Sign Out</h3>
        </div>
        <button
          onClick={() => signOut()}
          className="btn btn-danger btn-sm"
          style={{ padding: '0.5rem 1rem' }}
        >
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
  );
};
