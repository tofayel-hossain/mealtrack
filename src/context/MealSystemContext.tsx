import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import type { MealSystem, SystemSettings, SystemMembership, UserRole, SystemNotification } from '../types';
import {
  getUserSystems,
  createMealSystem as apiCreateSystem,
  getSystemSettings,
  getSystemMembers,
  getNotifications,
  markNotificationAsRead,
} from '../services/api';

interface MealSystemContextType {
  systems: MealSystem[];
  activeSystem: MealSystem | null;
  activeRole: UserRole;
  settings: SystemSettings | null;
  members: SystemMembership[];
  notifications: SystemNotification[];
  unreadCount: number;
  loading: boolean;
  setActiveSystem: (system: MealSystem) => void;
  createNewSystem: (name: string, description: string) => Promise<MealSystem>;
  refreshSystemData: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
}

const MealSystemContext = createContext<MealSystemContextType | undefined>(undefined);

export const MealSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [systems, setSystems] = useState<MealSystem[]>([]);
  const [activeSystem, setActiveSystemState] = useState<MealSystem | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('member');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [members, setMembers] = useState<SystemMembership[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    if (!user) {
      setSystems([]);
      setActiveSystemState(null);
      setSettings(null);
      setMembers([]);
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userSystems = await getUserSystems(user.id);
      setSystems(userSystems);

      const savedSysId = localStorage.getItem('mealtrack_active_system_id') || localStorage.getItem('mealhisab_active_system_id');
      let currentSys = userSystems.find((s) => s.id === savedSysId);
      if (!currentSys) {
        currentSys = activeSystem && userSystems.some((s) => s.id === activeSystem.id)
          ? activeSystem
          : userSystems[0] || null;
      }
      setActiveSystemState(currentSys);
      if (currentSys) {
        localStorage.setItem('mealtrack_active_system_id', currentSys.id);
      }

      if (currentSys) {
        const [sysSettings, sysMembers, sysNotifs] = await Promise.all([
          getSystemSettings(currentSys.id),
          getSystemMembers(currentSys.id),
          getNotifications(currentSys.id, user.id),
        ]);

        setSettings(sysSettings);
        setMembers(sysMembers);
        setNotifications(sysNotifs);

        const myMembership = sysMembers.find((m) => m.user_id === user.id);
        setActiveRole(myMembership?.role || 'member');
      }
    } catch (err) {
      console.error('Failed to load meal systems:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const setActiveSystem = async (system: MealSystem) => {
    setActiveSystemState(system);
    localStorage.setItem('mealtrack_active_system_id', system.id);
    if (!user) return;
    try {
      const [sysSettings, sysMembers, sysNotifs] = await Promise.all([
        getSystemSettings(system.id),
        getSystemMembers(system.id),
        getNotifications(system.id, user.id),
      ]);
      setSettings(sysSettings);
      setMembers(sysMembers);
      setNotifications(sysNotifs);

      const myMembership = sysMembers.find((m) => m.user_id === user.id);
      setActiveRole(myMembership?.role || 'member');
    } catch (e) {
      console.error('Error switching active system:', e);
    }
  };

  const createNewSystem = async (name: string, description: string): Promise<MealSystem> => {
    if (!user) throw new Error('Must be logged in to create a system');
    const newSys = await apiCreateSystem(name, description, user.id);
    await loadData();
    setActiveSystem(newSys);
    return newSys;
  };

  const markAsRead = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <MealSystemContext.Provider
      value={{
        systems,
        activeSystem,
        activeRole,
        settings,
        members,
        notifications,
        unreadCount,
        loading,
        setActiveSystem,
        createNewSystem,
        refreshSystemData: loadData,
        markAsRead,
      }}
    >
      {children}
    </MealSystemContext.Provider>
  );
};

export const useMealSystem = () => {
  const context = useContext(MealSystemContext);
  if (!context) {
    throw new Error('useMealSystem must be used within a MealSystemProvider');
  }
  return context;
};
