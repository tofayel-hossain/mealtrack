// ==============================================================================
// MEALTRACK: PRODUCTION DATA ACCESS & SERVICE LAYER
// Seamlessly interfaces with Supabase Auth, PostgreSQL DB, Storage, and RPCs.
// Handles 2 meals (Afternoon & Night), individual slot cutoffs, and full meal cuts.
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  UserProfile,
  MealSystem,
  SystemSettings,
  SystemMembership,
  SystemInvitation,
  CookingDay,
  DailyMealRecord,
  BazarExpense,
  Deposit,
  FinancialLedgerEntry,
  MonthlyAccountingSummary,
  MonthlyMemberSummary,
  MonthlyReportSnapshot,
  AuditLogEntry,
  SystemNotification,
  FixedCostItem,
  FixedCostCategory,
  MonthlyCostsConfig,
} from '../types';
import {
  calculateMonthlyMealRate,
  calculateMemberMealCost,
  calculateMealContributionPercentage,
  calculateClosingBalance,
  calculateNetPayable,
  getBalanceStatus,
  computeEffectiveMealCount,
  roundToDecimals,
} from '../utils/accounting';

// In-memory store (active when Supabase is disconnected or during fallback)
const store = {
  profiles: [] as UserProfile[],
  systems: [] as MealSystem[],
  settings: {} as Record<string, SystemSettings>,
  memberships: [] as SystemMembership[],
  invitations: [] as SystemInvitation[],
  cookingDays: [] as CookingDay[],
  mealRecords: [] as DailyMealRecord[],
  bazarExpenses: [] as BazarExpense[],
  deposits: [] as Deposit[],
  ledger: [] as FinancialLedgerEntry[],
  snapshots: [] as MonthlyReportSnapshot[],
  auditLogs: [] as AuditLogEntry[],
  notifications: [] as SystemNotification[],
};

// -----------------------------------------------------------------------------
// AUDIT LOG HELPER
// -----------------------------------------------------------------------------
export async function logAuditAction(params: {
  systemId: string;
  actorId: string;
  actionType: string;
  targetType: string;
  targetId?: string;
  previousValue?: any;
  newValue?: any;
  reason?: string;
}): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('audit_logs').insert({
        system_id: params.systemId,
        actor_id: params.actorId,
        action_type: params.actionType,
        target_type: params.targetType,
        target_id: params.targetId,
        previous_value: params.previousValue,
        new_value: params.newValue,
        reason: params.reason,
      });
      return;
    } catch (e) {
      console.warn('Supabase audit log fallback:', e);
    }
  }

  const actor = store.profiles.find((p) => p.id === params.actorId);
  store.auditLogs.unshift({
    id: 'aud-' + Date.now(),
    system_id: params.systemId,
    actor_id: params.actorId,
    actor_name: actor?.full_name || '',
    action_type: params.actionType,
    target_type: params.targetType,
    target_id: params.targetId,
    previous_value: params.previousValue,
    new_value: params.newValue,
    reason: params.reason,
    created_at: new Date().toISOString(),
  });
}

// -----------------------------------------------------------------------------
// USER & SYSTEM MANAGEMENT
// -----------------------------------------------------------------------------

export async function getUserSystems(userId: string): Promise<MealSystem[]> {
  if (isSupabaseConfigured && supabase) {
    const { data: memberships, error } = await supabase
      .from('system_memberships')
      .select('system_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (!error && memberships && memberships.length > 0) {
      const systemIds = memberships.map((m) => m.system_id);
      const { data: systems } = await supabase
        .from('meal_systems')
        .select('*')
        .in('id', systemIds);
      return systems || [];
    }
    return [];
  }

  const activeSystemIds = store.memberships
    .filter((m) => m.user_id === userId && m.status === 'active')
    .map((m) => m.system_id);
  const matched = store.systems.filter((s) => activeSystemIds.includes(s.id));
  return matched;
}

export async function createMealSystem(
  name: string,
  description: string,
  userId: string
): Promise<MealSystem> {
  const code = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);

  if (isSupabaseConfigured && supabase) {
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id || userId;

    if (!authData?.user) {
      throw new Error('Your session has expired or is not authenticated. Please log in again.');
    }

    // Try transactional RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_meal_system_tx', {
        p_name: name,
        p_description: description || null,
      });

      if (!rpcError && rpcData) {
        return rpcData as MealSystem;
      }

      if (rpcError && !rpcError.message?.includes('function') && !rpcError.message?.includes('does not exist')) {
        throw rpcError;
      }
    } catch (rpcErr: any) {
      if (rpcErr?.message && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
        throw rpcErr;
      }
    }

    // Fallback: direct table inserts
    // Ensure profile row exists to prevent foreign key issues
    await supabase.from('profiles').upsert(
      {
        id: currentUserId,
        full_name: authData.user.user_metadata?.full_name || name,
        phone: authData.user.user_metadata?.phone || null,
      },
      { onConflict: 'id' }
    );

    const { data: newSystem, error } = await supabase
      .from('meal_systems')
      .insert({ name, description, code, created_by: currentUserId })
      .select()
      .single();

    if (error) throw error;

    await supabase.from('system_memberships').insert({
      system_id: newSystem.id,
      user_id: currentUserId,
      role: 'manager',
      status: 'active',
    });

    await supabase.from('system_settings').upsert(
      {
        system_id: newSystem.id,
        currency_symbol: '৳',
        currency_code: 'BDT',
        timezone: 'Asia/Dhaka',
        default_daily_meals: 2.0,
        lunch_cutoff_time: '10:00:00',
        dinner_cutoff_time: '17:00:00',
        allow_custom_meals: true,
        auto_assign_meals: true,
      },
      { onConflict: 'system_id' }
    );

    return newSystem;
  }

  const newSystem: MealSystem = {
    id: 'sys-' + Date.now(),
    name,
    code,
    description,
    created_by: userId,
    created_at: new Date().toISOString(),
  };
  store.systems.push(newSystem);
  store.memberships.push({
    id: 'mem-' + Date.now(),
    system_id: newSystem.id,
    user_id: userId,
    role: 'manager',
    status: 'active',
    joined_at: new Date().toISOString(),
  });
  store.settings[newSystem.id] = {
    system_id: newSystem.id,
    currency_symbol: '৳',
    currency_code: 'BDT',
    timezone: 'Asia/Dhaka',
    default_daily_meals: 2.0,
    lunch_cutoff_time: '10:00:00',
    dinner_cutoff_time: '17:00:00',
    allow_custom_meals: true,
    auto_assign_meals: true,
  };

  await logAuditAction({
    systemId: newSystem.id,
    actorId: userId,
    actionType: 'SYSTEM_CREATED',
    targetType: 'meal_systems',
    targetId: newSystem.id,
    newValue: { name, code },
    reason: 'New meal system created',
  });

  return newSystem;
}

