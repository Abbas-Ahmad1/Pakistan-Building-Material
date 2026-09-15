import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Trash2,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  RefreshCw,
  X,
  FileText,
  DollarSign,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Supplier, Product } from '../types';

export const PurchasesView: React.FC = () => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    total_orders: 0,
    total_purchases_amount: 0,
    total_paid: 0,
    total_payable: 0,
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New Purchase Inward Modal State
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
  const [inwardItems, setInwardItems] = useState<
    {
      product_id: number;
      quantity: number;
      unit_cost: number;
      new_selling_price?: number;
    }[]
  >([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Single Bill Details Modal
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Purchase Return Modal State
  const [returnPurchase, setReturnPurchase] = useState<any | null>(null);
  const [returnItems, setReturnItems] = useState<
    {
      product_id: number;
      product_name: string;
      quantity: number;
      unit_cost: number;
      max_qty: number;
      return_qty: number;
      reason: string;
    }[]
  >([]);
  const [returnRefundType, setReturnRefundType] = useState<'LEDGER_CREDIT' | 'CASH'>('LEDGER_CREDIT');
  const [returnReason, setReturnReason] = useState('Supplier defect / return');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [purchRes, supRes, prodRes] = await Promise.all([
        apiRequest<any[]>(
          `/api/purchases?search=${encodeURIComponent(search)}`
        ),
        apiRequest<Supplier[]>('/api/suppliers'),
        apiRequest<Product[]>('/api/products'),
      ]);

      if (purchRes.success && purchRes.data) {
        setPurchases(purchRes.data);
        if (purchRes.summary) setSummary(purchRes.summary);
      }
      if (supRes.success && supRes.data) setSuppliers(supRes.data);
      if (prodRes.success && prodRes.data) setProducts(prodRes.data);
    } catch (err) {
      console.error('Error fetching purchases data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // Add line item to inward modal
  const addLineItem = () => {
    if (products.length === 0) return;
    const firstProd = products[0];
    setInwardItems((prev) => [
      ...prev,
      {
        product_id: firstProd.id,
        quantity: 1,
        unit_cost: firstProd.purchase_price,
        new_selling_price: firstProd.selling_price,
      },
    ]);
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    setInwardItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const updated = { ...item, [field]: value };
          // If changing product_id, autofill default unit_cost and selling price
          if (field === 'product_id') {
            const p = products.find((prod) => prod.id === Number(value));
            if (p) {
              updated.unit_cost = p.purchase_price;
              updated.new_selling_price = p.selling_price;
            }
          }
          // If changing unit_cost, recalculate suggested selling price
          if (field === 'unit_cost') {
            const p = products.find((prod) => prod.id === updated.product_id);
            const cost = Number(value) || 0;
            if (p && (p.auto_price_update || p.pricing_mode !== 'FIXED')) {
              if (p.pricing_mode === 'MARKUP' && p.markup_percentage) {
                updated.new_selling_price = Math.round(cost * (1 + p.markup_percentage / 100));
              } else if (p.pricing_mode === 'MARGIN' && p.margin_percentage && p.margin_percentage < 100) {
                updated.new_selling_price = Math.round(cost / (1 - p.margin_percentage / 100));
              }
            }
          }
          return updated;
        }
        return item;
      })
    );
  };

  const removeLineItem = (index: number) => {
    setInwardItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations for modal
  const modalSubtotal = inwardItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  const modalGrandTotal = Math.max(0, modalSubtotal - (Number(discountAmount) || 0));

  // Auto-sync paid amount default
  useEffect(() => {
    if (showInwardModal) {
      setPaidAmount(modalGrandTotal.toString());
    }
  }, [modalGrandTotal, showInwardModal]);

  // Submit Inward Bill
  const handleSubmitInward = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedSupplierId) {
      setErrorMessage('Please select a supplier.');
      return;
    }

    if (inwardItems.length === 0) {
      setErrorMessage('Please add at least one stock item.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/api/purchases', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: Number(selectedSupplierId),
          items: inwardItems,
          discount_amount: Number(discountAmount) || 0,
          paid_amount: Number(paidAmount) || 0,
          notes,
        }),
      });

      if (res.success) {
        setShowInwardModal(false);
        setInwardItems([]);
        setSelectedSupplierId('');
        setNotes('');
        fetchData();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record purchase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // View Bill Details
  const openPurchaseDetails = async (id: number) => {
    setIsLoadingDetails(true);
    try {
      const res = await apiRequest<any>(`/api/purchases/${id}`);
      if (res.success && res.data) {
        setSelectedPurchase(res.data);
      }
    } catch (err) {
      console.error('Error fetching purchase details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const openReturnModal = async (id: number) => {
    setIsLoadingDetails(true);
    setReturnError(null);
    try {
      const res = await apiRequest<any>(`/api/purchases/${id}`);
      if (res.success && res.data) {
        setReturnPurchase(res.data);
        setReturnItems(
          (res.data.items || []).map((it: any) => ({
            product_id: it.product_id,
            product_name: it.product_name,
            quantity: it.quantity,
            unit_cost: it.unit_cost,
            max_qty: it.quantity,
            return_qty: 0,
            reason: '',
          }))
        );
      }
    } catch (err: any) {
      console.error('Error loading purchase for return:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleProcessPurchaseReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnPurchase) return;
    setReturnError(null);

    const itemsToReturn = returnItems.filter((it) => it.return_qty > 0);
    if (itemsToReturn.length === 0) {
      setReturnError('Please specify return quantity (> 0) for at least one item.');
      return;
    }

    for (const it of itemsToReturn) {
      if (it.return_qty > it.max_qty) {
        setReturnError(`Cannot return ${it.return_qty} units of "${it.product_name}". Maximum purchased was ${it.max_qty}.`);
        return;
      }
    }

    setIsSubmittingReturn(true);
    try {
      const res = await apiRequest<any>(`/api/purchases/${returnPurchase.id}/returns`, {
        method: 'POST',
        body: JSON.stringify({
          items: itemsToReturn.map((it) => ({
            product_id: it.product_id,
            quantity: it.return_qty,
            unit_cost: it.unit_cost,
            reason: it.reason || returnReason,
          })),
          refund_type: returnRefundType,
          reason: returnReason,
        }),
      });

      if (res.success) {
        setReturnPurchase(null);
        setSelectedPurchase(null);
        await fetchData();
      }
    } catch (err: any) {
      setReturnError(err.message || 'Failed to process supplier return.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-stone-900 tracking-tight">
            Purchases & Stock Inward (Maal Aamad)
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Log supplier deliveries, inventory restock, factory purchase prices, and vendor billing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowInwardModal(true);
            if (inwardItems.length === 0 && products.length > 0) {
              setInwardItems([
                {
                  product_id: products[0].id,
                  quantity: 10,
                  unit_cost: products[0].purchase_price,
                  new_selling_price: products[0].selling_price,
                },
              ]);
            }
          }}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Record Stock Inward Bill</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Purchase Bills</span>
            <ShoppingBag className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900">{summary.total_orders}</div>
          <span className="text-[11px] text-stone-500">Inward deliveries recorded</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Stock Value Purchased</span>
            <TrendingDown className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900">
            Rs. {summary.total_purchases_amount?.toLocaleString()}
          </div>
          <span className="text-[11px] text-stone-500">Total factory billing cost</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Paid to Vendors</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">
            Rs. {summary.total_paid?.toLocaleString()}
          </div>
          <span className="text-[11px] text-stone-500">Settled via cash/bank</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Remaining Vendor Payable</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-700">
            Rs. {summary.total_payable?.toLocaleString()}
          </div>
          <span className="text-[11px] text-stone-500">Unsettled purchase dues</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by purchase bill number (e.g. PO-2026-1001) or supplier name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
          />
        </form>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-600 font-bold uppercase border-b border-stone-200 text-[10px] tracking-wider">
                <th className="py-3 px-4">PO / Bill #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Supplier / Factory</th>
                <th className="py-3 px-4 text-center">Items Inward</th>
                <th className="py-3 px-4 text-right">Bill Total</th>
                <th className="py-3 px-4 text-right">Paid Amount</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
                    Loading purchases...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    No purchase inward bills found.
                  </td>
                </tr>
              ) : (
                purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">
                      {po.purchase_number}
                    </td>

                    <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                      {new Date(po.purchase_date).toLocaleDateString('en-PK', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-stone-900">{po.supplier_company || po.supplier_name}</div>
                      <span className="text-[10px] text-stone-500">Contact: {po.supplier_name}</span>
                    </td>

                    <td className="py-3 px-4 text-center font-medium text-stone-600">
                      {po.items_count || 1}
                    </td>

                    <td className="py-3 px-4 text-right font-black text-stone-900">
                      Rs. {po.grand_total?.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                      Rs. {po.paid_amount?.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-rose-700">
                      {po.due_amount > 0 ? `Rs. ${po.due_amount?.toLocaleString()}` : '-'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          po.payment_status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : po.payment_status === 'PARTIAL'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {po.payment_status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={() => openPurchaseDetails(po.id)}
                          className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors inline-flex items-center space-x-1"
                          title="View Bill Details"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold">Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openReturnModal(po.id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 rounded-lg transition-colors inline-flex items-center space-x-1"
                          title="Return Stock to Supplier"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold">Return</span>
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

      {/* ================= MODAL: RECORD STOCK INWARD BILL ================= */}
      {showInwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-stone-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm">Record Stock Inward (Stock Restock Bill)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInwardModal(false)}
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

            <form onSubmit={handleSubmitInward} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Supplier Dropdown */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Select Supplier / Distributor *
                </label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Choose Vendor --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.company || s.name} {s.payable_balance > 0 ? `(Payable: Rs. ${s.payable_balance.toLocaleString()})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-stone-700">
                    Received Products & Purchase Rates
                  </label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {inwardItems.map((item, idx) => {
                    const currentProd = products.find((p) => p.id === item.product_id);
                    const prevCost = currentProd?.purchase_price ?? 0;
                    const costShift = prevCost > 0 ? ((item.unit_cost - prevCost) / prevCost) * 100 : 0;
                    const hasCostShift = prevCost > 0 && Math.abs(costShift) > 0.01;

                    return (
                      <div
                        key={idx}
                        className="p-3 bg-stone-50 border border-stone-200 rounded-lg space-y-2 text-xs"
                      >
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-12 sm:col-span-5">
                            <label className="block text-[10px] text-stone-500 mb-0.5">Product</label>
                            <select
                              value={item.product_id}
                              onChange={(e) => updateLineItem(idx, 'product_id', Number(e.target.value))}
                              className="w-full p-1.5 border border-stone-300 rounded text-xs font-medium bg-white"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Stock: {p.current_stock} {p.unit} | Cost: Rs. {p.purchase_price})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-4 sm:col-span-2">
                            <label className="block text-[10px] text-stone-500 mb-0.5">
                              Qty ({currentProd?.unit || 'Unit'})
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))}
                              className="w-full p-1.5 border border-stone-300 rounded font-bold bg-white"
                            />
                          </div>

                          <div className="col-span-4 sm:col-span-2">
                            <label className="block text-[10px] text-stone-500 mb-0.5">Cost Rate (Rs.)</label>
                            <input
                              type="number"
                              min="0"
                              value={item.unit_cost}
                              onChange={(e) => updateLineItem(idx, 'unit_cost', Number(e.target.value))}
                              className="w-full p-1.5 border border-stone-300 rounded font-bold bg-white"
                            />
                          </div>

                          <div className="col-span-3 sm:col-span-2 text-right">
                            <span className="block text-[10px] text-stone-500 mb-0.5">Line Total</span>
                            <span className="font-bold text-stone-900">
                              Rs. {(item.quantity * item.unit_cost).toLocaleString()}
                            </span>
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => removeLineItem(idx)}
                              className="p-1 text-stone-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Pricing Context & Dynamic Auto-Update Row */}
                        <div className="pt-2 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center space-x-2">
                            <span className="text-stone-500">
                              Previous Cost: <strong className="font-mono text-stone-700">Rs. {prevCost.toLocaleString()}</strong>
                            </span>
                            {hasCostShift && (
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                                  costShift > 0
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {costShift > 0 ? `+${costShift.toFixed(1)}% Increase` : `${costShift.toFixed(1)}% Decrease`}
                              </span>
                            )}
                            {currentProd?.auto_price_update ? (
                              <span className="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded text-[9px]">
                                ⚡ Auto-Price ({currentProd.pricing_mode || 'MARKUP'})
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center space-x-1.5">
                            <label className="text-stone-500 text-[10px]">New Selling Price (Rs.):</label>
                            <input
                              type="number"
                              min="0"
                              value={item.new_selling_price || ''}
                              onChange={(e) => updateLineItem(idx, 'new_selling_price', Number(e.target.value))}
                              placeholder={currentProd ? String(currentProd.selling_price) : '0'}
                              className="w-24 p-1 border border-stone-300 rounded font-bold font-mono text-amber-950 bg-white text-right text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Calculations */}
              <div className="p-4 bg-stone-100 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-bold text-stone-900">Rs. {modalSubtotal.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Supplier Discount (Rs.):</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    className="w-28 text-right p-1 border border-stone-300 rounded"
                  />
                </div>

                <div className="flex justify-between text-sm font-black text-stone-900 pt-1 border-t border-stone-300">
                  <span>Grand Total:</span>
                  <span className="text-emerald-700">Rs. {modalGrandTotal.toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-stone-600 mb-0.5">
                      Amount Paid Upfront (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full p-1.5 border border-stone-300 rounded font-bold"
                    />
                  </div>

                  <div>
                    <span className="block text-[10px] uppercase font-bold text-stone-600 mb-0.5">
                      Remaining Payable Due
                    </span>
                    <div className="p-1.5 bg-rose-50 border border-rose-200 rounded font-black text-rose-700">
                      Rs. {Math.max(0, modalGrandTotal - (Number(paidAmount) || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Delivery Notes / Gate Pass Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received via Bilty #4012 on Shahdara depot"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowInwardModal(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  {isSubmitting ? 'Updating Inventory...' : 'Confirm Stock Inward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: PURCHASE BILL DETAILS ================= */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">{selectedPurchase.purchase_number}</h3>
                <p className="text-xs text-stone-500">Supplier: {selectedPurchase.supplier_company || selectedPurchase.supplier_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-1">
              <div>Date: {new Date(selectedPurchase.purchase_date).toLocaleDateString('en-PK')}</div>
              <div>Notes: {selectedPurchase.notes || 'N/A'}</div>
            </div>

            <table className="w-full text-left text-xs border border-stone-200">
              <thead className="bg-stone-100 text-stone-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Cost Rate</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {(selectedPurchase.items || []).map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="p-2 font-medium">{item.product_name}</td>
                    <td className="p-2 text-center">{item.quantity} {item.unit}</td>
                    <td className="p-2 text-right">Rs. {item.unit_cost?.toLocaleString()}</td>
                    <td className="p-2 text-right font-bold">Rs. {item.line_total?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 text-xs border-t border-stone-200 pt-2">
              <div className="flex justify-between font-black text-sm">
                <span>Grand Total:</span>
                <span>Rs. {selectedPurchase.grand_total?.toLocaleString()}</span>
              </div>
              {selectedPurchase.returned_amount > 0 && (
                <div className="flex justify-between text-amber-700 font-bold">
                  <span>Returned to Supplier:</span>
                  <span>- Rs. {selectedPurchase.returned_amount?.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Paid:</span>
                <span>Rs. {selectedPurchase.paid_amount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-rose-700 font-bold">
                <span>Due Balance:</span>
                <span>Rs. {selectedPurchase.due_amount?.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  const pId = selectedPurchase.id;
                  setSelectedPurchase(null);
                  openReturnModal(pId);
                }}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold inline-flex items-center space-x-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Return Items to Supplier</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: RETURN ITEMS TO SUPPLIER ================= */}
      {returnPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-start border-b border-stone-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <RotateCcw className="w-5 h-5 text-rose-600" />
                  <h3 className="text-base font-black text-stone-900">Return Stock to Supplier</h3>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Purchase: <strong className="text-stone-700">{returnPurchase.purchase_number}</strong> | Supplier: {returnPurchase.supplier_company || returnPurchase.supplier_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReturnPurchase(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {returnError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{returnError}</span>
              </div>
            )}

            <form onSubmit={handleProcessPurchaseReturn} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">Select Items to Return:</label>
                <div className="space-y-2">
                  {returnItems.map((item, idx) => (
                    <div key={item.product_id} className="p-3 bg-stone-50 border border-stone-200 rounded-lg space-y-2">
                      <div className="flex justify-between items-start text-xs">
                        <span className="font-bold text-stone-900">{item.product_name}</span>
                        <span className="text-stone-500 text-[11px]">Cost: Rs. {item.unit_cost.toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] text-stone-500 mb-0.5">
                            Return Qty (Max: {item.max_qty})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={item.max_qty}
                            value={item.return_qty || ''}
                            onChange={(e) => {
                              const val = Math.min(item.max_qty, Math.max(0, Number(e.target.value) || 0));
                              setReturnItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, return_qty: val } : it))
                              );
                            }}
                            placeholder="0"
                            className="w-full p-1.5 border border-stone-300 rounded font-bold bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-stone-500 mb-0.5">Item Defect / Reason</label>
                          <input
                            type="text"
                            value={item.reason}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReturnItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, reason: val } : it))
                              );
                            }}
                            placeholder="e.g. Expired / Damaged"
                            className="w-full p-1.5 border border-stone-300 rounded bg-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Refund Settlement:</label>
                  <select
                    value={returnRefundType}
                    onChange={(e: any) => setReturnRefundType(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white"
                  >
                    <option value="LEDGER_CREDIT">Vendor Ledger Credit (Katoti)</option>
                    <option value="CASH">Cash Refund Received</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">General Reason:</label>
                  <input
                    type="text"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-xs"
                  />
                </div>
              </div>

              {/* Total return calculation */}
              <div className="p-3 bg-rose-50/70 border border-rose-200/60 rounded-lg flex justify-between items-center text-xs">
                <span className="font-bold text-rose-900">Total Return Credit Amount:</span>
                <span className="text-base font-black text-rose-900">
                  Rs. {returnItems.reduce((sum, it) => sum + it.return_qty * it.unit_cost, 0).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setReturnPurchase(null)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmittingReturn ? 'Deducting Stock...' : 'Confirm Supplier Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
