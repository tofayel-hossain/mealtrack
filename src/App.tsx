import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MealSystemProvider, useMealSystem } from './context/MealSystemContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { CreateSystemModal } from './components/CreateSystemModal';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { MealsPage } from './pages/MealsPage';
import { BazarPage } from './pages/BazarPage';
import { DepositsPage } from './pages/DepositsPage';
import { MembersPage } from './pages/MembersPage';
import { AccountingPage } from './pages/AccountingPage';
import { MonthlyClosingPage } from './pages/MonthlyClosingPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditHistoryPage } from './pages/AuditHistoryPage';
import { InvitationsPage } from './pages/InvitationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';

// Protected App Layout
const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { refreshSystemData } = useMealSystem();

  if (loading && !user) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Navbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenCreateSystem={() => setShowCreateModal(true)}
        />
        {children}
      </div>

      <CreateSystemModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => refreshSystemData()}
      />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MealSystemProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedLayout>
                  <DashboardPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/meals"
              element={
                <ProtectedLayout>
                  <MealsPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/bazar"
              element={
                <ProtectedLayout>
                  <BazarPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/deposits"
              element={
                <ProtectedLayout>
                  <DepositsPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/members"
              element={
                <ProtectedLayout>
                  <MembersPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/accounting"
              element={
                <ProtectedLayout>
                  <AccountingPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/closing"
              element={
                <ProtectedLayout>
                  <MonthlyClosingPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedLayout>
                  <ReportsPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedLayout>
                  <AuditHistoryPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/invitations"
              element={
                <ProtectedLayout>
                  <InvitationsPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedLayout>
                  <SettingsPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedLayout>
                  <ProfilePage />
                </ProtectedLayout>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </MealSystemProvider>
    </AuthProvider>
  );
}

export default App;
