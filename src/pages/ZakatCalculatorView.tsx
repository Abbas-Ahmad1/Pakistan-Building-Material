import React, { useState, useEffect } from 'react';
import {
  Moon,
  Coins,
  Calculator,
  Save,
  Printer,
  History,
  Info,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { apiRequest } from '../services/api';

export const ZakatCalculatorView: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [fiscalYear, setFiscalYear] = useState('1447 AH / 2026');
  const [cashBalance, setCashBalance] = useState(25000);
  const [bankBalance, setBankBalance] = useState(150000);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [receivablesValue, setReceivablesValue] = useState(0);
  const [liabilitiesValue, setLiabilitiesValue] = useState(0);
  const [notes, setNotes] = useState('');

  // Shariah Reference Constants
  const [nisabSilver, setNisabSilver] = useState(165000);
  const [zakatRate, setZakatRate] = useState(2.5);

  // Saved records
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  const fetchBaseline = async () => {
    setIsLoading(true);
    try {
      const [baseRes, histRes] = await Promise.all([
        apiRequest<any>('/api/zakat/calculate'),
        apiRequest<any[]>('/api/zakat/records'),
      ]);

      if (baseRes.success && baseRes.data) {
        const d = baseRes.data;
        setInventoryValue(d.inventory_value || 0);
        setReceivablesValue(d.receivables_value || 0);
        setLiabilitiesValue(d.liabilities_value || 0);
        if (d.suggested_cash) setCashBalance(d.suggested_cash);
        if (d.suggested_bank) setBankBalance(d.suggested_bank);
        if (d.nisab_silver_pkr) setNisabSilver(d.nisab_silver_pkr);
        if (d.zakat_rate) setZakatRate(d.zakat_rate);
      }

      if (histRes.success && histRes.data) {
        setHistoryRecords(histRes.data);
      }
    } catch (err) {
      console.error('Error fetching Zakat baseline:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseline();
  }, []);

  // Net calculations
  const totalAssets =
    Number(cashBalance || 0) +
    Number(bankBalance || 0) +
    Number(inventoryValue || 0) +
    Number(receivablesValue || 0);

  const netZakatable = Math.max(0, totalAssets - Number(liabilitiesValue || 0));
  const isNisabReached = netZakatable >= nisabSilver;
  const calculatedZakat = isNisabReached ? (netZakatable * (zakatRate / 100)) : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await apiRequest('/api/zakat/save', {
        method: 'POST',
        body: JSON.stringify({
          fiscal_year: fiscalYear,
          cash_balance: cashBalance,
          bank_balance: bankBalance,
          inventory_value: inventoryValue,
          receivables_value: receivablesValue,
          liabilities_value: liabilitiesValue,
          net_zakatable_amount: netZakatable,
          zakat_rate: zakatRate,
          calculated_zakat: calculatedZakat,
          notes: notes,
        }),
      });

      if (res.success) {
        setSaveSuccess(true);
        const histRes = await apiRequest<any[]>('/api/zakat/records');
        if (histRes.success && histRes.data) {
          setHistoryRecords(histRes.data);
        }
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err) {
      console.error('Error saving Zakat record:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHistory = async (id: number) => {
    if (!window.confirm('Delete this historical Zakat record?')) return;
    try {
      const res = await apiRequest(`/api/zakat/records/${id}`, { method: 'DELETE' });
      if (res.success) {
        setHistoryRecords((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error('Error deleting record:', err);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-stone-900 tracking-tight flex items-center space-x-2">
            <Moon className="w-6 h-6 text-emerald-700" />
            <span>Islamic Business Zakat Calculator (Urud al-Tijarah)</span>
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Compliant Fiqh calculation on commercial merchandise, warehouse inventory, cash liquidity & market receivables.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Assessment</span>
          </button>
        </div>
      </div>

      {/* Shariah Guidance Banner */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start space-x-3">
        <BookOpen className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-emerald-950">
            Shariah Principles for Hardware & Sanitary Store Zakat:
          </div>
          <p className="text-emerald-800 leading-relaxed">
            1. <strong>Commercial Stock (Maal-e-Tijarat)</strong>: All pipes, tiles, sanitary fittings, and paints are evaluated at wholesale purchase cost (not retail counter price).
            <br />
            2. <strong>Market Receivables (Udhaar)</strong>: Include credit given to trusted contractors who will pay back.
            <br />
            3. <strong>Immediate Payables</strong>: Factory debts due for raw stock purchases are deducted from the gross assets.
            <br />
            4. <strong>Nisab Threshold</strong>: 52.5 Tolas (612.36g) of Silver (~Rs. {nisabSilver.toLocaleString()}). If net zakatable wealth exceeds Nisab, 2.5% is obligatory.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-stone-400 bg-white rounded-xl border border-stone-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
          Loading store assets, warehouse valuation, and receivables...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Interactive Calculator Form (2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border border-stone-200 shadow-xs space-y-5">
              <div className="flex justify-between items-center pb-3 border-b border-stone-200">
                <h2 className="text-sm font-black text-stone-900 flex items-center space-x-2">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  <span>Annual Assessment Assets & Liabilities</span>
                </h2>
                <div className="flex items-center space-x-2">
                  <label className="text-xs font-bold text-stone-600">Fiscal / Hijri Year:</label>
                  <input
                    type="text"
                    required
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(e.target.value)}
                    className="px-2 py-1 bg-stone-50 border border-stone-300 rounded text-xs font-bold text-stone-800 w-36"
                  />
                </div>
              </div>

              {/* Section 1: Business Assets */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-stone-700 uppercase tracking-wider">
                  1. Zakatable Business Assets (+)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Stock Value */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Warehouse Stock Value (Purchase Cost) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={inventoryValue}
                      onChange={(e) => setInventoryValue(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-stone-400">
                      Auto-loaded from live store catalog at purchase price
                    </span>
                  </div>

                  {/* Market Receivables */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Customer Receivables (Good Udhaar) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={receivablesValue}
                      onChange={(e) => setReceivablesValue(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-stone-400">
                      Contractor balances expected to be recovered
                    </span>
                  </div>

                  {/* Cash in Hand */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Cash in Hand (Counter Drawer / Safe) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={cashBalance}
                      onChange={(e) => setCashBalance(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-stone-400">
                      Physical currency in store on Zakat anniversary date
                    </span>
                  </div>

                  {/* Bank Accounts */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Business Bank Balances *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={bankBalance}
                      onChange={(e) => setBankBalance(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-stone-400">
                      Combined bank balances (Meezan, HBL, etc.)
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-stone-100 rounded-lg flex justify-between items-center text-xs font-bold text-stone-800">
                  <span>Gross Zakatable Pool (Assets):</span>
                  <span className="text-emerald-800 font-black text-sm">
                    Rs. {Number(totalAssets).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Section 2: Deductible Liabilities */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-black text-stone-700 uppercase tracking-wider">
                  2. Deductible Current Liabilities (-)
                </h3>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Supplier & Factory Payables (Immediate Debts) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={liabilitiesValue}
                    onChange={(e) => setLiabilitiesValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-rose-700 focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-stone-400">
                    Owed to cement mills, pipe factories & sanitary distributors
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Assessment Notes & Shariah Auditor / Mufti Name
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Calculated on 1st of Ramadan by Imtiaz Ali; reviewed by local Mufti."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                {saveSuccess ? (
                  <span className="text-xs font-bold text-emerald-700 flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Assessment saved to permanent records!</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-stone-400">
                    Saves assessment with complete audit trail
                  </span>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Zakat Record'}</span>
                </button>
              </div>
            </form>

            {/* Saved History Table */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <History className="w-4 h-4 text-stone-500" />
                  <h3 className="font-bold text-xs text-stone-800 uppercase tracking-wider">
                    Previous Saved Zakat Assessments ({historyRecords.length})
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 text-stone-600 font-bold uppercase border-b border-stone-200 text-[10px]">
                      <th className="py-2.5 px-4">Fiscal Year</th>
                      <th className="py-2.5 px-4 text-right">Net Wealth Pool</th>
                      <th className="py-2.5 px-4 text-center">Rate</th>
                      <th className="py-2.5 px-4 text-right">Zakat Due</th>
                      <th className="py-2.5 px-4">Notes</th>
                      <th className="py-2.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {historyRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-stone-400">
                          No previous Zakat records saved yet.
                        </td>
                      </tr>
                    ) : (
                      historyRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-stone-50">
                          <td className="py-2.5 px-4 font-bold text-stone-900">{rec.fiscal_year}</td>
                          <td className="py-2.5 px-4 text-right font-medium text-stone-800">
                            Rs. {Number(rec.net_zakatable_amount).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-stone-500">
                            {rec.zakat_rate}%
                          </td>
                          <td className="py-2.5 px-4 text-right font-black text-emerald-700">
                            Rs. {Number(rec.calculated_zakat).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-stone-500 text-[11px] truncate max-w-xs">
                            {rec.notes || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteHistory(rec.id)}
                              className="p-1 text-stone-400 hover:text-rose-600 rounded transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Real-time Assessment Summary Card (Right Column) */}
          <div className="space-y-6">
            <div className="bg-emerald-900 text-white p-6 rounded-xl shadow-lg border border-emerald-950 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-emerald-800">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Zakat Summary Result
                </span>
                <span className="text-xs font-mono text-emerald-200">{fiscalYear}</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between text-emerald-200">
                  <span>Gross Business Assets:</span>
                  <span className="font-bold text-white">Rs. {Number(totalAssets).toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-emerald-200">
                  <span>Less: Factory Liabilities:</span>
                  <span className="font-bold text-rose-300">
                    - Rs. {Number(liabilitiesValue).toLocaleString()}
                  </span>
                </div>

                <div className="pt-2 border-t border-emerald-800 flex justify-between font-bold text-sm">
                  <span className="text-emerald-100">Net Zakatable Pool:</span>
                  <span className="text-white">Rs. {Number(netZakatable).toLocaleString()}</span>
                </div>
              </div>

              {/* Nisab Comparison */}
              <div className="p-3 bg-emerald-950/60 rounded-lg text-xs space-y-1 border border-emerald-800/80">
                <div className="flex justify-between items-center">
                  <span className="text-stone-300 font-medium">Silver Nisab Standard:</span>
                  <span className="font-bold text-stone-200">
                    Rs. {Number(nisabSilver).toLocaleString()}
                  </span>
                </div>
                <div className="text-[11px] flex items-center space-x-1.5 pt-1">
                  {isNisabReached ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-emerald-300 font-bold">
                        Nisab Exceeded — Zakat is Fard (Obligatory)
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-amber-300 font-bold">
                        Net wealth is below the Nisab threshold.
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Final Amount Due */}
              <div className="pt-2">
                <span className="block text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1">
                  Total Zakat Payable (2.5% Rate)
                </span>
                <div className="text-3xl font-black text-amber-300">
                  Rs. {Number(Math.round(calculatedZakat)).toLocaleString()}
                </div>
                <span className="text-[11px] text-emerald-300 mt-1 block">
                  Disburse to eligible Asnaf-e-Zakat (the poor, destitute & needy).
                </span>
              </div>
            </div>

            {/* Distribution Checklist */}
            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-3 text-xs">
              <h4 className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">
                Recommended Distribution Guidelines:
              </h4>
              <ul className="space-y-2 text-stone-600">
                <li className="flex items-start space-x-2">
                  <span className="font-bold text-emerald-600">•</span>
                  <span>Give preference to deserving relatives or neighbors who do not possess Nisab.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="font-bold text-emerald-600">•</span>
                  <span>Daily labor workers (Mazdoor) & shop helpers from low-income families.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="font-bold text-emerald-600">•</span>
                  <span>Verified Islamic madrasas and charitable hospitals (Mustahqeen).</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
