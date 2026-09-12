import React, { useState, useEffect } from 'react';
import {
  Truck,
  Search,
  Plus,
  ArrowUpRight,
  FileText,
  DollarSign,
  AlertCircle,
  Phone,
  Mail,
  Building,
  CheckCircle2,
  X,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Supplier } from '../types';

export const SuppliersView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hasPayableOnly, setHasPayableOnly] = useState(false);

  // New Supplier Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    opening_balance: '',
  });

  // Pay Supplier Modal
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Ledger Modal
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      let url = `/api/suppliers?search=${encodeURIComponent(search)}`;
      if (hasPayableOnly) url += '&has_payable=true';
      const res = await apiRequest<Supplier[]>(url);
      if (res.success && res.data) {
        setSuppliers(res.data);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [hasPayableOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSuppliers();
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name.trim()) return;

    try {
      const res = await apiRequest<{ success: boolean; data: Supplier }>('/api/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          name: newSupplier.name.trim(),
          company: newSupplier.company.trim(),
          phone: newSupplier.phone.trim(),
          email: newSupplier.email.trim(),
          address: newSupplier.address.trim(),
          opening_balance: Number(newSupplier.opening_balance) || 0,
        }),
      });

      if (res.success) {
        setShowAddModal(false);
        setNewSupplier({
          name: '',
          company: '',
          phone: '',
          email: '',
          address: '',
          opening_balance: '',
        });
        fetchSuppliers();
      }
    } catch (err) {
      console.error('Error adding supplier:', err);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplier || !paymentAmount) return;

    setIsProcessingPayment(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/api/suppliers/${paySupplier.id}/payment`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: Number(paymentAmount),
            payment_method: paymentMethod,
            reference_no: paymentRef,
            notes: paymentNotes,
          }),
        }
      );

      if (res.success) {
        setPaySupplier(null);
        setPaymentAmount('');
        setPaymentNotes('');
        setPaymentRef('');
        fetchSuppliers();
      }
    } catch (err) {
      console.error('Error recording supplier payment:', err);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const openLedger = async (supplier: Supplier) => {
    setLedgerSupplier(supplier);
    setIsLoadingLedger(true);
    try {
      const res = await apiRequest<{ ledger: any[] }>(`/api/suppliers/${supplier.id}/ledger`);

      if (res.success && res.data) {
        setLedgerData(res.data.ledger);
      }
    } catch (err) {
      console.error('Error fetching supplier ledger:', err);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  const totalPayable = suppliers.reduce((sum, s) => sum + (s.payable_balance || 0), 0);
  const suppliersWithPayableCount = suppliers.filter((s) => s.payable_balance > 0).length;

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-stone-900 tracking-tight">
            Suppliers & Vendor Accounts
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Manage factories, mills, distributors, payable balances, and supplier ledgers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Supplier</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Vendors</span>
            <Truck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900">{suppliers.length}</div>
          <span className="text-[11px] text-stone-500">Paints, cement, sanitary & pipes distributors</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Vendors to Pay</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-700">{suppliersWithPayableCount}</div>
          <span className="text-[11px] text-stone-500">With outstanding payable balance</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Accounts Payable</span>
            <DollarSign className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-700">
            Rs. {totalPayable.toLocaleString()}
          </div>
          <span className="text-[11px] text-stone-500">Total liability owed to suppliers</span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search vendor by name, factory, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
          />
        </form>

        <label className="flex items-center space-x-2 text-xs font-semibold text-stone-700 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={hasPayableOnly}
            onChange={(e) => setHasPayableOnly(e.target.checked)}
            className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
          />
          <span>Show Payables Only ({suppliersWithPayableCount})</span>
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-600 font-bold uppercase border-b border-stone-200 text-[10px] tracking-wider">
                <th className="py-3 px-4">Vendor / Company</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Phone & Email</th>
                <th className="py-3 px-4">Address</th>
                <th className="py-3 px-4 text-right">Payable Balance</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    <Truck className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    No suppliers found matching your criteria.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-stone-900">{s.company || s.name}</div>
                      <span className="text-[10px] text-stone-500">ID #{s.id}</span>
                    </td>

                    <td className="py-3 px-4 font-medium text-stone-800">{s.name}</td>

                    <td className="py-3 px-4 text-stone-600">
                      {s.phone ? (
                        <div className="flex items-center space-x-1 font-mono">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{s.phone}</span>
                        </div>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-stone-600 max-w-[200px] truncate">
                      {s.address || '-'}
                    </td>

                    <td className="py-3 px-4 text-right font-black">
                      {s.payable_balance > 0 ? (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Rs. {s.payable_balance.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-emerald-700">Rs. 0 (All Clear)</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPaySupplier(s);
                            setPaymentAmount(s.payable_balance > 0 ? s.payable_balance.toString() : '');
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10px] transition-colors shadow-xs"
                        >
                          Pay Vendor
                        </button>

                        <button
                          type="button"
                          onClick={() => openLedger(s)}
                          className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-lg text-[10px] transition-colors"
                        >
                          Ledger
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: PAY VENDOR ================= */}
      {paySupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">Record Payment to Vendor</h3>
                <p className="text-xs text-stone-500 mt-0.5">{paySupplier.company || paySupplier.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setPaySupplier(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-900 flex justify-between">
              <span>Total Payable to Vendor:</span>
              <span className="font-black text-rose-700">
                Rs. {paySupplier.payable_balance?.toLocaleString()}
              </span>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Payment Amount (Rs.) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-900 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                >
                  <option value="Cash">Cash Handover</option>
                  <option value="Bank Transfer">Bank Transfer (HBL / Meezan / MCB)</option>
                  <option value="Cheque">Bank Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Cheque / Transfer Ref No.</label>
                <input
                  type="text"
                  placeholder="e.g. CHQ-99081 or Trx ID"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Notes / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Payment for Paint Supply Bill"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setPaySupplier(null)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  {isProcessingPayment ? 'Saving...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD SUPPLIER ================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Register New Supplier / Vendor</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Company / Factory Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Berger Paints Pakistan Ltd"
                  value={newSupplier.company}
                  onChange={(e) => setNewSupplier({ ...newSupplier, company: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Contact Person Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Mehmood (Area Manager)"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="042-3589012"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Opening Payable (Rs.)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newSupplier.opening_balance}
                    onChange={(e) => setNewSupplier({ ...newSupplier, opening_balance: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Factory / Warehouse Address</label>
                <input
                  type="text"
                  placeholder="Industrial Area, Multan Road, Lahore"
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: SUPPLIER LEDGER ================= */}
      {ledgerSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-stone-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm">Supplier Ledger & Stock Bill History</h3>
                <p className="text-xs text-stone-300">{ledgerSupplier.company || ledgerSupplier.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setLedgerSupplier(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center text-xs shrink-0">
              <div>
                <span className="text-stone-500 block">Current Payable Liability:</span>
                <span className="font-black text-rose-700 text-sm">
                  Rs. {ledgerSupplier.payable_balance?.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingLedger ? (
                <div className="py-12 text-center text-stone-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
                  Loading supplier ledger...
                </div>
              ) : ledgerData.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs">
                  No purchase bills or payments on record yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-300 text-[10px] font-bold uppercase text-stone-600">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Reference</th>
                      <th className="pb-2 text-right">Credit (Bill)</th>
                      <th className="pb-2 text-right">Debit (Paid)</th>
                      <th className="pb-2 text-right">Payable Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {ledgerData.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-stone-50">
                        <td className="py-2 text-stone-600 whitespace-nowrap">
                          {new Date(entry.date).toLocaleDateString('en-PK')}
                        </td>
                        <td className="py-2">
                          <span className="font-mono font-semibold text-stone-800">{entry.reference}</span>
                          <span className="block text-[10px] text-stone-500">
                            {entry.type === 'PURCHASE' ? 'Stock Inward Bill' : `Payment (${entry.payment_method || 'Cash'})`}
                          </span>
                        </td>
                        <td className="py-2 text-right font-medium text-stone-900">
                          {entry.credit > 0 ? `Rs. ${entry.credit.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2 text-right font-semibold text-emerald-700">
                          {entry.debit > 0 ? `Rs. ${entry.debit.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2 text-right font-black text-stone-900">
                          Rs. {entry.running_balance.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