export async function getSystemSettings(systemId: string): Promise<SystemSettings> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from('system_settings')
      .select('*')
      .eq('system_id', systemId)
      .single();
    if (data) {
      return {
        ...data,
        lunch_cutoff_time: data.lunch_cutoff_time || data.cutoff_time || '10:00:00',
        dinner_cutoff_time: data.dinner_cutoff_time || '17:00:00',
      };
    }
  }

  const current = store.settings[systemId];
  return (
    current || {
      system_id: systemId,
      currency_symbol: '৳',
      currency_code: 'BDT',
      timezone: 'Asia/Dhaka',
      default_daily_meals: 2.0,
      lunch_cutoff_time: '10:00:00',
      dinner_cutoff_time: '17:00:00',
      allow_custom_meals: true,
      auto_assign_meals: true,
    }
  );
}

export async function updateSystemSettings(
  systemId: string,
  newSettings: Partial<SystemSettings>,
  actorId: string
): Promise<SystemSettings> {
  const prev = await getSystemSettings(systemId);
  const updated = { ...prev, ...newSettings, updated_at: new Date().toISOString() };

  if (isSupabaseConfigured && supabase) {
    await supabase.from('system_settings').upsert(updated);
  } else {
    store.settings[systemId] = updated;
  }

  await logAuditAction({
    systemId,
    actorId,
    actionType: 'SYSTEM_SETTINGS_UPDATED',
    targetType: 'system_settings',
    targetId: systemId,
    previousValue: prev,
    newValue: updated,
    reason: 'System settings adjusted by manager',
  });

  return updated;
}

export async function getSystemMembers(systemId: string): Promise<SystemMembership[]> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from('system_memberships')
      .select('*, profile:profiles(*)')
      .eq('system_id', systemId)
      .eq('status', 'active');
    if (data) return data;
  }

  return store.memberships
    .filter((m) => m.system_id === systemId && m.status === 'active')
    .map((m) => ({
      ...m,
      profile: store.profiles.find((p) => p.id === m.user_id),
    }));
}

export async function transferManagerRole(
  systemId: string,
  newManagerId: string,
  reason: string,
  currentManagerId: string
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc('transfer_manager_role', {
      p_system_id: systemId,
      p_new_manager_id: newManagerId,
      p_reason: reason,
    });
    if (error) throw error;
    return;
  }

  const currentMgr = store.memberships.find(
    (m) => m.system_id === systemId && m.user_id === currentManagerId
  );
  const targetMember = store.memberships.find(
    (m) => m.system_id === systemId && m.user_id === newManagerId
  );

  if (!currentMgr || currentMgr.role !== 'manager') {
    throw new Error('Only the active manager can transfer system leadership.');
  }
  if (!targetMember) {
    throw new Error('Target user must be an active member of this system.');
  }

  currentMgr.role = 'member';
  targetMember.role = 'manager';

  await logAuditAction({
    systemId,
    actorId: currentManagerId,
    actionType: 'MANAGER_ROLE_TRANSFERRED',
    targetType: 'system_memberships',
    targetId: newManagerId,
    previousValue: { manager_id: currentManagerId },
    newValue: { manager_id: newManagerId },
    reason,
  });
}

// -----------------------------------------------------------------------------
// INVITATIONS
// -----------------------------------------------------------------------------

export async function createSystemInvitation(
  systemId: string,
  invitedBy: string,
  email?: string,
  role: 'member' | 'manager' = 'member'
): Promise<SystemInvitation> {
  const token = 'INV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('system_invitations')
      .insert({
        system_id: systemId,
        token,
        role,
        invited_by: invitedBy,
        email: email || null,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const inv: SystemInvitation = {
    id: 'inv-' + Date.now(),
    system_id: systemId,
    token,
    role,
    invited_by: invitedBy,
    email: email || null,
    status: 'pending',
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };

  store.invitations.unshift(inv);
  return inv;
}

export async function acceptSystemInvitation(
  token: string,
  userId: string
): Promise<{ system_id: string }> {
  const cleanToken = token.trim().toUpperCase();

  if (isSupabaseConfigured && supabase) {
    // 1. Try atomic RPC if available
    try {
      const { data, error } = await supabase.rpc('accept_system_invitation', {
        p_token: cleanToken,
      });

      if (!error && data) {
        return data as { system_id: string };
      }

      if (error && !error.message?.includes('function') && !error.message?.includes('does not exist')) {
        throw error;
      }
    } catch (rpcErr: any) {
      if (rpcErr?.message && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
        throw rpcErr;
      }
    }

    // 2. Direct table fallback
    const { data: inv, error: findError } = await supabase
      .from('system_invitations')
      .select('*')
      .eq('token', cleanToken)
      .eq('status', 'pending')
      .single();

    if (findError || !inv) {
      throw new Error('Invalid or expired invitation token.');
    }

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      throw new Error('Please log in first to accept the invitation.');
    }
    const currentUserId = authData.user.id;

    await supabase.from('profiles').upsert(
      {
        id: currentUserId,
        full_name: authData.user.user_metadata?.full_name || 'Member',
        phone: authData.user.user_metadata?.phone || null,
      },
      { onConflict: 'id' }
    );

    const { error: memError } = await supabase.from('system_memberships').upsert(
      {
        system_id: inv.system_id,
        user_id: currentUserId,
        role: inv.role || 'member',
        status: 'active',
      },
      { onConflict: 'system_id, user_id' }
    );

    if (memError) throw memError;

    try {
      await supabase
        .from('system_invitations')
        .update({ status: 'accepted' })
        .eq('id', inv.id);
    } catch {
      // Non-fatal if invitations update policy is restricted
    }

    return { system_id: inv.system_id };
  }

  const inv = store.invitations.find(
    (i) => i.token.toUpperCase() === cleanToken && i.status === 'pending'
  );
  if (!inv) throw new Error('Invalid or expired invitation token.');
  inv.status = 'accepted';
  store.memberships.push({
    id: 'mem-' + Date.now(),
    system_id: inv.system_id,
    user_id: userId,
    role: inv.role,
    status: 'active',
    joined_at: new Date().toISOString(),
  });
  return { system_id: inv.system_id };
}

export async function getSystemInvitations(systemId: string): Promise<SystemInvitation[]> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from('system_invitations')
      .select('*')
      .eq('system_id', systemId)
      .order('created_at', { ascending: false });
    if (data) return data;
  }

  return store.invitations.filter((i) => i.system_id === systemId);
}

