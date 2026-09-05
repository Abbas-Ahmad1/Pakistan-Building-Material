import React, { useState, useEffect } from 'react';
import {
  FileText,
  Boxes,
  Users,
  Truck,
  CreditCard,
  Printer,
  Download,
  DollarSign,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Customer, Supplier } from '../types';

export const BusinessReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'summary' | 'inventory' | 'receivables' | 'payables'>('summary');
  const [isLoading, setIsLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [customersWithDues, setCustomersWithDues] = useState<Customer[]>([]);
  const [suppliersWithDues, setSuppliersWithDues] = useState<Supplier[]>([]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const [sumRes, custRes, supRes] = await Promise.all([
        apiRequest<any>('/api/reports/summary'),
        apiRequest<Customer[]>('/api/customers?has_dues=true'),
        apiRequest<Supplier[]>('/api/suppliers?has_payable=true'),
      ]);

      if (sumRes.success && sumRes.data) {
        setSummaryData(sumRes.data);
      }
      if (custRes.success && custRes.data) {
        setCustomersWithDues(custRes.data);
      }
      if (supRes.success && supRes.data) {
        setSuppliersWithDues(supRes.data);
      }
    } catch (err) {
      console.error('Error fetching business reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const exportCSV = (filename: string, rows: (string | number)[][], headers: string[]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportReceivables = () => {
    const headers = ['Customer Name', 'Phone', 'Address', 'Credit Limit', 'Outstanding Due (Rs.)'];
    const rows = customersWithDues.map((c) => [
      c.name,
      c.phone || '',
      c.address || '',
      c.credit_limit || 0,
      c.outstanding_balance || 0,
    ]);
    exportCSV('Customer_Receivables_Udhaar_Ledger', rows, headers);
  };

  const handleExportPayables = () => {
    const headers = ['Supplier Name', 'Company', 'Phone', 'Payable Balance (Rs.)'];
    const rows = suppliersWithDues.map((s) => [
      s.name,
      s.company,
      s.phone,
      s.payable_balance || 0,
    ]);
    exportCSV('Supplier_Payables_Factory_Dues', rows, headers);
  };

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-stone-900 tracking-tight flex items-center space-x-2">
            <span>Business Reports & Financial Statements</span>
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Audit-grade reporting: Inventory capital valuation, market credit recovery, factory payables & payment channels.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 bg-white rounded-t-xl px-4 pt-3 space-x-4 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`pb-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'summary'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Executive Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`pb-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'inventory'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Stock Valuation</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receivables')}
          className={`pb-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'receivables'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Market Receivables (Udhaar)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payables')}
          className={`pb-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'payables'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Supplier Payables</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-stone-400 bg-white rounded-b-xl border border-t-0 border-stone-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
          Generating reports...
        </div>
      ) : summaryData ? (
        <div className="space-y-6">
          {/* TAB 1: EXECUTIVE OVERVIEW */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Top 4 Stat Panels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Total Inventory Cost Capital
                  </span>
                  <div className="mt-2 text-2xl font-black text-stone-900">
                    Rs. {Number(summaryData.inventory_valuation.total_cost_value).toLocaleString()}
                  </div>
                  <span className="text-[11px] text-stone-500">
                    {summaryData.inventory_valuation.total_skus} Active SKUs in Warehouse
                  </span>
                </div>

                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Total Retail Valuation
                  </span>
                  <div className="mt-2 text-2xl font-black text-blue-700">
                    Rs. {Number(summaryData.inventory_valuation.total_retail_value).toLocaleString()}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-bold">
                    +Rs. {Number(summaryData.inventory_valuation.potential_margin).toLocaleString()} Gross Potential
                  </span>
                </div>

                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Contractor Receivables
                  </span>
                  <div className="mt-2 text-2xl font-black text-amber-700">
                    Rs. {Number(summaryData.receivables.total_receivables).toLocaleString()}
                  </div>
                  <span className="text-[11px] text-stone-500">
                    {summaryData.receivables.customers_with_dues} contractors with outstanding khata
                  </span>
                </div>

                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Supplier Factory Payables
                  </span>
                  <div className="mt-2 text-2xl font-black text-rose-700">
                    Rs. {Number(summaryData.payables.total_payables).toLocaleString()}
                  </div>
                  <span className="text-[11px] text-stone-500">
                    {summaryData.payables.suppliers_with_dues} factories to be paid
                  </span>
                </div>
              </div>

              {/* Payment Channels & Cashier Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment Channels */}
                <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
                  <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-4 flex items-center space-x-2">
                    <CreditCard className="w-4 h-4 text-stone-500" />
                    <span>Sales Breakdown by Payment Method</span>
                  </h3>
                  <div className="space-y-3">
                    {summaryData.sales_by_method.map((m: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-stone-50 rounded-lg text-xs">
                        <div className="font-bold text-stone-800">{m.payment_method}</div>
                        <div className="text-right">
                          <span className="font-black text-stone-900 block">
                            Rs. {Number(m.total_amount).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-stone-500">{m.transaction_count} sales</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cashier Volumes */}
                <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
                  <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-4 flex items-center space-x-2">
                    <Users className="w-4 h-4 text-stone-500" />
                    <span>Cashier Billing Volume</span>
                  </h3>
                  <div className="space-y-3">
                    {summaryData.cashier_performance.map((c: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-stone-50 rounded-lg text-xs">
                        <div>
                          <div className="font-bold text-stone-800">{c.cashier_name}</div>
                          <span className="text-[10px] text-stone-500">{c.orders_completed} orders completed</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-700 block">
                            Rs. {Number(c.total_sales_volume).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY VALUATION */}
          {activeTab === 'inventory' && (
            <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-black text-stone-900">Inventory Capital & Potential Margin</h3>
                  <p className="text-xs text-stone-500">
                    Valuation based on actual factory purchase cost vs retail counter prices.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg">
                  <span className="text-[11px] uppercase font-bold text-stone-500">Tied-Up Cost Capital</span>
                  <div className="text-xl font-black text-stone-900 mt-1">
                    Rs. {Number(summaryData.inventory_valuation.total_cost_value).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-stone-400">Actual money invested in stock</span>
                </div>

                <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg">
                  <span className="text-[11px] uppercase font-bold text-stone-500">Total Retail Value</span>
                  <div className="text-xl font-black text-blue-700 mt-1">
                    Rs. {Number(summaryData.inventory_valuation.total_retail_value).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-stone-400">Expected counter sales realization</span>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-[11px] uppercase font-bold text-emerald-700">Projected Margin</span>
                  <div className="text-xl font-black text-emerald-800 mt-1">
                    Rs. {Number(summaryData.inventory_valuation.potential_margin).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-600">Unrealized retail gross profit</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RECEIVABLES (UDHAAR) */}
          {activeTab === 'receivables' && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xs text-stone-800">
                    Contractors with Outstanding Udhaar ({customersWithDues.length})
                  </h3>
                  <span className="text-[11px] text-stone-500">
                    Total Market Dues: Rs. {Number(summaryData.receivables.total_receivables).toLocaleString()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleExportReceivables}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded text-xs font-bold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 text-stone-600 font-bold uppercase border-b border-stone-200 text-[10px]">
                      <th className="py-2.5 px-4">Contractor / Customer</th>
                      <th className="py-2.5 px-4">Phone</th>
                      <th className="py-2.5 px-4">Site Address</th>
                      <th className="py-2.5 px-4 text-right">Credit Limit</th>
                      <th className="py-2.5 px-4 text-right">Outstanding Due</th>
                      <th className="py-2.5 px-4 text-center">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {customersWithDues.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-stone-400">
                          All customer accounts are clear. No pending market dues.
                        </td>
                      </tr>
                    ) : (
                      customersWithDues.map((c) => (
                        <tr key={c.id} className="hover:bg-stone-50">
                          <td className="py-2.5 px-4 font-bold text-stone-900">{c.name}</td>
                          <td className="py-2.5 px-4 text-stone-600 font-mono">{c.phone || '-'}</td>
                          <td className="py-2.5 px-4 text-stone-600 truncate max-w-xs">{c.address || '-'}</td>
                          <td className="py-2.5 px-4 text-right font-medium text-stone-600">
                            Rs. {Number(c.credit_limit || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right font-black text-rose-700">
                            Rs. {Number(c.outstanding_balance).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {c.phone && (
                              <a
                                href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                  `Assalam-o-Alaikum ${c.name}, this is a gentle reminder from Pakistan Building Materials & Paint Store regarding your outstanding balance of Rs. ${Number(
                                    c.outstanding_balance
                                  ).toLocaleString()}. Kindly arrange payment at your earliest convenience.`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1 px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-semibold text-[10px]"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WhatsApp Reminder</span>
                              </a>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PAYABLES */}
          {activeTab === 'payables' && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xs text-stone-800">
                    Factories & Suppliers with Payable Balances ({suppliersWithDues.length})
                  </h3>
                  <span className="text-[11px] text-stone-500">
                    Total Payable: Rs. {Number(summaryData.payables.total_payables).toLocaleString()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleExportPayables}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded text-xs font-bold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 text-stone-600 font-bold uppercase border-b border-stone-200 text-[10px]">
                      <th className="py-2.5 px-4">Company / Factory</th>
                      <th className="py-2.5 px-4">Contact Representative</th>
                      <th className="py-2.5 px-4">Phone</th>
                      <th className="py-2.5 px-4 text-right">Total Purchases</th>
                      <th className="py-2.5 px-4 text-right">Amount Paid</th>
                      <th className="py-2.5 px-4 text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {suppliersWithDues.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-stone-400">
                          All factory bills are paid in full.
                        </td>
                      </tr>
                    ) : (
                      suppliersWithDues.map((s) => (
                        <tr key={s.id} className="hover:bg-stone-50">
                          <td className="py-2.5 px-4 font-bold text-stone-900">{s.company}</td>
                          <td className="py-2.5 px-4 text-stone-700">{s.name}</td>
                          <td className="py-2.5 px-4 text-stone-600 font-mono">{s.phone}</td>
                          <td className="py-2.5 px-4 text-right text-stone-600">
                            Rs. {Number(s.total_purchases).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right text-emerald-700 font-medium">
                            Rs. {Number(s.paid_amount).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right font-black text-rose-700">
                            Rs. {Number(s.payable_balance).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
