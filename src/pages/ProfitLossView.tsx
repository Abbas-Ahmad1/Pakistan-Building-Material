import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Filter,
  PieChart,
  ShoppingBag,
  Wallet,
  Receipt,
  Printer,
  RefreshCw,
  ArrowRight,
  Percent,
} from 'lucide-react';
import { apiRequest } from '../services/api';

export const ProfitLossView: React.FC = () => {
  const [range, setRange] = useState('this_month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [pnlData, setPnlData] = useState<any>({
    summary: {
      total_orders: 0,
      gross_sales: 0,
      total_subtotal: 0,
      total_discounts: 0,
      total_cogs: 0,
      gross_profit: 0,
      gross_margin_pct: 0,
      total_expenses: 0,
      net_profit: 0,
      net_margin_pct: 0,
      total_collected: 0,
      total_uncollected: 0,
    },
    expense_breakdown: [],
    daily_timeline: [],
  });

  const fetchPnL = async () => {
    setIsLoading(true);
    try {
      let url = `/api/reports/profit-loss?range=${range}`;
      if (range === 'custom' && dateFrom) url += `&date_from=${dateFrom}`;
      if (range === 'custom' && dateTo) url += `&date_to=${dateTo}`;

      const res = await apiRequest<any>(url);
      if (res.success && res.data) {
        setPnlData(res.data);
      }
    } catch (err) {
      console.error('Error loading PnL report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPnL();
  }, [range, dateFrom, dateTo]);

  const summary = pnlData.summary;
  const isNetPositive = summary.net_profit >= 0;

  const rangeButtons = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this_week', label: 'This Week (7 Days)' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'this_year', label: 'This Year' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom Dates' },
  ];

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-stone-900 tracking-tight flex items-center space-x-2">
            <span>Profit & Loss Statement (Nafaa o Nuqsan)</span>
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Full retail trade accounting: Revenue, Cost of Goods Sold (COGS), Gross Profit, Operating Expenses & Net Income.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span>Print Income Statement</span>
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {rangeButtons.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setRange(b.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                range === b.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-semibold text-stone-600">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 bg-stone-50 border border-stone-300 rounded text-xs"
            />
            <span className="font-semibold text-stone-600">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 bg-stone-50 border border-stone-300 rounded text-xs"
            />
          </div>
        )}
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Gross Revenue */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Gross Sales Revenue</span>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900">
            Rs. {Number(summary.gross_sales).toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            {summary.total_orders} invoices generated
          </div>
        </div>

        {/* Cost of Goods Sold */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Cost of Goods (COGS)</span>
            <ShoppingBag className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-stone-800">
            Rs. {Number(summary.total_cogs).toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            Factory cost of stock sold
          </div>
        </div>

        {/* Gross Profit */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Gross Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">
            Rs. {Number(summary.gross_profit).toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center space-x-1">
            <Percent className="w-3 h-3" />
            <span>{summary.gross_margin_pct}% Gross Margin</span>
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Store Expenses</span>
            <Wallet className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-700">
            Rs. {Number(summary.total_expenses).toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            Rent, bills, staff & freight
          </div>
        </div>

        {/* Net Operating Profit */}
        <div
          className={`p-4 rounded-xl border shadow-xs ${
            isNetPositive
              ? 'bg-emerald-900 text-white border-emerald-950'
              : 'bg-rose-900 text-white border-rose-950'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-300">
            <span>Net Operating Profit</span>
            {isNetPositive ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div className="mt-2 text-2xl font-black">
            Rs. {Number(summary.net_profit).toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-300 font-medium mt-0.5 flex items-center space-x-1">
            <Percent className="w-3 h-3" />
            <span>{summary.net_margin_pct}% Net Profit Margin</span>
          </div>
        </div>
      </div>

      {/* Income Statement Detailed Waterfall Breakdown */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-stone-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm">Income Statement Breakdown (Formal Accounting Ledger)</h3>
          </div>
          <span className="text-xs font-mono text-stone-400">
            Period: {rangeButtons.find((b) => b.id === range)?.label}
          </span>
        </div>

        <div className="p-6 space-y-4 text-xs font-medium">
          {/* Revenue Section */}
          <div className="space-y-2 pb-4 border-b border-stone-200">
            <div className="flex justify-between items-center text-sm font-bold text-stone-900">
              <span>1. Total Sales (Turnover)</span>
              <span>Rs. {Number(summary.total_subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-stone-500 pl-4">
              <span>Less: Customer Discounts Allowed</span>
              <span className="text-rose-600 font-semibold">
                - Rs. {Number(summary.total_discounts).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center font-black text-stone-900 pl-4 pt-1 bg-stone-50 p-2 rounded">
              <span>Net Sales Revenue</span>
              <span className="text-blue-700">Rs. {Number(summary.gross_sales).toLocaleString()}</span>
            </div>
          </div>

          {/* Cost of Goods Section */}
          <div className="space-y-2 pb-4 border-b border-stone-200">
            <div className="flex justify-between items-center text-stone-700">
              <span>2. Less: Cost of Goods Sold (Purchase Value of Sold Items)</span>
              <span className="font-bold text-stone-900">
                - Rs. {Number(summary.total_cogs).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center font-black text-sm text-stone-900 pl-4 pt-1 bg-emerald-50 p-2 rounded border border-emerald-200">
              <span className="text-emerald-900">GROSS PROFIT</span>
              <span className="text-emerald-700">
                Rs. {Number(summary.gross_profit).toLocaleString()} ({summary.gross_margin_pct}%)
              </span>
            </div>
          </div>

          {/* Operating Expenses Breakdown */}
          <div className="space-y-2 pb-4 border-b border-stone-200">
            <div className="flex justify-between items-center text-sm font-bold text-stone-900">
              <span>3. Less: Store Operating Expenses</span>
              <span className="text-rose-700 font-bold">
                - Rs. {Number(summary.total_expenses).toLocaleString()}
              </span>
            </div>

            {pnlData.expense_breakdown && pnlData.expense_breakdown.length > 0 ? (
              <div className="pl-4 space-y-1.5 text-stone-600">
                {pnlData.expense_breakdown.map((exp: any, i: number) => {
                  const pctOfSales = summary.gross_sales > 0 ? ((exp.total_amount / summary.gross_sales) * 100).toFixed(1) : '0';
                  return (
                    <div key={i} className="flex justify-between items-center py-0.5">
                      <span>• {exp.category} ({exp.count} vouchers)</span>
                      <div className="space-x-3 text-right">
                        <span className="text-stone-400 text-[10px]">{pctOfSales}% of sales</span>
                        <span className="font-semibold text-stone-800">
                          Rs. {Number(exp.total_amount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pl-4 text-stone-400 italic">No operating expenses recorded in this period.</div>
            )}
          </div>

          {/* Final Net Operating Income */}
          <div
            className={`p-4 rounded-xl flex justify-between items-center font-black text-base ${
              isNetPositive
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-rose-100 text-rose-900 border border-rose-300'
            }`}
          >
            <div>
              <div>NET OPERATING PROFIT / (LOSS)</div>
              <div className="text-xs font-normal opacity-80">
                Net Margin: {summary.net_margin_pct}%
              </div>
            </div>
            <div className="text-xl">
              Rs. {Number(summary.net_profit).toLocaleString()}
            </div>
          </div>

          {/* Cash Flow Reconciliation */}
          <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
            <div className="p-3 bg-stone-100 rounded-lg">
              <span className="block text-stone-500 text-[10px] uppercase font-bold">
                Actual Cash / Bank Collected
              </span>
              <span className="text-sm font-black text-emerald-700">
                Rs. {Number(summary.total_collected).toLocaleString()}
              </span>
            </div>

            <div className="p-3 bg-stone-100 rounded-lg">
              <span className="block text-stone-500 text-[10px] uppercase font-bold">
                Market Udhaar (Uncollected Credit Dues)
              </span>
              <span className="text-sm font-black text-rose-700">
                Rs. {Number(summary.total_uncollected).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Performance Timeline Table */}
      {pnlData.daily_timeline && pnlData.daily_timeline.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-stone-50 border-b border-stone-200 font-bold text-xs text-stone-800 flex justify-between items-center">
            <span>Daily Profit & Loss Ledger Breakdown</span>
            <span className="text-[11px] text-stone-500 font-normal">
              {pnlData.daily_timeline.length} operating days
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-600 font-bold uppercase border-b border-stone-200 text-[10px]">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Sales Revenue</th>
                  <th className="py-2.5 px-4 text-right">COGS (Stock Cost)</th>
                  <th className="py-2.5 px-4 text-right">Gross Profit</th>
                  <th className="py-2.5 px-4 text-right">Operating Expenses</th>
                  <th className="py-2.5 px-4 text-right">Daily Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {pnlData.daily_timeline.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-stone-50">
                    <td className="py-2.5 px-4 font-mono font-medium text-stone-800">{row.day}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-stone-900">
                      Rs. {Number(row.revenue).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right text-stone-600">
                      Rs. {Number(row.cogs).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">
                      Rs. {Number(row.gross_profit).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium text-rose-700">
                      {row.expense > 0 ? `Rs. ${Number(row.expense).toLocaleString()}` : '-'}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-black ${
                        row.net_profit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      Rs. {Number(row.net_profit).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
