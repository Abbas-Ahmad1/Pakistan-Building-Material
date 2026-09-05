import React from 'react';
import { ArrowLeft, Clock, CheckCircle2, ChevronRight } from 'lucide-react';

interface PhasePlaceholderProps {
  viewId: string;
  onBackToDashboard: () => void;
}

const phaseDetails: Record<
  string,
  { phaseNum: number; title: string; description: string; upcomingFeatures: string[] }
> = {
  pos: {
    phaseNum: 4,
    title: 'POS Terminal & Fast Cart',
    description: 'Scheduled for Phase 4: High-speed POS interface, barcode scanner support, custom cart quantities, customer selection, multiple payment methods, and invoice auto-generation.',
    upcomingFeatures: ['Barcode scanner search hook', 'Cart item discount & quantity controls', 'Customer credit selection', 'Cash/Card/Bank payment split', 'Instant invoice generation'],
  },
  products: {
    phaseNum: 2,
    title: 'Product Management Catalog',
    description: 'Scheduled for Phase 2: Full product CRUD, 10 units of measure, wholesale & retail pricing tiers, SKU & barcode management, brand filtering, and image attachments.',
    upcomingFeatures: ['Add/Edit/Delete products', 'Filter by category and brand', 'UOM conversion logic', 'Image upload & barcode tags'],
  },
  categories: {
    phaseNum: 2,
    title: 'Category & Subcategory Hierarchy',
    description: 'Scheduled for Phase 2: Hierarchical tree for Pipes & Fittings, Sanitary & Ceramics, Bath Accessories, Cement, and Tools.',
    upcomingFeatures: ['Add/Edit categories', 'Nested subcategories', 'Category-wise stock grouping'],
  },
  inventory: {
    phaseNum: 2,
    title: 'Inventory Valuation & Audit Ledger',
    description: 'Scheduled for Phase 2: Real-time stock increments & decrements, physical stock adjustment, valuation at purchase vs selling price, and stock movement ledger.',
    upcomingFeatures: ['Real-time inventory history', 'Manual stock adjustment with audit note', 'Low-stock reorder thresholds'],
  },
  purchases: {
    phaseNum: 3,
    title: 'Purchases & Stock Inward',
    description: 'Scheduled for Phase 3: Purchase orders, receiving supplier deliveries, auto-incrementing stock, and recording supplier payment vouchers.',
    upcomingFeatures: ['Supplier selection', 'Line-item cost entry', 'Auto-stock increment on reception', 'Due amount tracking'],
  },
  suppliers: {
    phaseNum: 3,
    title: 'Supplier Ledgers & Accounts Payable',
    description: 'Scheduled for Phase 3: Supplier directory, purchase history, payment vouchers, and outstanding payable reconciliation.',
    upcomingFeatures: ['Supplier ledger statement', 'Record supplier payment', 'Payable balance tracking'],
  },
  customers: {
    phaseNum: 3,
    title: 'Customer Directory & Credit/Due System',
    description: 'Scheduled for Phase 3: Registered contractors, credit limits, walk-in support, outstanding due balances, and installment collections.',
    upcomingFeatures: ['Credit limit enforcement', 'Due collection payment voucher', 'Customer statement history'],
  },
  sales: {
    phaseNum: 5,
    title: 'Sales Register & Invoice Printing',
    description: 'Scheduled for Phase 5: Complete sales ledger, A4 tax invoice formatting, 80mm thermal receipt printing, and PDF exports.',
    upcomingFeatures: ['Thermal slip print preview', 'A4 commercial invoice', 'PDF generation & download'],
  },
  expenses: {
    phaseNum: 6,
    title: 'Operating Expenses Ledger',
    description: 'Scheduled for Phase 6: Rent, electricity, staff salaries, transportation, maintenance recording with direct deduction from Net Profit.',
    upcomingFeatures: ['Expense categories', 'Payment method record', 'Direct link to Net Profit'],
  },
  'profit-loss': {
    phaseNum: 6,
    title: 'Comprehensive Profit & Loss Engine',
    description: 'Scheduled for Phase 6: Revenue minus COGS (actual database purchase cost) equals Gross Profit; minus operating expenses equals Net Profit.',
    upcomingFeatures: ['Date-range filtered P&L', 'COGS breakdown', 'Net profit margin % calculation'],
  },
  reports: {
    phaseNum: 7,
    title: 'Business Analytics & Reports Suite',
    description: 'Scheduled for Phase 7: Sales, Purchases, Stock Valuation, Due balances, Best Sellers, and CSV/PDF exportable reports.',
    upcomingFeatures: ['Multi-criteria report filters', 'CSV/Excel table exports', 'Print-ready summaries'],
  },
  bestsellers: {
    phaseNum: 7,
    title: 'Best Selling Products & Analytics',
    description: 'Scheduled for Phase 7: Ranking products by units sold, total revenue, and generated profit with 🔥 HOT SELLING badges.',
    upcomingFeatures: ['Top performers ranking', 'Margin contribution analysis', 'Velocity metrics'],
  },
  zakat: {
    phaseNum: 8,
    title: 'Business Zakat Calculation Module',
    description: 'Scheduled for Phase 8: Calculates zakatable liquid base: (Cash + Bank + Net Liquid Inventory + Collectible Receivables) minus Eligible Liabilities at 2.5% rate.',
    upcomingFeatures: ['Liquid asset inventory valuation', 'Collectible receivables factoring', 'Nisab comparison & disclaimer'],
  },
  users: {
    phaseNum: 1,
    title: 'User Management & Roles',
    description: 'Manage store staff accounts, roles (Admin / Cashier), and account statuses.',
    upcomingFeatures: ['Create cashier accounts', 'Reset passwords', 'Deactivate accounts'],
  },
  'audit-logs': {
    phaseNum: 9,
    title: 'Security & Audit Trail',
    description: 'Scheduled for Phase 9: Forensic trail recording all product edits, deletions, invoice generations, and permission changes with timestamps and user IDs.',
    upcomingFeatures: ['Search audit events', 'IP & user tracking', 'Change payload inspection'],
  },
  settings: {
    phaseNum: 1,
    title: 'Store Configuration',
    description: 'Configure store name, address, contact phone, currency, invoice prefix, and receipt footer message.',
    upcomingFeatures: ['Store profile editor', 'Receipt format preferences', 'Low stock alert threshold'],
  },
};

