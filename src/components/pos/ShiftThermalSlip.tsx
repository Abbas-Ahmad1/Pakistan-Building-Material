import React from 'react';
import { Printer, X, CheckCircle, AlertTriangle, Building2, User, Clock, Wallet, DollarSign } from 'lucide-react';
import { CashDrawerShift } from '../../types';

interface ShiftThermalSlipProps {
  shift: CashDrawerShift;
  settings?: any;
  onClose: () => void;
}

export const ShiftThermalSlip: React.FC<ShiftThermalSlipProps> = ({ shift, settings, onClose }) => {
  const storeName = settings?.store_name || 'Pakistan Building Materials & paint store';
  const storeAddress = shift.branch_address || settings?.address || 'Kumber Bazar Lower Dir Maidan';
  const storePhone = shift.branch_phone || settings?.phone || '+92 300 5936652 / +92 300 1801818';
  const branchName = shift.branch_name || 'Branch 1 - Main Store';
  const currency = settings?.currency || 'Rs.';

  const openingBalance = Number(shift.opening_balance || 0);
  const cashSales = Number(shift.cash_sales_amount || shift.runningMetrics?.cash_sales || 0);
  const otherSales = Number(shift.other_sales_amount || shift.runningMetrics?.other_sales || 0);
  const totalSales = Number(shift.total_sales_amount || shift.runningMetrics?.total_revenue || (cashSales + otherSales));
  const cashRefunds = Number(shift.cash_refunds_amount || shift.runningMetrics?.cash_refunds || 0);
  const expenses = shift.expenses || [];
  const totalExpenses = Number(shift.drawer_expenses_amount || shift.runningMetrics?.total_expenses || expenses.reduce((s, e) => s + Number(e.amount || 0), 0));
  
  const expectedCash = Number(shift.expected_closing_cash ?? (openingBalance + cashSales - cashRefunds - totalExpenses));
  const actualCash = Number(shift.actual_closing_cash ?? expectedCash);
  const difference = Number(shift.cash_difference ?? (actualCash - expectedCash));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      {/* Container Dialog */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[95vh]">
        {/* Top Control Header (Hidden when printing) */}
        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800 print:hidden">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">End-of-Shift Register Z-Report</h3>
              <p className="text-[11px] text-stone-400">80mm Thermal Receipt Slip Format</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print 80mm Slip</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="p-6 overflow-y-auto bg-stone-100 flex justify-center print:p-0 print:bg-white">
          {/* Printable 80mm Thermal Slip View */}
          <div
            id="thermal-shift-slip"
            className="w-[80mm] max-w-[80mm] bg-white text-stone-900 p-4 shadow-md rounded-lg font-mono text-xs border border-stone-200 print:shadow-none print:border-none print:w-full print:p-1"
            style={{ fontSize: '11px', lineHeight: '1.4' }}
          >
            {/* Header / Store Info */}
            <div className="text-center pb-3 border-b border-dashed border-stone-400 space-y-1">
              <h2 className="font-black text-sm uppercase tracking-wider text-stone-900">{storeName}</h2>
              <p className="text-[10px] text-stone-600 font-sans font-medium">{branchName}</p>
              <p className="text-[9px] text-stone-500 font-sans">{storeAddress}</p>
              <p className="text-[9px] text-stone-500 font-sans">Tel: {storePhone}</p>
              <div className="inline-block mt-1 px-2 py-0.5 bg-stone-900 text-white rounded text-[10px] font-black uppercase tracking-widest">
                SHIFT CLOSING REPORT (Z-REPORT)
              </div>
            </div>

            {/* Shift & Cashier Meta */}
            <div className="py-2.5 border-b border-dashed border-stone-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-stone-500">Shift Code:</span>
                <span className="font-bold text-stone-900">{shift.shift_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Cashier:</span>
                <span className="font-bold text-stone-900">{shift.cashier_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Branch:</span>
                <span className="font-bold text-stone-900">{shift.branch_code || 'BR-01'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Opened At:</span>
                <span className="font-medium text-stone-800">
                  {new Date(shift.opened_at).toLocaleDateString()} {new Date(shift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Closed At:</span>
                <span className="font-medium text-stone-800">
                  {shift.closed_at
                    ? `${new Date(shift.closed_at).toLocaleDateString()} ${new Date(shift.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Active / Current'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Sales Invoices:</span>
                <span className="font-bold text-stone-900">{shift.sales_count || shift.runningMetrics?.sales_count || 0} bills</span>
              </div>
            </div>

            {/* Financial Reconciliation Breakdown */}
            <div className="py-3 border-b border-dashed border-stone-400 space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-stone-500 tracking-wider pb-0.5">
                CASH REGISTER BREAKDOWN
              </div>

              <div className="flex justify-between font-medium">
                <span>Opening Cash Float:</span>
                <span>{currency} {openingBalance.toLocaleString()}</span>
              </div>

              <div className="flex justify-between font-bold text-emerald-800">
                <span>(+) Cash Sales Collected:</span>
                <span>{currency} {cashSales.toLocaleString()}</span>
              </div>

              {cashRefunds > 0 && (
                <div className="flex justify-between font-medium text-rose-700">
                  <span>(-) Cash Customer Refunds:</span>
                  <span>-{currency} {cashRefunds.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between font-medium text-amber-900">
                <span>(-) Petty Drawer Expenses:</span>
                <span>-{currency} {totalExpenses.toLocaleString()}</span>
              </div>

              {/* Drawer Petty Expenses Itemized List */}
              {expenses.length > 0 && (
                <div className="pl-2 pr-1 py-1 bg-stone-50 rounded border border-stone-200 text-[9px] space-y-1 my-1">
                  <span className="block font-bold text-stone-600 uppercase text-[8px]">
                    Petty Deductions Detail:
                  </span>
                  {expenses.map((e, idx) => (
                    <div key={idx} className="flex justify-between text-stone-700">
                      <span className="truncate max-w-[130px]">• {e.category} ({e.note})</span>
                      <span className="font-semibold">{currency} {Number(e.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-1.5 border-t border-stone-300 flex justify-between font-black text-stone-900 text-xs">
                <span>EXPECTED DRAWER CASH:</span>
                <span>{currency} {expectedCash.toLocaleString()}</span>
              </div>
            </div>

            {/* Physical Cash Count & Discrepancy */}
            <div className="py-3 border-b border-dashed border-stone-400 space-y-1.5">
              <div className="flex justify-between text-xs font-black text-stone-900">
                <span>PHYSICAL CASH COUNT:</span>
                <span>{currency} {actualCash.toLocaleString()}</span>
              </div>

              <div
                className={`p-2 rounded flex items-center justify-between text-xs font-black ${
                  difference === 0
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : difference > 0
                    ? 'bg-blue-50 text-blue-800 border border-blue-300'
                    : 'bg-rose-50 text-rose-800 border border-rose-300'
                }`}
              >
                <span>CASH DISCREPANCY:</span>
                <span>
                  {difference === 0
                    ? '0.00 (EXACT BALANCED)'
                    : difference > 0
                    ? `+${currency} ${difference.toLocaleString()} (SURPLUS)`
                    : `-${currency} ${Math.abs(difference).toLocaleString()} (SHORTAGE)`}
                </span>
              </div>

              {shift.closing_notes && (
                <div className="text-[10px] text-stone-600 italic pt-1">
                  <span className="font-bold">Closing Notes:</span> {shift.closing_notes}
                </div>
              )}
            </div>

            {/* Other Non-Cash Sales Summary */}
            <div className="py-2.5 border-b border-dashed border-stone-400 space-y-1 text-[10px]">
              <div className="text-[9px] uppercase font-bold text-stone-500 tracking-wider">
                OTHER TERMINAL TURNOVER
              </div>
              <div className="flex justify-between text-stone-700">
                <span>Card / Bank / Digital:</span>
                <span>{currency} {otherSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-stone-700">
                <span>Total Shift Turnover:</span>
                <span className="font-bold text-stone-900">{currency} {totalSales.toLocaleString()}</span>
              </div>
            </div>

            {/* Signatures & Verification */}
            <div className="pt-6 pb-2 space-y-6 text-[10px]">
              <div className="flex justify-between text-center pt-4">
                <div className="w-5/12 border-t border-stone-400 pt-1">
                  <span className="block font-bold">Cashier Signature</span>
                  <span className="text-[9px] text-stone-500">{shift.cashier_name}</span>
                </div>
                <div className="w-5/12 border-t border-stone-400 pt-1">
                  <span className="block font-bold">Manager Verification</span>
                  <span className="text-[9px] text-stone-500">Sign & Stamp</span>
                </div>
              </div>

              <div className="text-center text-[8px] text-stone-400 space-y-0.5">
                <p>Generated via POS Terminal Shift Register System</p>
                <p>{new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end space-x-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold transition-colors"
          >
            Close Window
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>Print Slip (Ctrl+P)</span>
          </button>
        </div>
      </div>

      {/* Scoped Thermal Print CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-shift-slip, #thermal-shift-slip * {
            visibility: visible;
          }
          #thermal-shift-slip {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm !important;
            max-width: 80mm !important;
            padding: 2mm !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
};