export async function revokeInvitation(
  invitationId: string,
  systemId: string,
  actorId: string
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase
      .from('system_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId);
  } else {
    const inv = store.invitations.find((i) => i.id === invitationId);
    if (inv) inv.status = 'revoked';
  }

  await logAuditAction({
    systemId,
    actorId,
    actionType: 'INVITATION_REVOKED',
    targetType: 'system_invitations',
    targetId: invitationId,
    reason: 'Invitation revoked by manager',
  });
}

// -----------------------------------------------------------------------------
// DAILY COOKING CALENDAR & MEALS (AFTERNOON & NIGHT MEALS)
// -----------------------------------------------------------------------------

export async function getCookingDays(
  systemId: string,
  startDate: string,
  endDate: string
): Promise<CookingDay[]> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from('cooking_days')
      .select('*')
      .eq('system_id', systemId)
      .gte('date', startDate)
      .lte('date', endDate);
    if (data) return data;
  }

  return store.cookingDays.filter(
    (cd) => cd.system_id === systemId && cd.date >= startDate && cd.date <= endDate
  );
}

export async function updateCookingDayStatus(
  systemId: string,
  date: string,
  status: 'cooking' | 'no_cooking' | 'pending',
  note: string,
  actorId: string
): Promise<CookingDay> {
  const prev = store.cookingDays.find((c) => c.system_id === systemId && c.date === date);

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('cooking_days')
      .upsert({
        system_id: systemId,
        date,
        status,
        note,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  let updated: CookingDay;
  if (prev) {
    prev.status = status;
    prev.note = note;
    prev.updated_by = actorId;
    prev.updated_at = new Date().toISOString();
    updated = prev;
  } else {
    updated = {
      id: 'cd-' + Date.now(),
      system_id: systemId,
      date,
      status,
      note,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    };
    store.cookingDays.push(updated);
  }

  await logAuditAction({
    systemId,
    actorId,
    actionType: 'COOKING_STATUS_CHANGED',
    targetType: 'cooking_days',
    targetId: date,
    previousValue: prev ? { status: prev.status, note: prev.note } : null,
    newValue: { status, note },
    reason: `Kitchen status changed to ${status}`,
  });

  return updated;
}

export async function getDailyMealRecords(
  systemId: string,
  startDate: string,
  endDate: string
): Promise<DailyMealRecord[]> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from('daily_meal_records')
      .select('*, member:profiles!member_id(full_name)')
      .eq('system_id', systemId)
      .gte('date', startDate)
      .lte('date', endDate);
    if (data) {
      return data.map((d: any) => ({
        ...d,
        lunch_count: d.lunch_count ?? (d.is_turned_off ? 0 : 1),
        dinner_count: d.dinner_count ?? (d.is_turned_off ? 0 : 1),
        lunch_turned_off: d.lunch_turned_off ?? d.is_turned_off,
        dinner_turned_off: d.dinner_turned_off ?? d.is_turned_off,
        member_name: d.member?.full_name,
      }));
    }
  }

  return store.mealRecords
    .filter((mr) => mr.system_id === systemId && mr.date >= startDate && mr.date <= endDate)
    .map((mr) => ({
      ...mr,
      lunch_count: mr.lunch_count ?? (mr.is_turned_off ? 0 : 1),
      dinner_count: mr.dinner_count ?? (mr.is_turned_off ? 0 : 1),
      lunch_turned_off: mr.lunch_turned_off ?? mr.is_turned_off,
      dinner_turned_off: mr.dinner_turned_off ?? mr.is_turned_off,
      member_name: store.profiles.find((p) => p.id === mr.member_id)?.full_name,
    }));
}

/**
 * Saves a member's daily meal record.
 * Supports:
 * - Cutting afternoon meal only (lunchTurnedOff)
 * - Cutting night meal only (dinnerTurnedOff)
 * - Cutting full day (isTurnedOff)
 */
