import React, { useState, useEffect } from 'react';
import {
  Wallet,
  DollarSign,
  PlusCircle,
  X,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Building2,
  User,
  Printer,
  History,
  Coins,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { CashDrawerShift, DrawerExpense } from '../../types';
import { ShiftThermalSlip } from './ShiftThermalSlip';

interface CashDrawerModalProps {
  branchId: number;
  onClose: () => void;
  onShiftStatusChange?: () => void;
}

export const CashDrawerModal: React.FC<CashDrawerModalProps> = ({
  branchId,
  onClose,
  onShiftStatusChange,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [activeShift, setActiveShift] = useState<CashDrawerShift | null>(null);
  const [recentShifts, setRecentShifts] = useState<CashDrawerShift[]>([]);
  const [activeTab, setActiveTab] = useState<'register' | 'expense' | 'close' | 'history'>('register');

  // Open Shift Form State
  const [openingBalance, setOpeningBalance] = useState<string>('5000');
  const [openingNotes, setOpeningNotes] = useState<string>('');
  const [isOpeningShift, setIsOpeningShift] = useState(false);

  // Petty Expense Form State
  const [expenseCategory, setExpenseCategory] = useState<string>('Loading & Unloading Labor (Mazdoori)');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [expensePaidTo, setExpensePaidTo] = useState<string>('');
  const [isLoggingExpense, setIsLoggingExpense] = useState(false);

  // Close Shift Form State
  const [actualCashCount, setActualCashCount] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [isClosingShift, setIsClosingShift] = useState(false);

  // Slip Printing State
  const [printedShift, setPrintedShift] = useState<CashDrawerShift | null>(null);
  const [storeSettings, setStoreSettings] = useState<any>(null);

  // Notification / Error
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const EXPENSE_CATEGORIES = [
    'Loading & Unloading Labor (Mazdoori)',
    'Transportation & Suzuki Freight',
    'Tea & Refreshments (Chaye Kharcha)',
    'Shop Cleaning & Helper Tip',
    'Shop Hardware & Shutter Repairs',
    'Packaging Materials & Tape',
    'Generator Petrol / Diesel Fuel',
    'Miscellaneous Petty Expense',
  ];

  // Fetch Current Shift Data
  const loadShiftData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest<{
        hasActiveShift: boolean;
        shift?: CashDrawerShift;
        recentShifts?: CashDrawerShift[];
      }>(`/api/cash-drawer/current?branch_id=${branchId}`);

      if (res.success && res.data) {
        if (res.data.hasActiveShift && res.data.shift) {
          setActiveShift(res.data.shift);
          setActiveTab('register');
        } else {
          setActiveShift(null);
          if (res.data.recentShifts) {
            setRecentShifts(res.data.recentShifts);
          }
        }
      }

      // Also load recent shifts list for history tab
      const histRes = await apiRequest<CashDrawerShift[]>(`/api/cash-drawer/shifts?branch_id=${branchId}&limit=10`);
      if (histRes.success && histRes.data) {
        setRecentShifts(histRes.data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load shift information');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShiftData();
  }, [branchId]);

  // Handle Open Shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsOpeningShift(true);

    try {
      const res = await apiRequest<CashDrawerShift>('/api/cash-drawer/open', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: branchId,
          opening_balance: Number(openingBalance) || 0,
          notes: openingNotes.trim(),
        }),
      });

      if (res.success && res.data) {
        setSuccessMsg(res.message || 'Register shift opened successfully!');
        await loadShiftData();
        if (onShiftStatusChange) onShiftStatusChange();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to open register shift');
    } finally {
      setIsOpeningShift(false);
    }
  };

  // Handle Log Petty Expense
  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const amt = Number(expenseAmount);
    if (!amt || amt <= 0) {
      setErrorMsg('Please enter a valid expense amount');
      return;
    }
    if (!expenseNote.trim()) {
      setErrorMsg('Please enter a short description/note for this payout');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoggingExpense(true);

    try {
      const res = await apiRequest<DrawerExpense>('/api/cash-drawer/expense', {
        method: 'POST',
        body: JSON.stringify({
          shift_id: activeShift.id,
          category: expenseCategory,
          amount: amt,
          note: expenseNote.trim(),
          paid_to: expensePaidTo.trim(),
        }),
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Petty cash deduction logged successfully.');
        setExpenseAmount('');
        setExpenseNote('');
        setExpensePaidTo('');
        await loadShiftData();
        setActiveTab('register');
        if (onShiftStatusChange) onShiftStatusChange();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record drawer expense');
    } finally {
      setIsLoggingExpense(false);
    }
  };

  // Handle Close Shift
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    if (actualCashCount === '') {
      setErrorMsg('Please count the cash drawer and enter the actual counted amount.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsClosingShift(true);

    try {
      const res = await apiRequest<{ shift: CashDrawerShift; settings: any }>('/api/cash-drawer/close', {
        method: 'POST',
        body: JSON.stringify({
          shift_id: activeShift.id,
          actual_closing_cash: Number(actualCashCount) || 0,
          closing_notes: closingNotes.trim(),
        }),
      });

      if (res.success && res.data) {
        setSuccessMsg(res.message || 'Shift closed successfully.');
        setPrintedShift(res.data.shift);
        setStoreSettings(res.data.settings);
        await loadShiftData();
        if (onShiftStatusChange) onShiftStatusChange();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to close register shift');
    } finally {
      setIsClosingShift(false);
    }
  };

  // Handle Reprint Historic Shift
  const handleReprintShift = async (shiftId: number) => {
    try {
      const res = await apiRequest<{ shift: CashDrawerShift; settings: any }>(`/api/cash-drawer/shifts/${shiftId}`);
      if (res.success && res.data) {
        setPrintedShift(res.data.shift);
        setStoreSettings(res.data.settings);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch shift details for printing');
    }
  };

  // Derived live metrics
  const opening = activeShift?.runningMetrics?.opening_balance ?? Number(activeShift?.opening_balance || 0);
  const cashSales = activeShift?.runningMetrics?.cash_sales ?? Number(activeShift?.cash_sales_amount || 0);
  const otherSales = activeShift?.runningMetrics?.other_sales ?? Number(activeShift?.other_sales_amount || 0);
  const totalRev = activeShift?.runningMetrics?.total_revenue ?? Number(activeShift?.total_sales_amount || (cashSales + otherSales));
  const refunds = activeShift?.runningMetrics?.cash_refunds ?? Number(activeShift?.cash_refunds_amount || 0);
  const expensesList = activeShift?.expenses || [];
  const expensesTotal = activeShift?.runningMetrics?.total_expenses ?? expensesList.reduce((s, e) => s + Number(e.amount || 0), 0);
  const expectedCash = activeShift?.runningMetrics?.expected_closing_cash ?? Math.max(0, opening + cashSales - refunds - expensesTotal);

  const countedCashNumber = Number(actualCashCount) || 0;
  const liveDifference = Math.round((countedCashNumber - expectedCash) * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold">Daily Cash Register & Shift Closing</h3>
                {activeShift && (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-black uppercase">
                    🟢 Shift Active
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400 font-medium">
                {activeShift ? `Shift ${activeShift.shift_code} • ${activeShift.cashier_name}` : 'Start daily counter register'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={loadShiftData}
              title="Refresh Shift Data"
              className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center space-x-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium flex-1">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium flex-1">{successMsg}</span>
          </div>
        )}

        {/* Navigation Tabs (When Shift is Active) */}
        {activeShift && (
          <div className="px-6 pt-3 bg-stone-50 border-b border-stone-200 flex space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                activeTab === 'register'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-stone-500 hover:text-stone-900'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Register Balance</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('expense')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                activeTab === 'expense'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-stone-500 hover:text-stone-900'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
              <span>Petty Drawer Expense</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('close')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                activeTab === 'close'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-stone-500 hover:text-stone-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Close Shift & Count</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                activeTab === 'history'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-stone-500 hover:text-stone-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Shift History</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-stone-400 space-y-2">
              <RefreshCw className="w-7 h-7 animate-spin text-amber-600" />
              <p className="text-xs font-medium">Checking register status...</p>
            </div>
          ) : !activeShift ? (
            /* ================= NO SHIFT RUNNING: OPEN SHIFT VIEW ================= */
            <div className="space-y-6">
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-950">Start Daily Register Shift</h4>
                    <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                      Enter the opening cash float in the drawer at the start of your shift. All cash sales and minor expenses will be tracked automatically.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleOpenShift} className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Opening Cash in Drawer (Float) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">
                        Rs.
                      </span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(e.target.value)}
                        placeholder="5000"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-sm font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 shadow-xs"
                      />
                    </div>
                    {/* Quick float amount buttons */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[0, 2000, 5000, 10000, 15000, 20000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setOpeningBalance(amt.toString())}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Rs. {amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Opening Note / Register Float Detail (Optional)
                    </label>
                    <input
                      type="text"
                      value={openingNotes}
                      onChange={(e) => setOpeningNotes(e.target.value)}
                      placeholder="e.g. Morning shift start with change notes"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isOpeningShift}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs md:text-sm flex items-center justify-center space-x-2 shadow-md transition-all active:scale-[0.99]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isOpeningShift ? 'Opening Register...' : 'Open Shift & Start Billing'}</span>
                  </button>
                </form>
              </div>

              {/* Past Shifts Table */}
              {recentShifts.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1.5">
                    <History className="w-4 h-4 text-stone-400" />
                    <span>Recent Closed Shifts</span>
                  </h4>

                  <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100">
                    {recentShifts.slice(0, 4).map((s) => (
                      <div key={s.id} className="p-3 bg-stone-50/50 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="font-bold text-stone-900 flex items-center space-x-2">
                            <span>{s.shift_code}</span>
                            <span className="text-[10px] font-normal text-stone-500">({s.cashier_name})</span>
                          </div>
                          <div className="text-[10px] text-stone-500">
                            {new Date(s.opened_at).toLocaleDateString()} • Cash Sales: Rs. {Number(s.cash_sales_amount || 0).toLocaleString()}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <span className="text-[10px] text-stone-400 block">Actual Cash</span>
                            <span className="font-bold text-stone-900">Rs. {Number(s.actual_closing_cash || s.expected_closing_cash).toLocaleString()}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleReprintShift(s.id)}
                            className="p-1.5 bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 rounded-lg shadow-2xs transition-colors"
                            title="Reprint Shift Z-Report Slip"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'register' ? (
            /* ================= TAB 1: RUNNING REGISTER DASHBOARD ================= */
            <div className="space-y-5">
              {/* Big Running Cash Hero Card */}
              <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                      Expected Cash in Hand (Drawer)
                    </span>
                    <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      Rs. {expectedCash.toLocaleString()}
                    </div>
                    <p className="text-xs text-stone-300 mt-1">
                      Shift Started: {new Date(activeShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {activeShift.shift_code}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('expense')}
                      className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5"
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span>- Petty Expense</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('close')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center space-x-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Close Shift</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Running Formula Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-stone-500">Opening Float</span>
                  <div className="text-sm font-black text-stone-800">Rs. {opening.toLocaleString()}</div>
                  <span className="text-[10px] text-stone-400">Cash in drawer at start</span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-emerald-700">(+) Cash Sales</span>
                  <div className="text-sm font-black text-emerald-800">Rs. {cashSales.toLocaleString()}</div>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    {activeShift.runningMetrics?.sales_count || 0} invoices paid
                  </span>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-rose-700">(-) Drawer Expenses</span>
                  <div className="text-sm font-black text-rose-800">Rs. {expensesTotal.toLocaleString()}</div>
                  <span className="text-[10px] text-rose-600 font-medium">
                    {expensesList.length} petty payouts
                  </span>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-amber-800">Digital / Credit</span>
                  <div className="text-sm font-black text-amber-900">Rs. {otherSales.toLocaleString()}</div>
                  <span className="text-[10px] text-amber-700">Bank, Card, Khata</span>
                </div>
              </div>

              {/* Expenses Itemized List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Shift Petty Expenses ({expensesList.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveTab('expense')}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Log Expense</span>
                  </button>
                </div>

                {expensesList.length === 0 ? (
                  <div className="p-4 bg-stone-50 border border-dashed border-stone-200 rounded-xl text-center text-xs text-stone-500">
                    No petty cash expenses logged during this shift yet.
                  </div>
                ) : (
                  <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100">
                    {expensesList.map((e) => (
                      <div key={e.id} className="p-3 flex items-center justify-between text-xs bg-white hover:bg-stone-50">
                        <div>
                          <div className="font-bold text-stone-900">{e.category}</div>
                          <div className="text-[11px] text-stone-500">
                            {e.note} {e.paid_to ? `• Paid to: ${e.paid_to}` : ''}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-rose-700">-Rs. {Number(e.amount).toLocaleString()}</span>
                          <span className="block text-[10px] text-stone-400">
                            {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'expense' ? (
            /* ================= TAB 2: LOG PETTY CASH EXPENSE ================= */
            <div className="space-y-5">
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-rose-900 uppercase">Petty Cash Payout from Drawer</h4>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    Deducts money directly from the cashier cash-in-hand register with an audit trail.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-rose-600 block">Available Cash</span>
                  <span className="text-sm font-black text-rose-900">Rs. {expectedCash.toLocaleString()}</span>
                </div>
              </div>

              <form onSubmit={handleLogExpense} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Expense Category *</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Amount to Deduct (Rs.) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">Rs.</span>
                    <input
                      type="number"
                      min="1"
                      required
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full pl-10 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-sm font-black text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  {/* Quick Amount Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[100, 200, 300, 500, 1000, 1500, 2000, 3000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setExpenseAmount(amt.toString())}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Rs. {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Paid To / Recipient</label>
                    <input
                      type="text"
                      value={expensePaidTo}
                      onChange={(e) => setExpensePaidTo(e.target.value)}
                      placeholder="e.g. Suzuki Driver, Gul Khan (Labor)"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Purpose / Short Note *</label>
                    <input
                      type="text"
                      required
                      value={expenseNote}
                      onChange={(e) => setExpenseNote(e.target.value)}
                      placeholder="e.g. Unloading 40 bags cement at rear warehouse"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoggingExpense}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all"
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    <span>{isLoggingExpense ? 'Deducting...' : 'Record Payout & Deduct from Drawer'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : activeTab === 'close' ? (
            /* ================= TAB 3: CLOSE SHIFT WITH PHYSICAL CASH COUNT ================= */
            <div className="space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  End of Shift Reconciliation
                </h4>
                <p className="text-xs text-amber-800">
                  Formula: <span className="font-mono font-bold">Expected = Opening (Rs. {opening.toLocaleString()}) + Cash Sales (Rs. {cashSales.toLocaleString()}) - Drawer Expenses (Rs. {expensesTotal.toLocaleString()})</span>
                </p>
                <div className="pt-2 border-t border-amber-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-900">Expected Closing Cash:</span>
                  <span className="text-base font-black text-amber-950">Rs. {expectedCash.toLocaleString()}</span>
                </div>
              </div>

              <form onSubmit={handleCloseShift} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Physical Cash Count (Count all notes in drawer) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={actualCashCount}
                      onChange={(e) => setActualCashCount(e.target.value)}
                      placeholder="Enter counted cash..."
                      className="w-full pl-10 pr-3 py-2.5 bg-white border border-stone-300 rounded-xl text-base font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 shadow-xs"
                    />
                  </div>
                </div>

                {/* Live Cash Discrepancy Indicator */}
                {actualCashCount !== '' && (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                      liveDifference === 0
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : liveDifference > 0
                        ? 'bg-blue-50 border-blue-300 text-blue-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider font-extrabold">
                        Reconciliation Status
                      </span>
                      <span>
                        {liveDifference === 0
                          ? 'Exact Match (Balanced Drawer)'
                          : liveDifference > 0
                          ? 'Cash Surplus in Drawer'
                          : 'Cash Shortage in Drawer'}
                      </span>
                    </div>

                    <div className="text-right text-sm font-black">
                      {liveDifference === 0
                        ? 'Rs. 0 (Perfect)'
                        : liveDifference > 0
                        ? `+Rs. ${liveDifference.toLocaleString()} SURPLUS`
                        : `-Rs. ${Math.abs(liveDifference).toLocaleString()} SHORTAGE`}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Closing Notes</label>
                  <input
                    type="text"
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="e.g. Handed over cash and counter keys to evening shift cashier"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isClosingShift}
                    className="flex-1 py-3 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs md:text-sm font-black flex items-center justify-center space-x-2 shadow-md transition-all active:scale-[0.99]"
                  >
                    <Printer className="w-4 h-4 text-amber-400" />
                    <span>{isClosingShift ? 'Closing Shift...' : 'Close Shift & Print Z-Report'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ================= TAB 4: SHIFT HISTORY ================= */
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Shift Register History ({recentShifts.length})
              </h4>

              {recentShifts.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400 bg-stone-50 rounded-xl">
                  No previous shifts found for this branch.
                </div>
              ) : (
                <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 text-xs">
                  {recentShifts.map((s) => (
                    <div key={s.id} className="p-3.5 bg-white hover:bg-stone-50 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-stone-900">{s.shift_code}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500">
                          Cashier: {s.cashier_name} • {new Date(s.opened_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 block">Cash Sales</span>
                          <span className="font-bold text-stone-900">
                            Rs. {Number(s.cash_sales_amount || 0).toLocaleString()}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 block">Difference</span>
                          <span
                            className={`font-black ${
                              Number(s.cash_difference || 0) === 0
                                ? 'text-stone-700'
                                : Number(s.cash_difference || 0) > 0
                                ? 'text-blue-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {Number(s.cash_difference || 0) === 0
                              ? '0.00'
                              : Number(s.cash_difference || 0) > 0
                              ? `+${Number(s.cash_difference).toLocaleString()}`
                              : `-${Math.abs(Number(s.cash_difference)).toLocaleString()}`}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleReprintShift(s.id)}
                          className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center space-x-1"
                          title="Print Thermal Slip"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Print Slip</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Printable Thermal Slip Modal */}
      {printedShift && (
        <ShiftThermalSlip
          shift={printedShift}
          settings={storeSettings}
          onClose={() => setPrintedShift(null)}
        />
      )}
    </div>
  );
};
