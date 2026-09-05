import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserPlus,
  ArrowDownLeft,
  FileText,
  DollarSign,
  AlertCircle,
  Phone,
  MapPin,
  CheckCircle2,
  Calendar,
  CreditCard,
  Building2,
  Receipt,
  X,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Customer, CustomerLedgerEntry } from '../types';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hasDuesOnly, setHasDuesOnly] = useState(false);

  // New Customer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    credit_limit: '',
    opening_balance: '',
  });

  // Payment (Vasooli) Modal
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Khata Ledger Modal
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [ledgerData, setLedgerData] = useState<CustomerLedgerEntry[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      let url = `/api/customers?search=${encodeURIComponent(search)}`;
      if (hasDuesOnly) url += `&has_dues=true`;
      const res = await apiRequest<Customer[]>(url);
      if (res.success && res.data) {
        setCustomers(res.data);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [hasDuesOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  // Create Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) return;

    try {
      const res = await apiRequest<{ success: boolean; data: Customer }>('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: newCustomer.name.trim(),
          phone: newCustomer.phone.trim(),
          email: newCustomer.email.trim(),
          address: newCustomer.address.trim(),
          credit_limit: Number(newCustomer.credit_limit) || 0,
          opening_balance: Number(newCustomer.opening_balance) || 0,
        }),
      });

      if (res.success) {
        setShowAddModal(false);
        setNewCustomer({
          name: '',
          phone: '',
          email: '',
          address: '',
          credit_limit: '',
          opening_balance: '',
        });
        fetchCustomers();
      }
    } catch (err) {
      console.error('Error creating customer:', err);
    }
  };

  // Submit Payment / Vasooli
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer || !paymentAmount) return;

    setIsProcessingPayment(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/api/customers/${paymentCustomer.id}/payment`,
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
        setPaymentCustomer(null);
        setPaymentAmount('');
        setPaymentNotes('');
        setPaymentRef('');
        fetchCustomers();
      }
    } catch (err) {
      console.error('Error recording payment:', err);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // View Ledger
  const openLedger = async (customer: Customer) => {
    setLedgerCustomer(customer);
    setIsLoadingLedger(true);
    try {
      const res = await apiRequest<{ ledger: CustomerLedgerEntry[] }>(
        `/api/customers/${customer.id}/ledger`
      );

      if (res.success && res.data) {
        setLedgerData(res.data.ledger);
      }
    } catch (err) {
      console.error('Error fetching ledger:', err);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  // Stats
  const totalMarketDue = customers.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0);
  const customersWithDueCount = customers.filter((c) => c.outstanding_balance > 0).length;

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-stone-900 tracking-tight">
            Customer Directory & Khata (Udhaar) Ledgers
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Contractor accounts, credit limits, outstanding balances, and cash recovery (Vasooli).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Contractor</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Accounts</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900">{customers.length}</div>
          <span className="text-[11px] text-stone-500">Contractors, builders & walk-ins</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Accounts With Dues</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-700">{customersWithDueCount}</div>
          <span className="text-[11px] text-stone-500">Contractors with active credit</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Market Receivables (Khata)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600">
            Rs. {totalMarketDue.toLocaleString()}
          </div>
          <span className="text-[11px] text-stone-500">Uncollected market credit</span>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search customer by name, phone number, or project address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
          />
        </form>

        <label className="flex items-center space-x-2 text-xs font-semibold text-stone-700 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={hasDuesOnly}
            onChange={(e) => setHasDuesOnly(e.target.checked)}
            className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
          />
          <span>Show Dues Only ({customersWithDueCount})</span>
        </label>
      </div>

      {/* Customer List Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-600 font-bold uppercase border-b border-stone-200 text-[10px] tracking-wider">
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Project / Site Address</th>
                <th className="py-3 px-4 text-right">Credit Limit</th>
                <th className="py-3 px-4 text-right">Total Purchases</th>
                <th className="py-3 px-4 text-right">Total Paid</th>
                <th className="py-3 px-4 text-right">Khata Due Balance</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    No customers found matching your criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-stone-900">{c.name}</div>
                      {c.is_walk_in ? (
                        <span className="inline-block px-1.5 py-0.2 bg-stone-100 text-stone-600 rounded text-[9px] font-semibold uppercase">
                          General Counter
                        </span>
                      ) : (
                        <span className="text-[10px] text-stone-500">ID #{c.id}</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-stone-600">
                      {c.phone ? (
                        <div className="flex items-center space-x-1 font-mono">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{c.phone}</span>
                        </div>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-stone-600 max-w-[200px] truncate">
                      {c.address ? (
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="truncate">{c.address}</span>
                        </div>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-medium text-stone-600">
                      {c.credit_limit > 0 ? `Rs. ${c.credit_limit.toLocaleString()}` : 'No Limit'}
                    </td>

                    <td className="py-3 px-4 text-right font-semibold text-stone-900">
                      Rs. {c.total_purchases.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                      Rs. {c.total_paid.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-black">
                      {c.outstanding_balance > 0 ? (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Rs. {c.outstanding_balance.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-emerald-700">Rs. 0 (Clear)</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {!c.is_walk_in && (
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentCustomer(c);
                              setPaymentAmount(c.outstanding_balance > 0 ? c.outstanding_balance.toString() : '');
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition-colors shadow-xs"
                            title="Collect Vasooli"
                          >
                            Receive Cash
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openLedger(c)}
                          className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-lg text-[10px] transition-colors"
                          title="View Statement / Khata"
                        >
                          Statement
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

      {/* ================= MODAL: RECEIVE PAYMENT (VASOOLI) ================= */}
      {paymentCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">Record Khata Recovery (Vasooli)</h3>
                <p className="text-xs text-stone-500 mt-0.5">{paymentCustomer.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentCustomer(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex justify-between">
              <span>Current Outstanding Due:</span>
              <span className="font-black text-rose-700">
                Rs. {paymentCustomer.outstanding_balance?.toLocaleString()}
              </span>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Amount Received (Rs.) *
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
                  <option value="Cash">Cash Counter</option>
                  <option value="Bank Transfer">Bank Transfer (HBL / Meezan)</option>
                  <option value="EasyPaisa/JazzCash">EasyPaisa / JazzCash</option>
                  <option value="Cheque">Bank Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Receipt / Slip Ref No.</label>
                <input
                  type="text"
                  placeholder="e.g. REC-1029 or Bank Ref"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Notes / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Partial settlement for DHA Phase 6 project"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setPaymentCustomer(null)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  {isProcessingPayment ? 'Saving...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD CUSTOMER ================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Add New Contractor / Account</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Full Name / Firm Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Builders & Plumbers"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Credit Limit (Rs.)</label>
                  <input
                    type="number"
                    placeholder="e.g. 200000"
                    value={newCustomer.credit_limit}
                    onChange={(e) => setNewCustomer({ ...newCustomer, credit_limit: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Site / Workshop Address</label>
                <input
                  type="text"
                  placeholder="Project site or office address"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Opening Udhaar Balance (Rs.)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newCustomer.opening_balance}
                  onChange={(e) => setNewCustomer({ ...newCustomer, opening_balance: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
                <span className="text-[10px] text-stone-500">If there is any previous balance from old register</span>
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
                  Save Contractor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CUSTOMER STATEMENT / KHATA LEDGER ================= */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-stone-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm">Customer Statement / Khata Ledger</h3>
                <p className="text-xs text-stone-300">{ledgerCustomer.name} (ID #{ledgerCustomer.id})</p>
              </div>
              <button
                type="button"
                onClick={() => setLedgerCustomer(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center text-xs shrink-0">
              <div>
                <span className="text-stone-500 block">Total Purchases:</span>
                <span className="font-bold text-stone-900">Rs. {ledgerCustomer.total_purchases?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Total Received:</span>
                <span className="font-bold text-emerald-700">Rs. {ledgerCustomer.total_paid?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Current Outstanding Balance:</span>
                <span className="font-black text-rose-700 text-sm">
                  Rs. {ledgerCustomer.outstanding_balance?.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingLedger ? (
                <div className="py-12 text-center text-stone-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
                  Loading customer statement...
                </div>
              ) : ledgerData.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs">
                  No billing or payment entries on record yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-300 text-[10px] font-bold uppercase text-stone-600">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Reference</th>
                      <th className="pb-2 text-right">Debit (Bill)</th>
                      <th className="pb-2 text-right">Credit (Paid)</th>
                      <th className="pb-2 text-right">Running Balance</th>
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
                            {entry.type === 'INVOICE' ? 'Sales Invoice' : `Payment (${entry.payment_method || 'Cash'})`}
                          </span>
                        </td>
                        <td className="py-2 text-right font-medium text-stone-900">
                          {entry.debit > 0 ? `Rs. ${entry.debit.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2 text-right font-semibold text-emerald-700">
                          {entry.credit > 0 ? `Rs. ${entry.credit.toLocaleString()}` : '-'}
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
