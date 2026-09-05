import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Calendar,
  Eye,
  Printer,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Banknote,
  DollarSign,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Sale } from '../types';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { useAuth } from '../context/AuthContext';

export const SalesRegister: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<{
    total_invoices: number;
    total_revenue: number;
    total_collected: number;
    total_due: number;
  }>({
    total_invoices: 0,
    total_revenue: 0,
    total_collected: 0,
    total_due: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<string>('ALL');
  const [paymentMethod, setPaymentMethod] = useState<string>('ALL');

  // Selected sale for receipt preview
  const [selectedSaleForModal, setSelectedSaleForModal] = useState<Sale | null>(null);
  const [isLoadingInvoiceDetails, setIsLoadingInvoiceDetails] = useState(false);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      let url = `/api/sales?search=${encodeURIComponent(search)}`;
      if (paymentStatus !== 'ALL') url += `&payment_status=${paymentStatus}`;
      if (paymentMethod !== 'ALL') url += `&payment_method=${encodeURIComponent(paymentMethod)}`;

      const res = await apiRequest<Sale[]>(url);

      if (res.success && res.data) {
        setSales(res.data);
        if (res.summary) setSummary(res.summary);
      }
    } catch (err) {
      console.error('Error fetching sales register:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [paymentStatus, paymentMethod]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSales();
  };

  const openInvoiceReceipt = async (saleId: number) => {
    setIsLoadingInvoiceDetails(true);
    try {
      const res = await apiRequest<Sale>(`/api/sales/${saleId}`);
      if (res.success && res.data) {
        setSelectedSaleForModal(res.data);
      }
    } catch (err) {
      console.error('Error loading full invoice details:', err);
    } finally {
      setIsLoadingInvoiceDetails(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-stone-900 tracking-tight">
            Sales & Invoices Register
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Complete transaction history, bill reprints, and customer settlement ledger.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSales}
          className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-100 shadow-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Invoices</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Invoices</span>
            <Receipt className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900">
            {summary.total_invoices}
          </div>
          <span className="text-[11px] text-stone-500">Processed through POS</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Sales Revenue</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900">
            Rs. {summary.total_revenue?.toLocaleString()}
          </div>
          <span className="text-[11px] text-stone-500">Gross billings amount</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Cash Collected</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">
            Rs. {summary.total_collected?.toLocaleString()}
          </div>
          <span className="text-[11px] text-stone-500">Paid upfront or settled</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Outstanding Due</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-700">
            Rs. {summary.total_due?.toLocaleString()}
          </div>
          <span className="text-[11px] text-stone-500">Pending customer credit (Khata)</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search invoice number, customer name, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
          />
        </form>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Fully Paid</option>
            <option value="PARTIAL">Partially Paid</option>
            <option value="DUE">Unpaid / Due</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-700 focus:outline-none"
          >
            <option value="ALL">All Payment Types</option>
            <option value="Cash">Cash</option>
            <option value="Credit">Khata / Credit</option>
            <option value="Bank Transfer">Bank / JazzCash</option>
            <option value="Card">Card</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-600 font-bold uppercase border-b border-stone-200 text-[10px] tracking-wider">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Bill Total</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                {isAdmin && <th className="py-3 px-4 text-right">Profit</th>}
                <th className="py-3 px-4 text-center">Payment Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="py-12 text-center text-stone-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
                    Loading invoices...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="py-12 text-center text-stone-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    No sales invoices found matching your criteria.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">
                      {sale.invoice_number}
                    </td>

                    <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                      {new Date(sale.sale_date).toLocaleDateString('en-PK', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-stone-900">{sale.customer_name}</div>
                      {sale.customer_phone && (
                        <div className="text-[10px] text-stone-500">{sale.customer_phone}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-medium text-stone-600">
                      {sale.items_count || 1}
                    </td>

                    <td className="py-3 px-4 text-right font-black text-stone-900">
                      Rs. {sale.grand_total.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                      Rs. {sale.paid_amount.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-semibold">
                      {sale.due_amount > 0 ? (
                        <span className="text-rose-700 font-bold">
                          Rs. {sale.due_amount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>

                    {isAdmin && (
                      <td className="py-3 px-4 text-right font-bold text-amber-700">
                        Rs. {(sale.gross_profit || 0).toLocaleString()}
                      </td>
                    )}

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sale.payment_status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sale.payment_status === 'PARTIAL'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {sale.payment_status === 'PAID' && <CheckCircle2 className="w-2.5 h-2.5 mr-1" />}
                        {sale.payment_status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => openInvoiceReceipt(sale.id)}
                        className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 rounded-lg transition-colors inline-flex items-center space-x-1"
                        title="View & Print Bill"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">Print</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Print & Preview Modal */}
      {selectedSaleForModal && (
        <ReceiptModal
          sale={selectedSaleForModal}
          onClose={() => setSelectedSaleForModal(null)}
        />
      )}
    </div>
  );
};
