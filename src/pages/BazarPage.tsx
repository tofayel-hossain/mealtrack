import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Download,
  Receipt,
  AlertCircle,
  RotateCcw,
  Eye,
  CheckCircle2,
  Users,
  User,
  Wallet,
  Check,
  X,
  Clock,
  ArrowRight,
  HandCoins,
  Send,
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import {
  getBazarExpenses,
  reverseBazarExpense,
  approveBazarExpense,
  rejectBazarExpense,
  getBazarAssignments,
  confirmBazarReturn,
} from '../services/api';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { AssignBazarModal } from '../components/AssignBazarModal';
import { SubmitBazarReportModal } from '../components/SubmitBazarReportModal';
import { BazarAssignmentDetailsModal } from '../components/BazarAssignmentDetailsModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { formatCurrency, formatDate, getDhakaTodayDateString } from '../utils/formatters';
import { exportBazarExpensesToCsv } from '../utils/csvExport';
import type { BazarExpense, ExpenseCategory, BazarAssignment, AssignmentStatus } from '../types';

export const BazarPage: React.FC = () => {
  const { activeSystem, activeRole, settings } = useMealSystem();
  const { user } = useAuth();

  const currentPeriod = getDhakaTodayDateString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod);
  const [activeTab, setActiveTab] = useState<'expenses' | 'assigned'>('expenses');

  const [expenses, setExpenses] = useState<BazarExpense[]>([]);
  const [assignments, setAssignments] = useState<BazarAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters for Expenses
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [fundingFilter, setFundingFilter] = useState<string>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');

  // Filters for Assigned Bazar
  const [assignmentSearch, setAssignmentSearch] = useState<string>('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<string>('all');
  const [assignmentMemberFilter, setAssignmentMemberFilter] = useState<string>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [selectedAssignment, setSelectedAssignment] = useState<BazarAssignment | null>(null);

  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | null>(null);
  const [activeReceiptDesc, setActiveReceiptDesc] = useState<string>('');

  const loadData = async () => {
    if (!activeSystem) return;
    try {
      setLoading(true);
      const [expensesData, assignmentsData] = await Promise.all([
        getBazarExpenses(activeSystem.id, selectedPeriod),
        getBazarAssignments(activeSystem.id, selectedPeriod),
      ]);
      setExpenses(expensesData);
      setAssignments(assignmentsData);
    } catch (err) {
      console.error('Failed to load bazar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSystem) {
      setLoading(false);
      return;
    }
    loadData();
  }, [activeSystem?.id, selectedPeriod]);

  // Manager approve handler for standalone expense
  const handleApproveExpense = async (exp: BazarExpense) => {
    if (activeRole !== 'manager' || !user) return;
    try {
      await approveBazarExpense(exp.id, user.id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to approve expense');
    }
  };

  // Manager reject handler for standalone expense
  const handleRejectExpense = async (exp: BazarExpense) => {
    if (activeRole !== 'manager' || !user) return;
    const reason = window.prompt(
      `Enter reason for rejecting "${exp.description}" (optional):`
    );
    if (reason === null) return;

    try {
      await rejectBazarExpense(exp.id, user.id, reason.trim() || undefined);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to reject expense');
    }
  };

  // Manager reversal handler
  const handleReverseExpense = async (exp: BazarExpense) => {
    if (activeRole !== 'manager' || !user) return;
    const reason = window.prompt(
      `Enter mandatory reversal reason for "${exp.description}" (৳${exp.amount}):`
    );
    if (!reason || !reason.trim()) return;

    try {
      await reverseBazarExpense(exp.id, reason.trim(), user.id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to reverse expense');
    }
  };

  // Quick confirm return handler for manager
  const handleQuickConfirmReturn = async (asgn: BazarAssignment) => {
    if (activeRole !== 'manager' || !user) return;
    const remaining = asgn.remaining_balance ?? (asgn.assigned_amount - (asgn.total_spent || 0));
    const confirmMsg = `Confirm member returned ৳${remaining} to manager?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await confirmBazarReturn({
        assignment_id: asgn.id,
        manager_id: user.id,
        returned_amount: remaining,
      });
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to confirm return');
    }
  };

  // Standalone Pending count
  const pendingCount = expenses.filter(
    (e) => !e.is_reversed && e.approval_status === 'pending'
  ).length;

  // Filtered expenses
  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.shop_name && e.shop_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.purchaser_name && e.purchaser_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesFunding = fundingFilter === 'all' || e.funding_source === fundingFilter;
    const matchesMember = memberFilter === 'all' || e.purchaser_id === memberFilter;

    const status = e.approval_status || 'approved';
    const matchesApproval = approvalFilter === 'all' || status === approvalFilter;

    return matchesSearch && matchesCategory && matchesFunding && matchesMember && matchesApproval;
  });

  // Approved expenses totals
  const activeApprovedExpenses = expenses.filter(
    (e) => !e.is_reversed && (e.approval_status === 'approved' || !e.approval_status)
  );
  const totalBazarAmount = activeApprovedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const personalCreditAmount = activeApprovedExpenses
    .filter((e) => e.funding_source === 'personal_credit')
    .reduce((sum, e) => sum + e.amount, 0);
  const sharedFundAmount = totalBazarAmount - personalCreditAmount;
  const receiptsCount = activeApprovedExpenses.filter((e) => Boolean(e.receipt_url)).length;

  // Member Bazar Breakdown
  const memberBazarMap = new Map<string, {
    memberId: string;
    memberName: string;
    totalAmount: number;
    sharedFundAmount: number;
    personalCreditAmount: number;
    tripCount: number;
  }>();

  activeApprovedExpenses.forEach((exp) => {
    const id = exp.purchaser_id;
    const name = exp.purchaser_name || 'Member';
    const existing = memberBazarMap.get(id) || {
      memberId: id,
      memberName: name,
      totalAmount: 0,
      sharedFundAmount: 0,
      personalCreditAmount: 0,
      tripCount: 0,
    };

    existing.totalAmount += exp.amount;
    existing.tripCount += 1;
    if (exp.funding_source === 'personal_credit') {
      existing.personalCreditAmount += exp.amount;
    } else {
      existing.sharedFundAmount += exp.amount;
    }
    memberBazarMap.set(id, existing);
  });

  const memberBazarList = Array.from(memberBazarMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount
  );

  // Assigned Bazar calculations & filtering
  const totalAssignedMoney = assignments.reduce((sum, a) => sum + a.assigned_amount, 0);
  const totalActualSpent = assignments.reduce((sum, a) => sum + (a.total_spent || 0), 0);
  const totalRemainingPendingReturn = assignments
    .filter((a) => a.status !== 'completed' && (a.remaining_balance || 0) > 0)
    .reduce((sum, a) => sum + (a.remaining_balance || 0), 0);
  const totalReturnedMoney = assignments.reduce((sum, a) => sum + (a.returned_amount || 0), 0);

  // Actionable counts for badges
  const myPendingShoppingAssignment = assignments.find(
    (a) => a.assigned_to === user?.id && (a.status === 'assigned' || a.status === 'rejected')
  );
  const managerPendingReviewCount = assignments.filter((a) => a.status === 'submitted').length;
  const managerPendingReturnCount = assignments.filter(
    (a) => a.status === 'approved' && (a.remaining_balance || 0) > 0
  ).length;

  const filteredAssignments = assignments.filter((a) => {
    const matchesSearch =
      (a.note && a.note.toLowerCase().includes(assignmentSearch.toLowerCase())) ||
      (a.member_name && a.member_name.toLowerCase().includes(assignmentSearch.toLowerCase()));

    const matchesStatus = assignmentStatusFilter === 'all' || a.status === assignmentStatusFilter;
    const matchesMember = assignmentMemberFilter === 'all' || a.assigned_to === assignmentMemberFilter;

    return matchesSearch && matchesStatus && matchesMember;
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
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Bazar</h1>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Tab Selector */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-md)',
            padding: '0.25rem',
            display: 'flex',
            gap: '0.25rem',
          }}>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`btn btn-sm ${activeTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', fontSize: '0.8rem' }}
            >
              Expenses
              {pendingCount > 0 && activeRole === 'manager' && (
                <span style={{
                  background: '#fbbf24',
                  color: '#000',
                  borderRadius: '10px',
                  padding: '0.1rem 0.4rem',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  marginLeft: '0.35rem',
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('assigned')}
              className={`btn btn-sm ${activeTab === 'assigned' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', fontSize: '0.8rem' }}
            >
              Assigned Bazar
              {((activeRole === 'manager' && (managerPendingReviewCount > 0 || managerPendingReturnCount > 0)) || myPendingShoppingAssignment) && (
                <span style={{
                  background: 'var(--brand-primary)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '0.1rem 0.4rem',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  marginLeft: '0.35rem',
                }}>
                  {activeRole === 'manager' ? managerPendingReviewCount + managerPendingReturnCount : '1'}
                </span>
              )}
            </button>
          </div>

          <input
            type="month"
            className="form-control"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{ width: 'auto', padding: '0.45rem 0.65rem' }}
          />

          {activeTab === 'expenses' ? (
            <>
              <button
                onClick={() => exportBazarExpensesToCsv(expenses, `bazar-expenses-${selectedPeriod}.csv`)}
                className="btn btn-secondary btn-sm"
                disabled={expenses.length === 0}
              >
                <Download size={14} /> Export CSV
              </button>

              <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
                <Plus size={14} /> Add Expense
              </button>
            </>
          ) : (
            activeRole === 'manager' && (
              <button onClick={() => setShowAssignModal(true)} className="btn btn-primary btn-sm">
                <HandCoins size={14} /> Assign Money
              </button>
            )
          )}
        </div>
      </div>

      {/* Actionable Banner for Member Pending Shopping */}
      {myPendingShoppingAssignment && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}>
            <ShoppingBag size={18} color="var(--brand-primary)" />
            <span>
              You have an assigned bazar of <strong>{formatCurrency(myPendingShoppingAssignment.assigned_amount)}</strong> ({formatDate(myPendingShoppingAssignment.assigned_date)}).
            </span>
          </div>
          <button
            onClick={() => {
              setSelectedAssignment(myPendingShoppingAssignment);
              setShowSubmitModal(true);
            }}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
          >
            <Send size={13} /> Submit Expense Report
          </button>
        </div>
      )}

      {/* Actionable Banner for Manager Pending Reviews */}
      {activeRole === 'manager' && managerPendingReviewCount > 0 && activeTab === 'assigned' && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.12)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: '#60a5fa' }}>
            <Clock size={18} />
            <span>
              <strong>{managerPendingReviewCount}</strong> bazar report{managerPendingReviewCount > 1 ? 's' : ''} submitted and awaiting your review.
            </span>
          </div>
          <button
            onClick={() => setAssignmentStatusFilter(assignmentStatusFilter === 'submitted' ? 'all' : 'submitted')}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
          >
            {assignmentStatusFilter === 'submitted' ? 'Show All' : 'Review Submitted'}
          </button>
        </div>
      )}

      {/* TAB 1: EXPENSES VIEW */}
      {activeTab === 'expenses' && (
        <>
          {/* Summary Stat Cards */}
          <div className="grid-cols-4" style={{ marginBottom: '1.5rem' }}>
            <div className="card">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Bazar</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.2rem 0' }}>
                {formatCurrency(totalBazarAmount, settings?.currency_symbol)}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shared Fund</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-indigo)', margin: '0.2rem 0' }}>
                {formatCurrency(sharedFundAmount, settings?.currency_symbol)}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Personal Credit</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-primary)', margin: '0.2rem 0' }}>
                {formatCurrency(personalCreditAmount, settings?.currency_symbol)}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Receipts</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-teal)', margin: '0.2rem 0' }}>
                {receiptsCount} / {activeApprovedExpenses.length}
              </div>
            </div>
          </div>

          {/* Member Bazar Breakdown */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={17} color="var(--brand-primary)" />
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Member Bazar</h3>
              </div>
              {memberFilter !== 'all' && (
                <button
                  onClick={() => setMemberFilter('all')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                >
                  All Members
                </button>
              )}
            </div>

            {memberBazarList.length === 0 ? (
              <div style={{ padding: '0.85rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No approved expenses recorded.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem' }}>
                {memberBazarList.map((m) => {
                  const isSelected = memberFilter === m.memberId;
                  const pct = totalBazarAmount > 0 ? Math.round((m.totalAmount / totalBazarAmount) * 100) : 0;

                  return (
                    <div
                      key={m.memberId}
                      onClick={() => setMemberFilter(isSelected ? 'all' : m.memberId)}
                      style={{
                        background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(11, 15, 25, 0.6)',
                        border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title="Filter by this member"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: isSelected ? 'var(--brand-primary)' : 'rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#fff',
                          }}>
                            {m.memberName.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{m.memberName}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                          {m.tripCount} trips ({pct}%)
                        </span>
                      </div>

                      <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--brand-primary)' }}>
                        {formatCurrency(m.totalAmount, settings?.currency_symbol)}
                      </div>

                      <div style={{ width: '100%', height: '3px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', marginTop: '0.4rem', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', borderRadius: '2px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Approval Notice for Manager */}
          {activeRole === 'manager' && pendingCount > 0 && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: '0.65rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
              gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#fbbf24' }}>
                <Clock size={16} />
                <span>
                  <strong>{pendingCount}</strong> pending expense{pendingCount > 1 ? 's' : ''} awaiting approval
                </span>
              </div>
              <button
                onClick={() => setApprovalFilter(approvalFilter === 'pending' ? 'all' : 'pending')}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
              >
                {approvalFilter === 'pending' ? 'All' : 'Pending Only'}
              </button>
            </div>
          )}

          {/* Filter Bar */}
          <div className="card" style={{ padding: '0.85rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
              <div style={{ flex: '1 1 220px', position: 'relative' }}>
                <Search size={15} color="var(--text-dim)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search..."
                  className="form-control"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.1rem' }}
                />
              </div>

              <div style={{ flex: '0 1 160px' }}>
                <select
                  className="form-control"
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value)}
                >
                  <option value="all">All Members</option>
                  {memberBazarList.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.memberName}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ flex: '0 1 160px' }}>
                <select
                  className="form-control"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="rice">Rice</option>
                  <option value="vegetables">Vegetables</option>
                  <option value="fish">Fish</option>
                  <option value="meat">Meat</option>
                  <option value="eggs">Eggs</option>
                  <option value="oil">Oil</option>
                  <option value="spices">Spices</option>
                  <option value="snacks">Snacks</option>
                  <option value="household">Household</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ flex: '0 1 160px' }}>
                <select
                  className="form-control"
                  value={fundingFilter}
                  onChange={(e) => setFundingFilter(e.target.value)}
                >
                  <option value="all">All Sources</option>
                  <option value="shared_fund">Shared Fund</option>
                  <option value="personal_credit">Personal Credit</option>
                </select>
              </div>

              <div style={{ flex: '0 1 150px' }}>
                <select
                  className="form-control"
                  value={approvalFilter}
                  onChange={(e) => setApprovalFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending ({pendingCount})</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="card">
            {filteredExpenses.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="No Expenses"
                description="No expenses found."
                actionText="Add Expense"
                onAction={() => setShowAddModal(true)}
              />
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Shop</th>
                      <th>Purchaser</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Receipt</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      {activeRole === 'manager' && <th style={{ textAlign: 'center' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((exp) => (
                      <tr
                        key={exp.id}
                        style={{
                          opacity: exp.is_reversed ? 0.6 : 1,
                          textDecoration: exp.is_reversed ? 'line-through' : 'none',
                        }}
                      >
                        <td>{formatDate(exp.date)}</td>
                        <td>
                          <span className="badge" style={{ background: 'rgba(31, 41, 55, 0.8)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)' }}>
                            {exp.category}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{exp.description}</div>
                          {exp.is_reversed ? (
                            <div style={{ fontSize: '0.725rem', color: 'var(--color-debt)', textDecoration: 'none' }}>
                              REVERSED: {exp.reversal_reason}
                            </div>
                          ) : exp.approval_status === 'rejected' && exp.rejection_reason ? (
                            <div style={{ fontSize: '0.725rem', color: 'var(--color-debt)', textDecoration: 'none' }}>
                              Reason: {exp.rejection_reason}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{exp.shop_name || 'N/A'}</td>
                        <td style={{ fontWeight: 500 }}>{exp.purchaser_name || exp.purchaser_id}</td>
                        <td>
                          {exp.funding_source === 'personal_credit' ? (
                            <span className="badge badge-credit" title="Purchaser received personal balance credit">
                              Personal Credit
                            </span>
                          ) : (
                            <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                              Shared Fund
                            </span>
                          )}
                        </td>
                        <td>
                          {exp.is_reversed ? (
                            <span className="badge badge-debt">Reversed</span>
                          ) : exp.approval_status === 'pending' ? (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#fbbf24',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                              }}
                            >
                              Pending
                            </span>
                          ) : exp.approval_status === 'rejected' ? (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(244, 63, 94, 0.15)',
                                color: 'var(--color-debt)',
                                border: '1px solid rgba(244, 63, 94, 0.3)',
                              }}
                              title={exp.rejection_reason || 'Rejected'}
                            >
                              Rejected
                            </span>
                          ) : (
                            <span className="badge badge-credit">Approved</span>
                          )}
                        </td>
                        <td>
                          {exp.receipt_url ? (
                            <button
                              onClick={() => {
                                setActiveReceiptUrl(exp.receipt_url || null);
                                setActiveReceiptDesc(`${exp.description} (৳${exp.amount})`);
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.3rem' }}
                            >
                              <Eye size={12} /> View
                            </button>
                          ) : (
                            <span
                              style={{ fontSize: '0.725rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}
                              title={exp.no_receipt_reason || 'No receipt'}
                            >
                              {exp.no_receipt_reason ? `No receipt (${exp.no_receipt_reason.slice(0, 15)}...)` : 'No receipt'}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.95rem' }}>
                          {formatCurrency(exp.amount, settings?.currency_symbol)}
                        </td>
                        {activeRole === 'manager' && (
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              {!exp.is_reversed && exp.approval_status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleApproveExpense(exp)}
                                    className="btn btn-primary btn-sm"
                                    title="Approve"
                                    style={{ padding: '0.25rem 0.5rem', background: '#10b981', border: 'none' }}
                                  >
                                    <Check size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleRejectExpense(exp)}
                                    className="btn btn-secondary btn-sm"
                                    title="Reject"
                                    style={{ padding: '0.25rem 0.5rem', color: 'var(--color-debt)' }}
                                  >
                                    <X size={13} />
                                  </button>
                                </>
                              )}
                              {!exp.is_reversed && (!exp.approval_status || exp.approval_status === 'approved') && (
                                <button
                                  onClick={() => handleReverseExpense(exp)}
                                  className="btn btn-secondary btn-sm"
                                  title="Reverse"
                                  style={{ padding: '0.25rem 0.5rem', color: 'var(--color-debt)' }}
                                >
                                  <RotateCcw size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: ASSIGNED BAZAR WORKFLOW VIEW */}
      {activeTab === 'assigned' && (
        <>
          {/* 4 Financial Metrics Tracked Separately */}
          <div className="grid-cols-4" style={{ marginBottom: '1.5rem' }}>
            <div className="card">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Amount</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.2rem 0' }}>
                {formatCurrency(totalAssignedMoney, settings?.currency_symbol)}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Actual Expenses</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-indigo)', margin: '0.2rem 0' }}>
                {formatCurrency(totalActualSpent, settings?.currency_symbol)}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending Return</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24', margin: '0.2rem 0' }}>
                {formatCurrency(totalRemainingPendingReturn, settings?.currency_symbol)}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Returned Amount</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-primary)', margin: '0.2rem 0' }}>
                {formatCurrency(totalReturnedMoney, settings?.currency_symbol)}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card" style={{ padding: '0.85rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
              <div style={{ flex: '1 1 240px', position: 'relative' }}>
                <Search size={15} color="var(--text-dim)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search member or note..."
                  className="form-control"
                  value={assignmentSearch}
                  onChange={(e) => setAssignmentSearch(e.target.value)}
                  style={{ paddingLeft: '2.1rem' }}
                />
              </div>

              <div style={{ flex: '0 1 180px' }}>
                <select
                  className="form-control"
                  value={assignmentStatusFilter}
                  onChange={(e) => setAssignmentStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="assigned">Assigned (Shopping Pending)</option>
                  <option value="submitted">Submitted (Review Pending)</option>
                  <option value="approved">Approved (Return Pending)</option>
                  <option value="rejected">Rejected</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div style={{ flex: '0 1 180px' }}>
                <select
                  className="form-control"
                  value={assignmentMemberFilter}
                  onChange={(e) => setAssignmentMemberFilter(e.target.value)}
                >
                  <option value="all">All Members</option>
                  {memberBazarList.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.memberName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Assignments Table */}
          <div className="card">
            {filteredAssignments.length === 0 ? (
              <EmptyState
                icon={HandCoins}
                title="No Assigned Bazar"
                description={
                  activeRole === 'manager'
                    ? "Assign money to a member to track their shopping and returns."
                    : "No assigned bazar for this month."
                }
                actionText={activeRole === 'manager' ? "Assign Money" : undefined}
                onAction={activeRole === 'manager' ? () => setShowAssignModal(true) : undefined}
              />
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Member</th>
                      <th style={{ textAlign: 'right' }}>Assigned</th>
                      <th style={{ textAlign: 'right' }}>Spent</th>
                      <th style={{ textAlign: 'right' }}>Remaining</th>
                      <th style={{ textAlign: 'right' }}>Returned</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignments.map((asgn) => {
                      const isAssignedToMe = asgn.assigned_to === user?.id;
                      const remaining = asgn.remaining_balance ?? (asgn.assigned_amount - (asgn.total_spent || 0));

                      return (
                        <tr key={asgn.id}>
                          <td>{formatDate(asgn.assigned_date)}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{asgn.member_name || asgn.assigned_to}</div>
                            {asgn.note && (
                              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                {asgn.note}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {formatCurrency(asgn.assigned_amount, settings?.currency_symbol)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-indigo)' }}>
                            {formatCurrency(asgn.total_spent || 0, settings?.currency_symbol)}
                          </td>
                          <td style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: remaining > 0 ? '#fbbf24' : 'var(--text-muted)',
                          }}>
                            {formatCurrency(remaining, settings?.currency_symbol)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--brand-primary)' }}>
                            {formatCurrency(asgn.returned_amount || 0, settings?.currency_symbol)}
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                textTransform: 'capitalize',
                                background:
                                  asgn.status === 'completed'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : asgn.status === 'rejected'
                                    ? 'rgba(244, 63, 94, 0.15)'
                                    : asgn.status === 'approved'
                                    ? 'rgba(139, 92, 246, 0.15)'
                                    : asgn.status === 'submitted'
                                    ? 'rgba(59, 130, 246, 0.15)'
                                    : 'rgba(245, 158, 11, 0.15)',
                                color:
                                  asgn.status === 'completed'
                                    ? 'var(--brand-primary)'
                                    : asgn.status === 'rejected'
                                    ? 'var(--color-debt)'
                                    : asgn.status === 'approved'
                                    ? '#a78bfa'
                                    : asgn.status === 'submitted'
                                    ? '#60a5fa'
                                    : '#fbbf24',
                                border: '1px solid currentColor',
                              }}
                            >
                              {asgn.status === 'assigned'
                                ? 'Pending Shopping'
                                : asgn.status === 'submitted'
                                ? 'Pending Review'
                                : asgn.status === 'approved'
                                ? 'Pending Return'
                                : asgn.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              {/* Member Submit Action */}
                              {isAssignedToMe && (asgn.status === 'assigned' || asgn.status === 'rejected') && (
                                <button
                                  onClick={() => {
                                    setSelectedAssignment(asgn);
                                    setShowSubmitModal(true);
                                  }}
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', gap: '0.25rem' }}
                                >
                                  <Send size={12} /> {asgn.status === 'rejected' ? 'Re-submit' : 'Submit'}
                                </button>
                              )}

                              {/* Manager Review Action */}
                              {activeRole === 'manager' && asgn.status === 'submitted' && (
                                <button
                                  onClick={() => {
                                    setSelectedAssignment(asgn);
                                    setShowDetailsModal(true);
                                  }}
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: '#3b82f6', border: 'none' }}
                                >
                                  Review
                                </button>
                              )}

                              {/* Manager Confirm Return Action */}
                              {activeRole === 'manager' && asgn.status === 'approved' && remaining > 0 && (
                                <button
                                  onClick={() => handleQuickConfirmReturn(asgn)}
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: '#10b981', border: 'none' }}
                                >
                                  Confirm Return
                                </button>
                              )}

                              {/* View Details */}
                              <button
                                onClick={() => {
                                  setSelectedAssignment(asgn);
                                  setShowDetailsModal(true);
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.25rem 0.5rem' }}
                                title="View Details"
                              >
                                <Eye size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODALS */}
      {/* 1. Add Standalone Expense Modal */}
      <AddExpenseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => loadData()}
      />

      {/* 2. Assign Money Modal */}
      <AssignBazarModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onSuccess={() => loadData()}
      />

      {/* 3. Submit Bazar Report Modal */}
      <SubmitBazarReportModal
        isOpen={showSubmitModal}
        onClose={() => {
          setShowSubmitModal(false);
          setSelectedAssignment(null);
        }}
        onSuccess={() => loadData()}
        assignment={selectedAssignment}
      />

      {/* 4. Assignment Details & Review Modal */}
      <BazarAssignmentDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedAssignment(null);
        }}
        onSuccess={() => loadData()}
        assignment={selectedAssignment}
        onOpenSubmitModal={(asgn) => {
          setSelectedAssignment(asgn);
          setShowSubmitModal(true);
        }}
      />

      {/* 5. Receipt Image Modal */}
      <ReceiptModal
        isOpen={Boolean(activeReceiptUrl)}
        onClose={() => setActiveReceiptUrl(null)}
        imageUrl={activeReceiptUrl}
        description={activeReceiptDesc}
      />
    </div>
  );
};
