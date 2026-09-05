import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  Search,
  Trash2,
  Calendar,
  DollarSign,
  TrendingDown,
  PieChart,
  RefreshCw,
  X,
  AlertCircle,
  Tag,
  CreditCard,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const ExpensesView: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    total_all_time: 0,
    today_expenses: 0,
    this_month_expenses: 0,
    category_breakdown: [],
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Add Expense Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    custom_category: '',
    amount: '',
    payment_method: 'Cash',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      let url = `/api/expenses?search=${encodeURIComponent(search)}`;
      if (selectedCategory !== 'all') url += `&category=${encodeURIComponent(selectedCategory)}`;
      if (selectedMethod !== 'all') url += `&payment_method=${encodeURIComponent(selectedMethod)}`;
      if (dateFrom) url += `&date_from=${dateFrom}`;
      if (dateTo) url += `&date_to=${dateTo}`;

      const res = await apiRequest<any[]>(url);
      if (res.success && res.data) {
        setExpenses(res.data);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiRequest<string[]>('/api/expenses/categories');
      if (res.success && res.data) {
        setCategories(res.data);
        if (res.data.length > 0 && !formData.category) {
          setFormData((prev) => ({ ...prev, category: res.data[0] }));
        }
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, [selectedCategory, selectedMethod, dateFrom, dateTo]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchExpenses();
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const chosenCat =
      formData.category === 'CUSTOM'
        ? formData.custom_category.trim()
        : formData.category;

    if (!formData.title.trim()) {
      setErrorMessage('Please enter expense title.');
      return;
    }

    if (!chosenCat) {
      setErrorMessage('Please choose or enter a category.');
      return;
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      setErrorMessage('Please enter a valid amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title.trim(),
          category: chosenCat,
          amount: Number(formData.amount),
          payment_method: formData.payment_method,
          expense_date: formData.expense_date,
          description: formData.description.trim(),
        }),
      });

      if (res.success) {
        setShowAddModal(false);
        setFormData({
          title: '',
          category: categories[0] || '',
          custom_category: '',
          amount: '',
          payment_method: 'Cash',
          expense_date: new Date().toISOString().split('T')[0],
          description: '',
        });
        fetchExpenses();
        fetchCategories();
      } else {
        setErrorMessage(res.message || 'Failed to record expense.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      const res = await apiRequest(`/api/expenses/${id}`, { method: 'DELETE' });
      if (res.success) {
        fetchExpenses();
      }
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-stone-900 tracking-tight">
            Store Expenses (Dukaan Ke Akhrajat)
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Log shop electricity bills, monthly rent, staff wages, freight transport, and refreshments.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense Voucher</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Today's Expenses</span>
            <Wallet className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900">
            Rs. {Number(summary.today_expenses || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-stone-500">Paid today from cash drawer/bank</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">This Month's Total</span>
            <Calendar className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-700">
            Rs. {Number(summary.this_month_expenses || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-stone-500">Current calendar month operating cost</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">All-Time Recorded</span>
            <TrendingDown className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900">
            Rs. {Number(summary.total_all_time || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-stone-500">Overall cumulative expense log</span>
        </div>
      </div>

      {/* Category Breakdown Chips */}
      {summary.category_breakdown && summary.category_breakdown.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center space-x-2 mb-3">
            <PieChart className="w-4 h-4 text-stone-500" />
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Expense Distribution by Category
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.category_breakdown.map((c: any, i: number) => (
              <div
                key={i}
                className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs flex items-center space-x-2"
              >
                <span className="font-semibold text-stone-700">{c.category}:</span>
                <span className="font-black text-stone-900">Rs. {Number(c.total_amount).toLocaleString()}</span>
                <span className="text-[10px] text-stone-400">({c.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search expenses by title or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
            />
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All Payment Methods</option>
              <option value="Cash">Cash Drawer</option>
              <option value="Bank Transfer">Bank Account</option>
              <option value="EasyPaisa/JazzCash">EasyPaisa / JazzCash</option>
              <option value="Cheque">Cheque</option>
            </select>

            <div className="flex items-center space-x-1 text-xs">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-xs"
              />
              <span className="text-stone-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-xs"
              />
            </div>

            {(search || selectedCategory !== 'all' || selectedMethod !== 'all' || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('all');
                  setSelectedMethod('all');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="p-2 text-stone-500 hover:text-stone-800 text-xs font-semibold"
                title="Reset Filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-600 font-bold uppercase border-b border-stone-200 text-[10px] tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Expense Title & Details</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Recorded By</th>
                <th className="py-3 px-4 text-right">Amount (Rs.)</th>
                {isAdmin && <th className="py-3 px-4 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-stone-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-stone-400">
                    <Wallet className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    No expenses found matching the criteria.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                      {new Date(exp.expense_date).toLocaleDateString('en-PK', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-stone-900">{exp.title}</div>
                      {exp.description && (
                        <div className="text-[11px] text-stone-500 mt-0.5">{exp.description}</div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {exp.category}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center space-x-1 text-stone-700">
                        <CreditCard className="w-3 h-3 text-stone-400" />
                        <span>{exp.payment_method}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-stone-600 font-medium">
                      {exp.recorder_name || 'Admin'}
                    </td>

                    <td className="py-3 px-4 text-right font-black text-rose-700 text-sm">
                      Rs. {Number(exp.amount).toLocaleString()}
                    </td>

                    {isAdmin && (
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(exp.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: RECORD EXPENSE ================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-stone-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Wallet className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm">Record Store Operating Expense</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Expense Title / Payee *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LESCO Electricity Bill, Suzuki Rickshaw Freight to Bahria Town"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-amber-500"
                  >
                    {categories.map((c, i) => (
                      <option key={i} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="CUSTOM">+ Custom Category</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Amount (Rs.) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-rose-700 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {formData.category === 'CUSTOM' && (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Enter Custom Category Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Generator Engine Oil, Trade License Fee"
                    value={formData.custom_category}
                    onChange={(e) => setFormData({ ...formData, custom_category: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Payment Channel
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Cash">Cash Drawer</option>
                    <option value="Bank Transfer">Bank Transfer (HBL/Meezan)</option>
                    <option value="EasyPaisa/JazzCash">EasyPaisa / JazzCash</option>
                    <option value="Cheque">Bank Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Additional Notes / Voucher Ref #
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paid to driver Aslam for 30 bags cement unloading, Bill Reference #98234"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  {isSubmitting ? 'Recording...' : 'Save Expense Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