export async function saveDailyMealRecord(params: {
  systemId: string;
  memberId: string;
  date: string;
  lunchTurnedOff?: boolean;
  dinnerTurnedOff?: boolean;
  lunchCount?: number;
  dinnerCount?: number;
  isTurnedOff?: boolean;
  mealCount?: number;
  isPostCutoff?: boolean;
  reason?: string;
  actorId: string;
}): Promise<DailyMealRecord> {
  const { systemId, memberId, date, reason, actorId } = params;

  // Determine slot states
  let isFullOff = params.isTurnedOff;
  let lunchOff = params.lunchTurnedOff ?? false;
  let dinnerOff = params.dinnerTurnedOff ?? false;

  if (isFullOff) {
    lunchOff = true;
    dinnerOff = true;
  } else if (lunchOff && dinnerOff) {
    isFullOff = true;
  } else {
    isFullOff = false;
  }

  const lCount = lunchOff ? 0 : (params.lunchCount ?? 1.0);
  const dCount = dinnerOff ? 0 : (params.dinnerCount ?? 1.0);
  const totalMeals = isFullOff ? 0 : lCount + dCount;

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('daily_meal_records').upsert({
        system_id: systemId,
        member_id: memberId,
        date,
        lunch_count: lCount,
        dinner_count: dCount,
        lunch_turned_off: lunchOff,
        dinner_turned_off: dinnerOff,
        meal_count: totalMeals,
        is_turned_off: isFullOff,
        is_post_cutoff_change: params.isPostCutoff || false,
        change_reason: reason || null,
        changed_by: actorId,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Supabase meal upsert fallback:', e);
    }
  }

  const existing = store.mealRecords.find(
    (m) => m.system_id === systemId && m.member_id === memberId && m.date === date
  );

  let record: DailyMealRecord;
  if (existing) {
    existing.previous_value = existing.meal_count;
    existing.lunch_count = lCount;
    existing.dinner_count = dCount;
    existing.lunch_turned_off = lunchOff;
    existing.dinner_turned_off = dinnerOff;
    existing.meal_count = totalMeals;
    existing.is_turned_off = isFullOff;
    existing.is_post_cutoff_change = existing.is_post_cutoff_change || Boolean(params.isPostCutoff);
    existing.change_reason = reason || existing.change_reason;
    existing.changed_by = actorId;
    existing.updated_at = new Date().toISOString();
    record = existing;
  } else {
    record = {
      id: 'mr-' + Date.now(),
      system_id: systemId,
      member_id: memberId,
      date,
      lunch_count: lCount,
      dinner_count: dCount,
      lunch_turned_off: lunchOff,
      dinner_turned_off: dinnerOff,
      meal_count: totalMeals,
      is_turned_off: isFullOff,
      is_post_cutoff_change: params.isPostCutoff || false,
      previous_value: null,
      change_reason: reason || null,
      changed_by: actorId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.mealRecords.push(record);
  }

  if (params.isPostCutoff) {
    await logAuditAction({
      systemId,
      actorId,
      actionType: 'POST_CUTOFF_MEAL_CORRECTION',
      targetType: 'daily_meal_records',
      targetId: `${date}:${memberId}`,
      previousValue: existing ? { count: existing.previous_value } : null,
      newValue: { lunch: lCount, dinner: dCount, total: totalMeals, full_off: isFullOff },
      reason: reason || 'Post-cutoff meal correction',
    });
  }

  return record;
}

// -----------------------------------------------------------------------------
// BAZAR EXPENSES
// -----------------------------------------------------------------------------

export async function getBazarExpenses(
  systemId: string,
  period?: string
): Promise<BazarExpense[]> {
  if (isSupabaseConfigured && supabase) {
    let query = supabase
      .from('bazar_expenses')
      .select('*, purchaser:profiles!purchaser_id(full_name)')
      .eq('system_id', systemId)
      .order('date', { ascending: false });

    if (period) {
      const start = `${period}-01`;
      const [y, m] = period.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${period}-${String(lastDay).padStart(2, '0')}`;
      query = query.gte('date', start).lte('date', end);
    }

    const { data } = await query;
    if (data) {
      return data.map((d: any) => ({
        ...d,
        purchaser_name: d.purchaser?.full_name,
      }));
    }
  }

  return store.bazarExpenses
    .filter((e) => {
      if (e.system_id !== systemId) return false;
      if (period && !e.date.startsWith(period)) return false;
      return true;
    })
    .map((e) => ({
      ...e,
      purchaser_name: store.profiles.find((p) => p.id === e.purchaser_id)?.full_name,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function recordBazarExpense(
  data: Omit<BazarExpense, 'id' | 'created_at' | 'is_reversed'>
): Promise<BazarExpense> {
  if (isSupabaseConfigured && supabase) {
    let rpcDone = false;
    try {
      const { error } = await supabase.rpc('record_bazar_expense_tx', {
        p_system_id: data.system_id,
        p_date: data.date,
        p_category: data.category,
        p_description: data.description,
        p_amount: data.amount,
        p_shop_name: data.shop_name || null,
        p_purchaser_id: data.purchaser_id,
        p_funding_source: data.funding_source,
        p_receipt_url: data.receipt_url || null,
        p_no_receipt_reason: data.no_receipt_reason || null,
      });

      if (!error) {
        rpcDone = true;
      } else if (!error.message?.includes('function') && !error.message?.includes('does not exist')) {
        throw error;
      }
    } catch (rpcErr: any) {
      if (rpcErr?.message && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
        throw rpcErr;
      }
    }

    if (!rpcDone) {
      const { error: insertError } = await supabase.from('bazar_expenses').insert({
        system_id: data.system_id,
        date: data.date,
        category: data.category,
        description: data.description,
        amount: data.amount,
        shop_name: data.shop_name || null,
        purchaser_id: data.purchaser_id,
        created_by: data.created_by,
        funding_source: data.funding_source,
        receipt_url: data.receipt_url || null,
        no_receipt_reason: data.no_receipt_reason || null,
      });

      if (insertError) throw insertError;

      if (data.funding_source === 'personal_credit') {
        const period = data.date.slice(0, 7);
        await supabase.from('financial_ledger').insert({
          system_id: data.system_id,
          member_id: data.purchaser_id,
          transaction_type: 'personal_bazar_credit',
          amount: data.amount,
          accounting_period: period,
          date: data.date,
          description: `Personal Bazar Credit: ${data.description}`,
          created_by: data.created_by,
        });
      }
    }
  }

  const newExpense: BazarExpense = {
    ...data,
    id: 'exp-' + Date.now(),
    is_reversed: false,
    created_at: new Date().toISOString(),
  };
  store.bazarExpenses.unshift(newExpense);

  if (data.funding_source === 'personal_credit') {
    const period = data.date.slice(0, 7);
    store.ledger.push({
      id: 'led-' + Date.now(),
      system_id: data.system_id,
      member_id: data.purchaser_id,
      transaction_type: 'personal_bazar_credit',
      amount: data.amount,
      reference_id: newExpense.id,
      accounting_period: period,
      date: data.date,
      description: `Personal Bazar Credit: ${data.description}`,
      created_by: data.created_by,
      created_at: new Date().toISOString(),
    });
  }

  await logAuditAction({
    systemId: data.system_id,
    actorId: data.created_by,
    actionType: 'EXPENSE_RECORDED',
    targetType: 'bazar_expenses',
    targetId: newExpense.id,
    newValue: {
      amount: data.amount,
      category: data.category,
      funding_source: data.funding_source,
      purchaser_id: data.purchaser_id,
    },
    reason: `Expense added: ${data.description}`,
  });

  return newExpense;
}

export async function reverseBazarExpense(
  expenseId: string,
  reason: string,
  actorId: string
): Promise<void> {
  const exp = store.bazarExpenses.find((e) => e.id === expenseId);
  if (!exp) throw new Error('Expense not found');

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc('reverse_bazar_expense', {
      p_expense_id: expenseId,
      p_reason: reason,
    });
    if (error) throw error;
  }

  exp.is_reversed = true;
  exp.reversal_reason = reason;
  exp.reversed_at = new Date().toISOString();
  exp.reversed_by = actorId;

  if (exp.funding_source === 'personal_credit') {
    store.ledger.push({
      id: 'led-rev-' + Date.now(),
      system_id: exp.system_id,
      member_id: exp.purchaser_id,
      transaction_type: 'reversal',
      amount: -exp.amount,
      reference_id: exp.id,
      accounting_period: exp.date.slice(0, 7),
      date: new Date().toISOString().slice(0, 10),
      description: `Reversal: Personal Bazar Credit for ${exp.description} (${reason})`,
      created_by: actorId,
      created_at: new Date().toISOString(),
    });
  }

  await logAuditAction({
    systemId: exp.system_id,
    actorId,
    actionType: 'EXPENSE_REVERSED',
    targetType: 'bazar_expenses',
    targetId: exp.id,
    previousValue: { amount: exp.amount, is_reversed: false },
    newValue: { amount: exp.amount, is_reversed: true },
    reason,
  });
}

// -----------------------------------------------------------------------------
// DEPOSITS & LEDGER
// -----------------------------------------------------------------------------

export async function getDeposits(systemId: string, period?: string): Promise<Deposit[]> {
  if (isSupabaseConfigured && supabase) {
    let query = supabase
      .from('deposits')
      .select('*, member:profiles!member_id(full_name), recorder:profiles!recorded_by(full_name)')
      .eq('system_id', systemId)
      .order('date', { ascending: false });

    if (period) {
      const start = `${period}-01`;
      const [y, m] = period.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${period}-${String(lastDay).padStart(2, '0')}`;
      query = query.gte('date', start).lte('date', end);
    }

    const { data } = await query;
    if (data) {
      return data.map((d: any) => ({
        ...d,
        member_name: d.member?.full_name,
        recorder_name: d.recorder?.full_name,
      }));
    }
  }

  return store.deposits
    .filter((d) => {
      if (d.system_id !== systemId) return false;
      if (period && !d.date.startsWith(period)) return false;
      return true;
    })
    .map((d) => ({
      ...d,
      member_name: store.profiles.find((p) => p.id === d.member_id)?.full_name,
      recorder_name: store.profiles.find((p) => p.id === d.recorded_by)?.full_name,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function recordDeposit(
  data: Omit<Deposit, 'id' | 'created_at' | 'is_reversed'>
): Promise<Deposit> {
  if (isSupabaseConfigured && supabase) {
    const { data: depId, error } = await supabase.rpc('record_deposit_tx', {
      p_system_id: data.system_id,
      p_member_id: data.member_id,
      p_amount: data.amount,
      p_date: data.date,
      p_payment_method: data.payment_method,
      p_trx_reference: data.transaction_reference || null,
      p_note: data.note || null,
    });
    if (error) throw error;
  }

  const newDeposit: Deposit = {
    ...data,
    id: 'dep-' + Date.now(),
    is_reversed: false,
    created_at: new Date().toISOString(),
  };
  store.deposits.unshift(newDeposit);

  store.ledger.push({
    id: 'led-' + Date.now(),
    system_id: data.system_id,
    member_id: data.member_id,
    transaction_type: 'deposit',
    amount: data.amount,
    reference_id: newDeposit.id,
    accounting_period: data.date.slice(0, 7),
    date: data.date,
    description: `Deposit via ${data.payment_method} ${data.transaction_reference ? '(' + data.transaction_reference + ')' : ''}`,
    created_by: data.recorded_by,
    created_at: new Date().toISOString(),
  });

  await logAuditAction({
    systemId: data.system_id,
    actorId: data.recorded_by,
    actionType: 'DEPOSIT_RECORDED',
    targetType: 'deposits',
    targetId: newDeposit.id,
    newValue: {
      member_id: data.member_id,
      amount: data.amount,
      payment_method: data.payment_method,
    },
    reason: `Deposit logged for ${data.member_name || data.member_id}`,
  });

  return newDeposit;
}

export async function reverseDeposit(
  depositId: string,
  reason: string,
  actorId: string
): Promise<void> {
  const dep = store.deposits.find((d) => d.id === depositId);
  if (!dep) throw new Error('Deposit not found');

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc('reverse_deposit', {
      p_deposit_id: depositId,
      p_reason: reason,
    });
    if (error) throw error;
  }

  dep.is_reversed = true;
  dep.reversal_reason = reason;
  dep.reversed_at = new Date().toISOString();
  dep.reversed_by = actorId;

  store.ledger.push({
    id: 'led-rev-' + Date.now(),
    system_id: dep.system_id,
    member_id: dep.member_id,
    transaction_type: 'reversal',
    amount: -dep.amount,
    reference_id: dep.id,
    accounting_period: dep.date.slice(0, 7),
    date: new Date().toISOString().slice(0, 10),
    description: `Deposit Reversal (${reason})`,
    created_by: actorId,
    created_at: new Date().toISOString(),
  });

  await logAuditAction({
    systemId: dep.system_id,
    actorId,
    actionType: 'DEPOSIT_REVERSED',
    targetType: 'deposits',
    targetId: dep.id,
    previousValue: { amount: dep.amount, is_reversed: false },
    newValue: { amount: dep.amount, is_reversed: true },
    reason,
  });
}

export async function getFinancialLedger(
  systemId: string,
  period?: string,
  memberId?: string
): Promise<FinancialLedgerEntry[]> {
  if (isSupabaseConfigured && supabase) {
    let query = supabase
      .from('financial_ledger')
      .select('*, member:profiles!member_id(full_name)')
      .eq('system_id', systemId)
      .order('date', { ascending: false });

    if (period) query = query.eq('accounting_period', period);
    if (memberId) query = query.eq('member_id', memberId);

    const { data } = await query;
    if (data) {
      return data.map((d: any) => ({
        ...d,
        member_name: d.member?.full_name,
      }));
    }
  }

  return store.ledger
    .filter((l) => {
      if (l.system_id !== systemId) return false;
      if (period && l.accounting_period !== period) return false;
      if (memberId && l.member_id !== memberId) return false;
      return true;
    })
    .map((l) => ({
      ...l,
      member_name: store.profiles.find((p) => p.id === l.member_id)?.full_name,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function recordAdjustment(
  systemId: string,
  memberId: string,
  amount: number,
  reason: string,
  period: string,
  actorId: string
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  if (isSupabaseConfigured && supabase) {
    await supabase.from('financial_adjustments').insert({
      system_id: systemId,
      member_id: memberId,
      amount,
      reason,
      accounting_period: period,
      date: today,
      authorized_by: actorId,
    });
  }

  store.ledger.push({
    id: 'led-adj-' + Date.now(),
    system_id: systemId,
    member_id: memberId,
    transaction_type: 'adjustment',
    amount,
    accounting_period: period,
    date: today,
    description: `Adjustment: ${reason}`,
    created_by: actorId,
    created_at: new Date().toISOString(),
  });

  await logAuditAction({
    systemId,
    actorId,
    actionType: 'FINANCIAL_ADJUSTMENT_CREATED',
    targetType: 'financial_adjustments',
    targetId: memberId,
    newValue: { amount, reason, period },
    reason,
  });
}

// -----------------------------------------------------------------------------
// MONTHLY FIXED COSTS & VARIABLE MEMBER HOUSE RENT
// -----------------------------------------------------------------------------

const FIXED_COSTS_STORAGE_KEY = 'mealtrack_fixed_costs';
const MEMBER_RENTS_STORAGE_KEY = 'mealtrack_member_rents';

export async function getMonthlyCostsConfig(
  systemId: string,
  period: string
): Promise<MonthlyCostsConfig> {
  let fixedCosts: FixedCostItem[] = [];
  let memberRents: Record<string, number> = {};

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: fcData, error: fcError } = await supabase
        .from('monthly_fixed_costs')
        .select('*')
        .eq('system_id', systemId)
        .eq('period', period);
      if (!fcError && fcData && fcData.length > 0) {
        fixedCosts = fcData.map((f: any) => ({
          id: f.id,
          system_id: f.system_id,
          period: f.period,
          title: f.title,
          amount: Number(f.amount) || 0,
          category: f.category || 'utility',
        }));
      }

      const { data: mrData, error: mrError } = await supabase
        .from('monthly_member_rent')
        .select('*')
        .eq('system_id', systemId)
        .eq('period', period);
      if (!mrError && mrData && mrData.length > 0) {
        mrData.forEach((r: any) => {
          memberRents[r.member_id] = Number(r.house_rent) || 0;
        });
      }
    } catch (e) {
      console.warn('Supabase monthly costs fetch fallback to local:', e);
    }
  }

  // Fallback / sync with LocalStorage
  if (fixedCosts.length === 0) {
    try {
      const stored = localStorage.getItem(`${FIXED_COSTS_STORAGE_KEY}_${systemId}_${period}`);
      if (stored) {
        fixedCosts = JSON.parse(stored);
      }
    } catch {}
  }
  if (Object.keys(memberRents).length === 0) {
    try {
      const stored = localStorage.getItem(`${MEMBER_RENTS_STORAGE_KEY}_${systemId}_${period}`);
      if (stored) {
        memberRents = JSON.parse(stored);
      }
    } catch {}
  }

  const members = await getSystemMembers(systemId);
  const activeMembersCount = members.filter((m) => m.status === 'active').length || members.length || 1;
  const totalFixedCost = roundToDecimals(
    fixedCosts.reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
    2
  );
  const perMemberFixedCost = roundToDecimals(totalFixedCost / activeMembersCount, 2);

  return {
    period,
    fixedCosts,
    totalFixedCost,
    perMemberFixedCost,
    memberRents,
  };
}

export async function saveMonthlyCostsConfig(
  systemId: string,
  period: string,
  params: {
    fixedCosts: { id?: string; title: string; amount: number; category: FixedCostCategory }[];
    memberRents: Record<string, number>;
  },
  actorId: string
): Promise<void> {
  const normalizedFixedCosts: FixedCostItem[] = params.fixedCosts.map((f) => ({
    id: f.id || 'fc-' + Math.random().toString(36).slice(2, 9),
    system_id: systemId,
    period,
    title: f.title.trim(),
    amount: roundToDecimals(Number(f.amount) || 0, 2),
    category: f.category,
  }));

  // Store in LocalStorage immediately
  try {
    localStorage.setItem(
      `${FIXED_COSTS_STORAGE_KEY}_${systemId}_${period}`,
      JSON.stringify(normalizedFixedCosts)
    );
    localStorage.setItem(
      `${MEMBER_RENTS_STORAGE_KEY}_${systemId}_${period}`,
      JSON.stringify(params.memberRents)
    );
  } catch (e) {
    console.warn('Failed to save monthly costs to localStorage:', e);
  }

  // Supabase persistence
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('monthly_fixed_costs')
        .delete()
        .eq('system_id', systemId)
        .eq('period', period);

      if (normalizedFixedCosts.length > 0) {
        await supabase.from('monthly_fixed_costs').insert(
          normalizedFixedCosts.map((f) => ({
            system_id: systemId,
            period,
            title: f.title,
            amount: f.amount,
            category: f.category,
          }))
        );
      }

      const rentRows = Object.entries(params.memberRents).map(([memberId, rent]) => ({
        system_id: systemId,
        period,
        member_id: memberId,
        house_rent: roundToDecimals(Number(rent) || 0, 2),
      }));

      for (const row of rentRows) {
        await supabase
          .from('monthly_member_rent')
          .upsert(row, { onConflict: 'system_id,period,member_id' });
      }
    } catch (e) {
      console.warn('Supabase saveMonthlyCostsConfig fallback to local:', e);
    }
  }

  await logAuditAction({
    systemId,
    actorId,
    actionType: 'UPDATE_MONTHLY_COSTS',
    targetType: 'MONTHLY_COSTS',
    targetId: period,
    newValue: { fixedCostsCount: normalizedFixedCosts.length, memberRents: params.memberRents },
    reason: `Configured monthly fixed costs and member rent for ${period}`,
  });
}

// -----------------------------------------------------------------------------
// MONTHLY ACCOUNTING, MEAL RATE & CARRY-FORWARD SUMMARY
// -----------------------------------------------------------------------------

export async function getMonthlyAccountingSummary(
  systemId: string,
  period: string
): Promise<MonthlyAccountingSummary> {
  const members = await getSystemMembers(systemId);
  const expenses = await getBazarExpenses(systemId, period);
  const activeExpenses = expenses.filter((e) => !e.is_reversed);
  const totalBazarExpenses = roundToDecimals(
    activeExpenses.reduce((acc, e) => acc + e.amount, 0),
    2
  );

  // Load monthly fixed costs and variable house rent
  const costsConfig = await getMonthlyCostsConfig(systemId, period);
  const totalFixedCosts = costsConfig.totalFixedCost;
  const perMemberFixedCost = costsConfig.perMemberFixedCost;

  // Shared fund expenses: shared bazar + shared fixed costs
  const sharedBazarExpenses = roundToDecimals(
    activeExpenses
      .filter((e) => e.funding_source === 'shared_fund')
      .reduce((acc, e) => acc + e.amount, 0),
    2
  );
  const totalSharedFundSpent = roundToDecimals(sharedBazarExpenses + totalFixedCosts, 2);

  const [y, m] = period.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startDate = `${period}-01`;
  const endDate = `${period}-${String(daysInMonth).padStart(2, '0')}`;
  const cookingDays = await getCookingDays(systemId, startDate, endDate);
  const cookingDayMap = new Map<string, 'cooking' | 'no_cooking' | 'pending'>(
    cookingDays.map((c) => [c.date, c.status])
  );

  const mealRecords = await getDailyMealRecords(systemId, startDate, endDate);
  const ledgerEntries = await getFinancialLedger(systemId, period);

  let totalFinalizedMeals = 0;
  const memberMealCountMap = new Map<string, number>();

  members.forEach((mem) => {
    let memberMeals = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${period}-${String(day).padStart(2, '0')}`;
      const cStatus = cookingDayMap.get(dateStr) || 'cooking';
      const record = mealRecords.find(
        (r) => r.member_id === mem.user_id && r.date === dateStr
      );

      const effective = computeEffectiveMealCount({
        cookingStatus: cStatus,
        isTurnedOff: record?.is_turned_off,
        lunchTurnedOff: record?.lunch_turned_off,
        dinnerTurnedOff: record?.dinner_turned_off,
        lunchCount: record?.lunch_count,
        dinnerCount: record?.dinner_count,
        mealCount: record?.meal_count,
      });

      memberMeals += effective;
    }
    memberMealCountMap.set(mem.user_id, roundToDecimals(memberMeals, 2));
    totalFinalizedMeals += memberMeals;
  });

  totalFinalizedMeals = roundToDecimals(totalFinalizedMeals, 2);
  const mealRate = calculateMonthlyMealRate(totalBazarExpenses, totalFinalizedMeals);

  const memberSummaries: MonthlyMemberSummary[] = members.map((mem) => {
    const memberMeals = memberMealCountMap.get(mem.user_id) || 0;
    const mealCost = calculateMemberMealCost(memberMeals, mealRate);
    const contributionPct = calculateMealContributionPercentage(memberMeals, totalFinalizedMeals);

    // Track total bazar done by this member (both shared fund and personal credit)
    const memberExpenses = activeExpenses.filter((e) => e.purchaser_id === mem.user_id);
    const totalBazarDone = roundToDecimals(
      memberExpenses.reduce((sum, e) => sum + e.amount, 0),
      2
    );
    const bazarTripsCount = memberExpenses.length;

    // Individual house rent for this member
    const houseRent = roundToDecimals(Number(costsConfig.memberRents[mem.user_id]) || 0, 2);

    const memberLedger = ledgerEntries.filter((l) => l.member_id === mem.user_id);
    const openingBalance = roundToDecimals(
      memberLedger
        .filter((l) => l.transaction_type === 'opening_balance')
        .reduce((sum, l) => sum + l.amount, 0),
      2
    );
    const deposits = roundToDecimals(
      memberLedger
        .filter((l) => l.transaction_type === 'deposit')
        .reduce((sum, l) => sum + l.amount, 0),
      2
    );
    const personalCredits = roundToDecimals(
      memberLedger
        .filter((l) => l.transaction_type === 'personal_bazar_credit')
        .reduce((sum, l) => sum + l.amount, 0),
      2
    );
    const positiveAdjustments = roundToDecimals(
      memberLedger
        .filter((l) => (l.transaction_type === 'adjustment' || l.transaction_type === 'reversal') && l.amount > 0)
        .reduce((sum, l) => sum + l.amount, 0),
      2
    );
    const negativeAdjustments = roundToDecimals(
      memberLedger
        .filter((l) => (l.transaction_type === 'adjustment' || l.transaction_type === 'reversal') && l.amount < 0)
        .reduce((sum, l) => sum + Math.abs(l.amount), 0),
      2
    );

    const closingBalance = calculateClosingBalance({
      openingBalance,
      deposits,
      personalBazarCredits: personalCredits,
      positiveAdjustments,
      negativeAdjustments,
      mealCost,
      sharedFixedCost: perMemberFixedCost,
      houseRent,
    });

    const net = calculateNetPayable(closingBalance);
    const totalBilled = roundToDecimals(mealCost + perMemberFixedCost + houseRent + negativeAdjustments, 2);
    const totalPaid = roundToDecimals(openingBalance + deposits + personalCredits + positiveAdjustments, 2);

    return {
      member_id: mem.user_id,
      member_name: mem.profile?.full_name || mem.user_id,
      opening_balance: openingBalance,
      deposits,
      personal_bazar_credits: personalCredits,
      total_bazar_done: totalBazarDone,
      bazar_trips_count: bazarTripsCount,
      meal_count: memberMeals,
      meal_cost: mealCost,
      meal_contribution_pct: contributionPct,
      shared_fixed_cost: perMemberFixedCost,
      house_rent: houseRent,
      total_billed: totalBilled,
      total_paid: totalPaid,
      amount_need_to_pay: net.amountNeedToPay,
      surplus_advance: net.surplusAdvance,
      positive_adjustments: positiveAdjustments,
      negative_adjustments: negativeAdjustments,
      other_charges: 0,
      closing_balance: closingBalance,
      balance_status: getBalanceStatus(closingBalance),
    };
  });

  const existingSnapshot = store.snapshots
    .filter((s) => s.system_id === systemId && s.period === period)
    .sort((a, b) => b.version - a.version)[0];

  const totalDeposits = roundToDecimals(
    memberSummaries.reduce((sum, m) => sum + m.deposits, 0),
    2
  );
  const fundBalanceRemaining = roundToDecimals(totalDeposits - totalSharedFundSpent, 2);
  const totalAmountDue = roundToDecimals(
    memberSummaries.reduce((sum, m) => sum + m.amount_need_to_pay, 0),
    2
  );
  const totalHouseRent = roundToDecimals(
    memberSummaries.reduce((sum, m) => sum + m.house_rent, 0),
    2
  );

  return {
    period,
    status: existingSnapshot ? 'finalized' : 'open',
    version: existingSnapshot ? existingSnapshot.version : 1,
    total_expenses: totalBazarExpenses,
    total_meals: totalFinalizedMeals,
    meal_rate: mealRate,
    is_meal_rate_available: mealRate !== null,
    total_deposits: totalDeposits,
    total_personal_credits: roundToDecimals(
      memberSummaries.reduce((sum, m) => sum + m.personal_bazar_credits, 0),
      2
    ),
    total_shared_fund_spent: totalSharedFundSpent,
    fund_balance_remaining: fundBalanceRemaining,
    total_fixed_costs: totalFixedCosts,
    per_member_fixed_cost: perMemberFixedCost,
    total_house_rent: totalHouseRent,
    total_amount_due: totalAmountDue,
    members: memberSummaries,
    fixed_costs_items: costsConfig.fixedCosts,
    finalized_at: existingSnapshot?.finalized_at || null,
    finalized_by_name: existingSnapshot ? store.profiles.find((p) => p.id === existingSnapshot.finalized_by)?.full_name : null,
    notes: existingSnapshot?.reason || null,
  };
}

export async function finalizeMonthlyAccounting(
  systemId: string,
  period: string,
  reason: string,
  actorId: string
): Promise<MonthlyReportSnapshot> {
  const summary = await getMonthlyAccountingSummary(systemId, period);

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('finalize_monthly_accounting_tx', {
      p_system_id: systemId,
      p_period: period,
      p_reason: reason,
    });
    if (error) throw error;
  }

  const existingVersions = store.snapshots.filter(
    (s) => s.system_id === systemId && s.period === period
  );
  const nextVersion = existingVersions.length + 1;

  const snapshot: MonthlyReportSnapshot = {
    id: 'snap-' + Date.now(),
    system_id: systemId,
    period,
    version: nextVersion,
    finalized_at: new Date().toISOString(),
    finalized_by: actorId,
    reason,
    summary_data: {
      period,
      version: nextVersion,
      total_bazar_expenses: summary.total_expenses,
      total_finalized_meals: summary.total_meals,
      meal_rate: summary.meal_rate,
      finalized_at: new Date().toISOString(),
      finalized_by_name: store.profiles.find((p) => p.id === actorId)?.full_name,
    },
    member_balances: summary.members,
    created_at: new Date().toISOString(),
  };

  store.snapshots.unshift(snapshot);

  // Auto carry-forward to next month opening balance
  const [y, m] = period.split('-').map(Number);
  const nextMonthDate = new Date(y, m, 1);
  const nextPeriod = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const nextPeriodStart = `${nextPeriod}-01`;

  store.ledger = store.ledger.filter(
    (l) => !(l.system_id === systemId && l.accounting_period === nextPeriod && l.transaction_type === 'opening_balance')
  );

  summary.members.forEach((mem) => {
    store.ledger.push({
      id: 'led-op-' + Date.now() + '-' + mem.member_id,
      system_id: systemId,
      member_id: mem.member_id,
      transaction_type: 'opening_balance',
      amount: mem.closing_balance,
      accounting_period: nextPeriod,
      date: nextPeriodStart,
      description: `Opening Balance: Carry-forward from ${period} (v${nextVersion})`,
      created_by: actorId,
      created_at: new Date().toISOString(),
    });
  });

  await logAuditAction({
    systemId,
    actorId,
    actionType: 'MONTHLY_REPORT_FINALIZED',
    targetType: 'monthly_report_snapshots',
    targetId: `${period}:v${nextVersion}`,
    newValue: {
      period,
      version: nextVersion,
      meal_rate: summary.meal_rate,
      total_meals: summary.total_meals,
      total_expenses: summary.total_expenses,
    },
    reason,
  });

  return snapshot;
}

export async function getMonthlyReportSnapshots(
  systemId: string,
  period?: string
): Promise<MonthlyReportSnapshot[]> {
  return store.snapshots
    .filter((s) => {
      if (s.system_id !== systemId) return false;
      if (period && s.period !== period) return false;
      return true;
    })
    .sort((a, b) => b.version - a.version);
}

// -----------------------------------------------------------------------------
// AUDIT LOGS & NOTIFICATIONS
// -----------------------------------------------------------------------------

export async function getAuditLogs(
  systemId: string,
  filters?: { actionType?: string; actorId?: string }
): Promise<AuditLogEntry[]> {
  if (isSupabaseConfigured && supabase) {
    let query = supabase
      .from('audit_logs')
      .select('*, actor:profiles!actor_id(full_name)')
      .eq('system_id', systemId)
      .order('created_at', { ascending: false });

    if (filters?.actionType) query = query.eq('action_type', filters.actionType);
    if (filters?.actorId) query = query.eq('actor_id', filters.actorId);

    const { data } = await query;
    if (data) {
      return data.map((d: any) => ({
        ...d,
        actor_name: d.actor?.full_name,
      }));
    }
  }

  return store.auditLogs
    .filter((a) => {
      if (a.system_id !== systemId) return false;
      if (filters?.actionType && a.action_type !== filters.actionType) return false;
      if (filters?.actorId && a.actor_id !== filters.actorId) return false;
      return true;
    })
    .map((a) => ({
      ...a,
      actor_name: store.profiles.find((p) => p.id === a.actor_id)?.full_name || a.actor_id,
    }));
}

export async function getNotifications(
  systemId: string,
  userId?: string
): Promise<SystemNotification[]> {
  return store.notifications.filter(
    (n) => n.system_id === systemId && (n.user_id === null || n.user_id === userId)
  );
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const notif = store.notifications.find((n) => n.id === notificationId);
  if (notif) notif.is_read = true;
}

export async function uploadReceiptImage(file: File): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    const fileExt = file.name.split('.').pop();
    const filePath = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('bazar-receipts')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('bazar-receipts').getPublicUrl(filePath);
    return data.publicUrl;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
