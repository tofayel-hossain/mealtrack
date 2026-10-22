# Meal Hisab (মিলের হিসাব)

> Production-grade, transparent meal and grocery expense management web application designed for shared bachelor messes, student hostels, and shared flats. Built with **React**, **TypeScript**, **PostgreSQL**, and **Supabase**.

---

## 🌟 Key Features

1. **Multi-Tenant System Isolation & System Switcher**
   - Users can create, belong to, and switch between multiple meal systems (e.g. "Padma Student Mess", "Green View Flat 4B").
   - Complete data isolation per system through PostgreSQL Row Level Security (RLS).
   - Shareable time-expiring invitation codes (7-day validity).

2. **Manager & Member Role Governance**
   - **Manager**: Manage members, set daily cooking status, record/reverse bazar purchases and deposits, configure cutoff times, make post-cutoff meal corrections, and finalize monthly accounting.
   - **Members**: Transparent read-only access to all itemized shared expenses, deposit histories, meal matrix, audit logs, and ability to toggle meals before cutoff.
   - **Secure Manager Transfer**: Current manager can securely hand over mess leadership to any active member with mandatory audit justification.

3. **Daily Meals & Cooking Calendar (Asia/Dhaka & BDT ৳)**
   - Default daily meal count (normally 2 meals: Lunch & Dinner).
   - Daily cutoff time enforcement (Default: 10:00 AM Asia/Dhaka).
   - Clear system cooking statuses: **Cooking Today**, **No Cooking Today**, or **Pending Confirmation**.
   - **No-Cooking Day Rule**: A no-cooking day strictly overrides default meals and prevents meal charges across all members.
   - Post-cutoff authorized manager corrections with responsible person, previous count, new count, timestamp, and mandatory justification.

4. **Monthly Accounting & Exact Meal Rate Engine**
   - Independent calendar month accounting periods (e.g. `2026-10`).
   - Formula:
     $$\text{Monthly Meal Rate} = \frac{\text{Eligible Bazar Expenses}}{\text{Finalized Total Meals}}$$
     $$\text{Member Meal Cost} = \text{Finalized Member Meals} \times \text{Monthly Meal Rate}$$
     $$\text{Member Contribution \%} = \frac{\text{Member Finalized Meals}}{\text{Total Finalized Meals}} \times 100$$
   - **Zero-Meal Rule**: If a month has 0 finalized meals, meal rate is explicitly displayed as *Unavailable* (division by zero prevented).
   - Deposits, previous-month debts, and carried-forward balances never distort the current month's meal rate.

5. **Monthly Balances & Automated Carry-Forward**
   - Unified standard balance convention:
     - **Positive (+) = Available Credit** (Advance paid)
     - **Negative (−) = Outstanding Debt** (Owed to mess)
   - Closing balance equation:
     $$\text{Closing Balance} = \text{Opening Balance} + \text{Deposits} + \text{Personal Bazar Credits} + \text{Adjustments} - \text{Meal Costs} - \text{Other Charges}$$
   - **Carry-Forward Rule**: Next month's Opening Balance equals the previous month's latest valid Closing Balance.

6. **Bazar Expense Tracker & Personal Grocery Credits**
   - Categories: Rice, Vegetables, Fish, Meat, Eggs, Oil, Spices, Snacks, Household supplies, Other expenses.
   - Funding source support:
     - **Shared Mess Fund** (cash from member deposits)
     - **Personally Paid by Member**: Automatically credits the member's balance in the ledger without duplicating expenses or counting as an ordinary deposit.
   - Receipt image uploads to Supabase Storage with zoom modal.
   - Mandatory missing-receipt explanations for unreceipted street vendor purchases.
   - Auditable reversals for manager.

7. **Deposits & Unified Financial Ledger**
   - Payment methods: Cash, bKash, Nagad, Rocket, Bank Transfer, Other with transaction reference ID.
   - Unified single-source-of-truth ledger tracking: opening balances, deposits, personal credits, meal charges, adjustments, and reversals.
   - Auditable balance adjustments with reason.

8. **Monthly Closing, Snapshots & Transparency Reports**
   - Pre-closing integrity checklist (checks for unresolved cooking days, missing receipts, zero divisions).
   - Finalization creates an immutable snapshot version (v1, v2...) in the database.
   - Printable statements (`@media print` formatted) with manager and auditor signature blocks.
   - Itemized CSV downloads for expenses and monthly statements.

9. **Tamper-Evident Read-Only Audit History**
   - Shared log capturing all operational and financial events with actor name, timestamp, previous vs new value diffs, and mandatory reasons.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 with TypeScript, Vite |
| **Routing** | React Router v7 |
| **Styling** | Vanilla CSS Design Tokens, Glassmorphism, Dark Mode Palette |
| **Icons** | Lucide React |
| **Database & Auth** | Supabase PostgreSQL, Supabase Auth, Supabase Storage |
| **Security** | Row Level Security (RLS) on all tables, PostgreSQL Security Definer Functions |
| **Testing** | Vitest automated unit & calculation test suite |

---

## 📁 Repository Structure

