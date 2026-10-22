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
} from 'lucide-react';
import { useMealSystem } from '../context/MealSystemContext';
import { useAuth } from '../context/AuthContext';
import { getBazarExpenses, reverseBazarExpense } from '../services/api';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { formatCurrency, formatDate, getDhakaTodayDateString } from '../utils/formatters';
import { exportBazarExpensesToCsv } from '../utils/csvExport';
import type { BazarExpense, ExpenseCategory } from '../types';

export const BazarPage: React.FC = () => {
  const { activeSystem, activeRole, settings } = useMealSystem();
  const { user } = useAuth();

  const currentPeriod = getDhakaTodayDateString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod);
  const [expenses, setExpenses] = useState<BazarExpense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [fundingFilter, setFundingFilter] = useState<string>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | null>(null);
  const [activeReceiptDesc, setActiveReceiptDesc] = useState<string>('');

  const loadExpenses = async () => {
    if (!activeSystem) return;
    try {
      setLoading(true);
      const data = await getBazarExpenses(activeSystem.id, selectedPeriod);
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSystem) {
      setLoading(false);
      return;
    }
    loadExpenses();
  }, [activeSystem?.id, selectedPeriod]);

  // Manager reversal handler
  const handleReverseExpense = async (exp: BazarExpense) => {
    if (activeRole !== 'manager' || !user) return;
    const reason = window.prompt(
      `Enter mandatory reversal reason for "${exp.description}" (৳${exp.amount}):`
    );
    if (!reason || !reason.trim()) return;

    try {
      await reverseBazarExpense(exp.id, reason.trim(), user.id);
      await loadExpenses();
    } catch (err: any) {
      alert(err?.message || 'Failed to reverse expense');
    }
  };

  // Filtered expenses
  const filtered = expenses.filter((e) => {
    const matchesSearch =
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.shop_name && e.shop_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.purchaser_name && e.purchaser_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesFunding = fundingFilter === 'all' || e.funding_source === fundingFilter;
    const matchesMember = memberFilter === 'all' || e.purchaser_id === memberFilter;

    return matchesSearch && matchesCategory && matchesFunding && matchesMember;
  });

  // Calculate totals
  const activeExpenses = expenses.filter((e) => !e.is_reversed);
  const totalBazarAmount = activeExpenses.reduce((sum, e) => sum + e.amount, 0);
  const personalCreditAmount = activeExpenses
    .filter((e) => e.funding_source === 'personal_credit')
    .reduce((sum, e) => sum + e.amount, 0);
  const sharedFundAmount = totalBazarAmount - personalCreditAmount;
  const receiptsCount = activeExpenses.filter((e) => Boolean(e.receipt_url)).length;

  // Compute breakdown of bazar by member
  const memberBazarMap = new Map<string, {
    memberId: string;
    memberName: string;
    totalAmount: number;
    sharedFundAmount: number;
    personalCreditAmount: number;
    tripCount: number;
  }>();

  activeExpenses.forEach((exp) => {
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
          <h1>Bazar</h1>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="month"
            className="form-control"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{ width: 'auto', padding: '0.5rem 0.75rem' }}
          />

          <button
            onClick={() => exportBazarExpensesToCsv(expenses, `bazar-expenses-${selectedPeriod}.csv`)}
            className="btn btn-secondary btn-sm"
            disabled={expenses.length === 0}
          >
            <Download size={15} /> Export CSV
          </button>

          <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
            <Plus size={15} /> Add Expense
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid-cols-4" style={{ marginBottom: '1.75rem' }}>
        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Bazar</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.2rem 0' }}>
            {formatCurrency(totalBazarAmount, settings?.currency_symbol)}
          </div>
        </div>

        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Shared Fund</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-indigo)', margin: '0.2rem 0' }}>
            {formatCurrency(sharedFundAmount, settings?.currency_symbol)}
          </div>
        </div>

        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Personal Credit</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-primary)', margin: '0.2rem 0' }}>
            {formatCurrency(personalCreditAmount, settings?.currency_symbol)}
          </div>
        </div>

        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Receipts</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-teal)', margin: '0.2rem 0' }}>
            {receiptsCount} / {activeExpenses.length}
          </div>
        </div>
      </div>

      {/* BAZAR BY MEMBER BREAKDOWN */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Member Bazar</h3>
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
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No expenses recorded.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
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
                    padding: '0.75rem 0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Filter by this member"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
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
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.memberName}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {m.tripCount} trips ({pct}%)
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.25rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--brand-primary)' }}>
                      {formatCurrency(m.totalAmount, settings?.currency_symbol)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                    <span>Shared: {formatCurrency(m.sharedFundAmount, settings?.currency_symbol)}</span>
                    <span style={{ color: 'var(--accent-teal)' }}>Personal: {formatCurrency(m.personalCreditAmount, settings?.currency_symbol)}</span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', marginTop: '0.45rem', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', borderRadius: '2px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search..."
              className="form-control"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.2rem' }}
            />
          </div>

          <div style={{ flex: '0 1 180px' }}>
            <select
              className="form-control"
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
            >
              <option value="all">All Members</option>
              {memberBazarList.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.memberName} ({formatCurrency(m.totalAmount, settings?.currency_symbol)})
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: '0 1 180px' }}>
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

          <div style={{ flex: '0 1 180px' }}>
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
        </div>
      </div>

      {/* Itemized Table */}
      <div className="card">
        {loading ? (
          <LoadingSpinner message="Loading..." />
        ) : filtered.length === 0 ? (
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
                  <th>Receipt</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  {activeRole === 'manager' && <th style={{ textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((exp) => (
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
                      {exp.is_reversed && (
                        <div style={{ fontSize: '0.725rem', color: 'var(--color-debt)', textDecoration: 'none' }}>
                          REVERSED: {exp.reversal_reason}
                        </div>
                      )}
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
                        {!exp.is_reversed && (
                          <button
                            onClick={() => handleReverseExpense(exp)}
                            className="btn btn-secondary btn-sm"
                            title="Reverse this expense"
                            style={{ padding: '0.25rem 0.5rem', color: 'var(--color-debt)' }}
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => loadExpenses()}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(activeReceiptUrl)}
        onClose={() => setActiveReceiptUrl(null)}
        imageUrl={activeReceiptUrl}
        description={activeReceiptDesc}
      />
    </div>
  );
};
