import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Plus,
  Search,
  Printer,
  ArrowRight,
  CheckCircle,
  Clock,
  Trash2,
  X,
  AlertCircle,
  User,
  ShoppingBag,
  RefreshCw,
  Eye,
  FileText,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { Product, Customer } from '../types';

export const QuotationsView: React.FC = () => {
  const { settings } = useSettings();

  const [quotations, setQuotations] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal: Create Quotation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [projectTitle, setProjectTitle] = useState('Construction & Sanitary Package');
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState(
    'Rates are valid for 15 days due to market fluctuations in cement and pipe prices.'
  );

  // Items in creation modal
  const [items, setItems] = useState<
    { product_id: number; product_name: string; unit: string; quantity: number; unit_price: number }[]
  >([]);
  const [productSearch, setProductSearch] = useState('');

  // View / Print Modal
  const [viewingQuotation, setViewingQuotation] = useState<any | null>(null);

  // Convert Modal
  const [convertingQuotation, setConvertingQuotation] = useState<any | null>(null);
  const [convertPaymentMethod, setConvertPaymentMethod] = useState('Cash');
  const [convertPaidAmount, setConvertPaidAmount] = useState<number>(0);
  const [isConverting, setIsConverting] = useState(false);

  const fetchQuotations = async () => {
    setIsLoading(true);
    try {
      let url = `/api/quotations?search=${encodeURIComponent(search)}`;
      if (selectedStatus !== 'all') url += `&status=${selectedStatus}`;
      const res = await apiRequest<any[]>(url);
      if (res.success && res.data) {
        setQuotations(res.data);
      }
    } catch (err) {
      console.error('Error loading quotations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const [prodRes, custRes] = await Promise.all([
        apiRequest<Product[]>('/api/products?limit=300'),
        apiRequest<Customer[]>('/api/customers'),
      ]);
      if (prodRes.success && prodRes.data) setProducts(prodRes.data);
      if (custRes.success && custRes.data) setCustomers(custRes.data);
    } catch (err) {
      console.error('Error loading catalog:', err);
    }
  };

  useEffect(() => {
    fetchQuotations();
    fetchCatalog();
  }, [selectedStatus]);

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedCustomerId(val);
    if (val) {
      const found = customers.find((c) => String(c.id) === val);
      if (found) {
        setCustomerName(found.name);
        setCustomerPhone(found.phone || '');
      }
    }
  };

  const handleAddItem = (prod: Product) => {
    const existingIndex = items.findIndex((i) => i.product_id === prod.id);
    if (existingIndex >= 0) {
      const copy = [...items];
      copy[existingIndex].quantity += 1;
      setItems(copy);
    } else {
      setItems([
        ...items,
        {
          product_id: prod.id,
          product_name: prod.name,
          unit: prod.unit,
          quantity: 1,
          unit_price: prod.selling_price,
        },
      ]);
    }
    setProductSearch('');
  };

  const handleUpdateItemQty = (index: number, delta: number) => {
    const copy = [...items];
    const newQty = copy[index].quantity + delta;
    if (newQty <= 0) {
      copy.splice(index, 1);
    } else {
      copy[index].quantity = newQty;
    }
    setItems(copy);
  };

  const handleUpdateItemPrice = (index: number, price: number) => {
    const copy = [...items];
    copy[index].unit_price = Math.max(0, price);
    setItems(copy);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const subtotal = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
  const grandTotal = Math.max(0, subtotal - Number(discountAmount || 0));

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerName.trim()) {
      setErrorMessage('Customer or contractor name is required.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Please add at least one product to the quotation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/api/quotations', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          project_title: projectTitle.trim(),
          valid_until: validUntil,
          discount_amount: Number(discountAmount) || 0,
          notes: notes.trim(),
          items,
        }),
      });

      if (res.success) {
        setShowCreateModal(false);
        // Reset
        setCustomerName('');
        setCustomerPhone('');
        setSelectedCustomerId('');
        setItems([]);
        setDiscountAmount(0);
        fetchQuotations();
      } else {
        setErrorMessage(res.message || 'Failed to create quotation.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenView = async (id: number) => {
    try {
      const res = await apiRequest<any>(`/api/quotations/${id}`);
      if (res.success && res.data) {
        setViewingQuotation(res.data);
      }
    } catch (err) {
      console.error('Error fetching quotation details:', err);
    }
  };

  const handleOpenConvert = (q: any) => {
    setConvertingQuotation(q);
    setConvertPaidAmount(q.grand_total);
  };

  const handleConfirmConvert = async () => {
    if (!convertingQuotation) return;
    setIsConverting(true);
    try {
      const res = await apiRequest(`/api/quotations/${convertingQuotation.id}/convert-to-sale`, {
        method: 'POST',
        body: JSON.stringify({
          payment_method: convertPaymentMethod,
          paid_amount: convertPaidAmount,
        }),
      });

      if (res.success) {
        alert(res.message || 'Quotation successfully converted to Sale Invoice!');
        setConvertingQuotation(null);
        fetchQuotations();
      } else {
        alert('Failed: ' + res.message);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this quotation?')) return;
    try {
      const res = await apiRequest(`/api/quotations/${id}`, { method: 'DELETE' });
      if (res.success) {
        fetchQuotations();
      }
    } catch (err) {
      console.error('Error deleting quotation:', err);
    }
  };

  const filteredProducts = productSearch.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
            (p.brand && p.brand.toLowerCase().includes(productSearch.toLowerCase()))
        )
        .slice(0, 6)
    : [];

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-stone-900 tracking-tight flex items-center space-x-2">
            <FileCheck className="w-6 h-6 text-amber-600" />
            <span>Quotations & Project Estimates (Kaccha Bill / Parchi)</span>
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Prepare itemized project estimates for contractors, builders & painters with one-click conversion to confirmed sales.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Quotation / Kaccha Bill</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search estimates by quotation #, contractor, phone, or project title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchQuotations()}
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-amber-500"
          >
            <option value="all">All Statuses</option>
            <option value="SENT">Pending / Sent</option>
            <option value="CONVERTED">Converted to Sale</option>
            <option value="EXPIRED">Expired</option>
          </select>

          <button
            type="button"
            onClick={fetchQuotations}
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-600 font-bold uppercase border-b border-stone-200 text-[10px] tracking-wider">
                <th className="py-3 px-4">Estimate #</th>
                <th className="py-3 px-4">Contractor / Customer</th>
                <th className="py-3 px-4">Project Title</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Valid Until</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
                    Loading quotations...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    <FileCheck className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    No quotations found. Click "New Quotation" to create an estimate for a client.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-amber-800 whitespace-nowrap">
                      {q.quotation_number}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-stone-900">{q.customer_name}</div>
                      {q.customer_phone && (
                        <div className="text-[10px] text-stone-500 font-mono">{q.customer_phone}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-stone-700 max-w-xs truncate">
                      {q.project_title || 'General Estimate'}
                    </td>

                    <td className="py-3 px-4 text-stone-600">
                      {q.items_count} items
                    </td>

                    <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                      {new Date(q.valid_until).toLocaleDateString('en-PK', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="py-3 px-4 text-right font-black text-stone-900 text-sm">
                      Rs. {Number(q.grand_total).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          q.status === 'CONVERTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : q.status === 'EXPIRED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {q.status === 'CONVERTED'
                          ? 'Converted to Invoice'
                          : q.status === 'EXPIRED'
                          ? 'Expired'
                          : 'Active / Sent'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenView(q.id)}
                          className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200 rounded transition-colors"
                          title="View & Print Estimate"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {q.status !== 'CONVERTED' && (
                          <button
                            type="button"
                            onClick={() => handleOpenConvert(q)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold transition-colors"
                            title="Convert to Confirmed Sale Invoice"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>Convert to Sale</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(q.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* ================= MODAL: CREATE ESTIMATE ================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-stone-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm">Create New Quotation / Kaccha Bill</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
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

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Customer & Project Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Select Existing Contractor / Customer
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={handleCustomerSelect}
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs"
                  >
                    <option value="">-- Or type walk-in contractor below --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone || 'No phone'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Contractor / Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Contractor Tariq Javed"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Contact Phone (WhatsApp)
                  </label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Project / Site Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1-Kanal House Plumbing & Sanitary Package (Bahria Phase 7)"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Valid Until Date
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Product Picker */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-stone-800 uppercase tracking-wider">
                    Add Items to Estimate ({items.length})
                  </h4>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search product by name, brand, SKU or pipe/fitting size..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs"
                  />

                  {filteredProducts.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-300 rounded-lg shadow-lg z-20 overflow-hidden divide-y divide-stone-100">
                      {filteredProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleAddItem(p)}
                          className="p-2.5 hover:bg-amber-50 cursor-pointer flex justify-between items-center text-xs"
                        >
                          <div>
                            <span className="font-bold text-stone-900">{p.name}</span>
                            <span className="text-[10px] text-stone-400 ml-2 font-mono">
                              SKU: {p.sku} • {p.brand}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-amber-800">
                              Rs. {Number(p.selling_price).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-stone-500 block">
                              Stock: {p.current_stock} {p.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div className="border border-stone-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-100 text-stone-600 font-bold uppercase text-[10px]">
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 text-center w-28">Quantity</th>
                        <th className="py-2 px-3 text-right w-32">Quotation Rate (Rs.)</th>
                        <th className="py-2 px-3 text-right w-32">Line Total</th>
                        <th className="py-2 px-3 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-stone-400">
                            Search and select products above to add to this estimate.
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-stone-50">
                            <td className="py-2 px-3 font-semibold text-stone-900">
                              {item.product_name}
                            </td>

                            <td className="py-2 px-3 text-center">
                              <div className="inline-flex items-center space-x-1 border border-stone-300 rounded px-1.5 py-0.5 bg-white">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(idx, -1)}
                                  className="text-stone-500 hover:text-stone-900 px-1 font-bold"
                                >
                                  -
                                </button>
                                <span className="font-bold w-8 text-center">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(idx, 1)}
                                  className="text-stone-500 hover:text-stone-900 px-1 font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={item.unit_price}
                                onChange={(e) => handleUpdateItemPrice(idx, Number(e.target.value))}
                                className="w-24 px-1.5 py-0.5 border border-stone-300 rounded text-right font-bold text-xs"
                              />
                            </td>

                            <td className="py-2 px-3 text-right font-bold text-stone-900">
                              Rs. {Number(item.quantity * item.unit_price).toLocaleString()}
                            </td>

                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-stone-400 hover:text-rose-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Summary & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Terms & Notes
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>

                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2 text-xs font-medium">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal:</span>
                    <span className="font-bold text-stone-900">
                      Rs. {Number(subtotal).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-stone-600">
                    <span>Project Discount (Rs.):</span>
                    <input
                      type="number"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value))}
                      className="w-24 px-2 py-0.5 border border-stone-300 rounded text-right font-bold text-xs text-rose-700"
                    />
                  </div>

                  <div className="pt-2 border-t border-stone-200 flex justify-between items-center font-black text-sm">
                    <span className="text-stone-900">Grand Total Estimate:</span>
                    <span className="text-base text-amber-800">
                      Rs. {Number(grandTotal).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  {isSubmitting ? 'Creating...' : 'Save & Generate Estimate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: VIEW & PRINT QUOTATION ================= */}
      {viewingQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-stone-900 text-white flex justify-between items-center shrink-0">
              <span className="font-bold text-xs uppercase tracking-wider text-stone-300">
                Printable Estimate Document
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingQuotation(null)}
                  className="text-stone-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 text-stone-900 text-xs font-sans print:p-0">
              {/* Store Header */}
              <div className="text-center border-b pb-4 border-stone-300">
                <h2 className="text-xl font-black tracking-tight uppercase">
                  {settings.store_name}
                </h2>
                <p className="text-stone-600 text-xs">{settings.tagline}</p>
                <p className="text-[11px] text-stone-500 mt-1">
                  Proprietor: {settings.owner_name} • Phone: {settings.phone} • {settings.address}
                </p>
                <div className="mt-2 inline-block px-3 py-1 bg-stone-100 rounded text-xs font-bold uppercase tracking-widest text-stone-800">
                  PROJECT QUOTATION / ESTIMATE SLIP
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-stone-200">
                <div>
                  <span className="text-[10px] text-stone-500 uppercase font-bold block">
                    Client / Contractor
                  </span>
                  <div className="font-bold text-stone-900 text-sm">{viewingQuotation.customer_name}</div>
                  {viewingQuotation.customer_phone && (
                    <div className="text-stone-600 font-mono">{viewingQuotation.customer_phone}</div>
                  )}
                  <div className="text-stone-500 mt-1">
                    Project: <span className="font-semibold text-stone-800">{viewingQuotation.project_title}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-stone-500 uppercase font-bold block">
                    Quotation Reference
                  </span>
                  <div className="font-bold text-amber-800 font-mono text-sm">
                    {viewingQuotation.quotation_number}
                  </div>
                  <div className="text-stone-500">
                    Date: {new Date(viewingQuotation.created_at).toLocaleDateString('en-PK')}
                  </div>
                  <div className="text-stone-500">
                    Valid Until: {new Date(viewingQuotation.valid_until).toLocaleDateString('en-PK')}
                  </div>
                </div>
              </div>

              {/* Items */}
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-stone-300 font-bold uppercase text-[10px]">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Rate</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {viewingQuotation.items?.map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2">
                        <div className="font-bold text-stone-900">{it.product_name}</div>
                        <span className="text-[10px] text-stone-400">{it.sku}</span>
                      </td>
                      <td className="py-2 text-center font-bold">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="py-2 text-right">Rs. {Number(it.unit_price).toLocaleString()}</td>
                      <td className="py-2 text-right font-bold text-stone-900">
                        Rs. {Number(it.line_total).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Box */}
              <div className="border-t-2 border-stone-300 pt-3 space-y-1.5 text-right font-medium">
                <div className="flex justify-between">
                  <span className="text-stone-500">Subtotal:</span>
                  <span>Rs. {Number(viewingQuotation.subtotal).toLocaleString()}</span>
                </div>
                {viewingQuotation.discount_amount > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>Discount:</span>
                    <span>- Rs. {Number(viewingQuotation.discount_amount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-stone-900 pt-1 border-t">
                  <span>Grand Total Estimate:</span>
                  <span className="text-base text-amber-800">
                    Rs. {Number(viewingQuotation.grand_total).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Terms */}
              {viewingQuotation.notes && (
                <div className="p-3 bg-stone-50 rounded border border-stone-200 text-[11px] text-stone-600">
                  <strong>Terms & Conditions:</strong> {viewingQuotation.notes}
                </div>
              )}

              {/* Signature lines */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-[10px] text-stone-500">
                <div className="border-t border-stone-300 pt-2">Client / Contractor Acceptance</div>
                <div className="border-t border-stone-300 pt-2">For {settings.store_name}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONVERT TO SALE ================= */}
      {convertingQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 bg-emerald-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Convert Estimate to Confirmed Sale</h3>
              </div>
              <button
                type="button"
                onClick={() => setConvertingQuotation(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg space-y-1">
                <div className="text-stone-500">Estimate Reference:</div>
                <div className="font-bold text-stone-900 text-sm">
                  {convertingQuotation.quotation_number} ({convertingQuotation.customer_name})
                </div>
                <div className="text-amber-800 font-black text-base mt-1">
                  Grand Total: Rs. {Number(convertingQuotation.grand_total).toLocaleString()}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={convertPaymentMethod}
                  onChange={(e) => setConvertPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg font-bold text-stone-800"
                >
                  <option value="Cash">Cash Drawer</option>
                  <option value="Bank Transfer">Bank Transfer (Meezan/HBL)</option>
                  <option value="EasyPaisa/JazzCash">EasyPaisa / JazzCash</option>
                  <option value="Card">Credit/Debit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Amount Received Now (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  max={convertingQuotation.grand_total}
                  value={convertPaidAmount}
                  onChange={(e) => setConvertPaidAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg font-bold text-emerald-700 text-sm"
                />
                <span className="text-[10px] text-stone-400">
                  Remaining Rs. {Math.max(0, convertingQuotation.grand_total - convertPaidAmount).toLocaleString()} will be charged to contractor's Khata (Credit).
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setConvertingQuotation(null)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmConvert}
                  disabled={isConverting}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold transition-colors"
                >
                  {isConverting ? 'Processing...' : 'Confirm & Generate Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