```
MealHisab/
├── supabase/
│   └── migrations/
│       ├── 20261022000001_initial_schema.sql  # Full PostgreSQL schema, RLS & RPCs
│       └── 20261022000002_fix_meal_systems_rls.sql # RLS & join policies
├── src/
│   ├── types/
│   │   └── index.ts                           # Complete TypeScript interfaces
│   ├── utils/
│   │   ├── accounting.ts                      # Pure accounting math engine
│   │   ├── formatters.ts                      # Currency (BDT ৳), date, cutoff helpers
│   │   └── csvExport.ts                       # CSV generation utility
│   ├── services/
│   │   ├── supabase.ts                        # Supabase client initializer
│   │   └── api.ts                             # Database queries & Supabase RPCs
│   ├── context/
│   │   ├── AuthContext.tsx                    # Supabase Auth state
│   │   └── MealSystemContext.tsx              # Multi-system state & active role
│   ├── components/
│   │   ├── Navbar.tsx                         # Header, system switcher, countdown
│   │   ├── Sidebar.tsx                        # Navigation links & mobile drawer
│   │   ├── StatCard.tsx                       # Metric card with semantic variants
│   │   ├── AddExpenseModal.tsx                # Itemized expense recorder
│   │   ├── AddDepositModal.tsx                # Deposit logger
│   │   ├── ManagerTransferModal.tsx           # Role handover modal
│   │   ├── PostCutoffModal.tsx                # Post-cutoff authorized override
│   │   ├── ReceiptModal.tsx                   # Receipt image preview modal
│   │   └── EmptyState.tsx / LoadingSpinner.tsx
│   ├── pages/
│   │   ├── DashboardPage.tsx                  # Role-adaptive dashboard
│   │   ├── MealsPage.tsx                      # 7-day strip, cooking calendar
│   │   ├── BazarPage.tsx                      # Itemized purchases & receipt proofs
│   │   ├── DepositsPage.tsx                   # Deposits & unified ledger
│   │   ├── MembersPage.tsx                    # Members roster & transfer leadership
│   │   ├── AccountingPage.tsx                 # Meal rate formula & balance sheet
│   │   ├── MonthlyClosingPage.tsx             # Pre-closing audit & version snapshots
│   │   ├── ReportsPage.tsx                    # Printable statement & CSV export
│   │   ├── AuditHistoryPage.tsx               # Transparent tamper-evident audit log
│   │   ├── InvitationsPage.tsx                # Shareable invite tokens
│   │   ├── SettingsPage.tsx                   # Cutoff & meal count configuration
│   │   ├── ProfilePage.tsx                    # User profile & my systems
│   │   └── LoginPage.tsx / RegisterPage.tsx
│   ├── App.tsx                                # Routing & protected layout
│   ├── index.css                              # Production CSS design system
│   └── main.tsx                               # Entrypoint
├── tests/
│   └── accounting.test.ts                     # 18 automated Vitest tests
├── .env.example
├── vitest.config.ts
└── package.json
```

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Test Suite
```bash
npm test
```
All 18 automated tests will run and verify:
- Monthly meal rate calculation (normal, fractional, zero-meal cases)
- Member meal costs and contribution percentages
- Closing balance equation (positive credit, negative debt)
- October-to-November carry-forward balance rules
- Personal bazar credits without double-counting
- No-cooking day calendar overrides
- Pre-closing finalization validation checklist

### 3. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🗄️ Supabase PostgreSQL Setup Guide

To connect Meal Hisab to your live Supabase cloud database:

### 1. Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Select your preferred region (e.g. `ap-southeast-1` Singapore or nearest).

### 2. Run Database Migrations
1. In your Supabase Dashboard, go to the **SQL Editor**.
2. Run [supabase/migrations/20261022000001_initial_schema.sql](file:///f:/MealHisab/supabase/migrations/20261022000001_initial_schema.sql).
3. Run [supabase/migrations/20261022000002_fix_meal_systems_rls.sql](file:///f:/MealHisab/supabase/migrations/20261022000002_fix_meal_systems_rls.sql).
   - This sets up all 15 relational tables with foreign keys and unique constraints.
   - Enables Row Level Security (RLS) on every table.
   - Installs the stored procedures: `record_bazar_expense_tx`, `record_deposit_tx`, `save_daily_meal`, `transfer_manager_role`, and `finalize_monthly_accounting_tx`.
   - Creates the `bazar-receipts` storage bucket and security policies.

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-publishable-key-here
```
Restart the dev server:
```bash
npm run dev
```
The app will automatically detect your Supabase credentials and switch to live database mode!

---

## 🧪 Testing & Reliability

The test suite in `tests/accounting.test.ts` executes with Vitest:

```bash
npm test
```

### Coverage Highlights:
- **Meal Rate Calculation**: Proves exactness up to 4 decimal places and guarantees `null` return on zero-meal months.
- **Independence of Meal Rate**: Asserts that carried-forward debts and advance deposits do not alter the current meal rate.
- **Carry-Forward Integrity**: Tests the requirement that an October debt of ৳500 carried into November with a ৳1,200 meal cost yields -৳1,700 before a ৳1,000 deposit brings it to -৳700.
- **Kitchen Cancellation Override**: Verifies that days marked as "no_cooking" charge 0 meals regardless of configured default meals.
- **Personal Grocery Payment**: Verifies that a member paying for groceries gets credited in their balance without double-charging the shared pool.

---

## 📦 Production Bundle Build

To create the optimized static production bundle:
```bash
npm run build
```
The output will be generated in `dist/`, ready for zero-config deployment to Vercel, Netlify, Cloudflare Pages, or GitHub Pages.