export const PhasePlaceholder: React.FC<PhasePlaceholderProps> = ({
  viewId,
  onBackToDashboard,
}) => {
  const details = phaseDetails[viewId] || {
    phaseNum: 2,
    title: viewId.replace('-', ' ').toUpperCase(),
    description: 'Module ready for subsequent development phases.',
    upcomingFeatures: ['Integrated database records', 'Role-based access'],
  };

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center space-x-1 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <div className="bg-white rounded-xl border border-stone-200 p-6 sm:p-8 shadow-xs">
          <div className="flex items-center space-x-3 mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
              Phase {details.phaseNum} Roadmap
            </span>
            <span className="text-xs text-stone-400 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Phase 1 Architecture Complete</span>
            </span>
          </div>

          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">{details.title}</h2>
          <p className="mt-2 text-sm text-stone-600 leading-relaxed">{details.description}</p>

          <div className="mt-8 pt-6 border-t border-stone-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              Features in this phase:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {details.upcomingFeatures.map((f, i) => (
                <div key={i} className="flex items-start space-x-2.5 p-3 rounded-lg bg-stone-50 border border-stone-100 text-xs text-stone-700">
                  <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between pt-6 border-t border-stone-200">
            <span className="text-xs text-stone-500">
              Database schema & relationships are fully defined in Phase 1.
            </span>
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
