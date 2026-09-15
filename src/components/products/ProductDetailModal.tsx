import React, { useState, useEffect } from 'react';
import { Product, ProductPriceHistory, InventoryBatch } from '../../types';
import { apiRequest } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Package,
  Barcode,
  Tag,
  Building,
  DollarSign,
  TrendingUp,
  TrendingDown,
  History,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  ArrowRight,
  User,
  Boxes,
  Calculator,
  RefreshCw,
} from 'lucide-react';

interface ProductDetailModalProps {
  productId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onAdjustStock: (product: Product) => void;
  onEditProduct: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  productId,
  isOpen,
  onClose,
  onAdjustStock,
  onEditProduct,
}) => {
  const { formatCurrency, settings } = useSettings();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'overview' | 'price_history' | 'batches' | 'movements'>('overview');
  const [product, setProduct] = useState<(Product & { transactions?: any[] }) | null>(null);
  const [priceHistory, setPriceHistory] = useState<ProductPriceHistory[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);

  useEffect(() => {
    if (productId && isOpen) {
      setIsLoading(true);
      apiRequest<Product & { transactions?: any[] }>(`/api/products/${productId}`).then((res) => {
        if (res.success && res.data) {
          setProduct(res.data);
        }
        setIsLoading(false);
      });
    } else {
      setProduct(null);
      setPriceHistory([]);
      setBatches([]);
      setActiveTab('overview');
    }
  }, [productId, isOpen]);

  useEffect(() => {
    if (productId && isOpen && activeTab === 'price_history') {
      setIsLoadingHistory(true);
      apiRequest<ProductPriceHistory[]>(`/api/products/${productId}/price-history`).then((res) => {
        if (res.success && res.data) {
          setPriceHistory(res.data);
        }
        setIsLoadingHistory(false);
      });
    } else if (productId && isOpen && activeTab === 'batches') {
      setIsLoadingBatches(true);
      apiRequest<InventoryBatch[]>(`/api/products/${productId}/batches`).then((res) => {
        if (res.success && res.data) {
          setBatches(res.data);
        }
        setIsLoadingBatches(false);
      });
    }
  }, [activeTab, productId, isOpen]);

  if (!isOpen || !productId) return null;

  const isLowStock =
    product && product.current_stock > 0 && product.current_stock <= product.minimum_stock;
  const isOutOfStock = product && product.current_stock <= 0;

  const currentCost = product?.purchase_price ?? 0;
  const currentSelling = product?.selling_price ?? 0;
  const grossMargin =
    currentSelling > 0
      ? (((currentSelling - currentCost) / currentSelling) * 100).toFixed(1)
      : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">{product?.name || 'Loading details...'}</h2>
              <div className="flex items-center space-x-2 text-xs text-stone-500 mt-0.5">
                <span className="font-mono font-semibold text-stone-700">SKU: {product?.sku}</span>
                {product?.barcode && <span>• Barcode: {product.barcode}</span>}
                {product?.brand && <span>• Brand: {product.brand}</span>}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-stone-200 flex space-x-4 bg-white text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-amber-800 text-amber-900 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Overview & Pricing
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('price_history')}
              className={`py-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
                activeTab === 'price_history'
                  ? 'border-amber-800 text-amber-900 font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Price & Cost History</span>
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('batches')}
              className={`py-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
                activeTab === 'batches'
                  ? 'border-amber-800 text-amber-900 font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Inventory Batches (FIFO)</span>
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('movements')}
              className={`py-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
                activeTab === 'movements'
                  ? 'border-amber-800 text-amber-900 font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Movement Ledger</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading || !product ? (
            <div className="py-12 text-center text-xs text-stone-500">Loading product information...</div>
          ) : activeTab === 'overview' ? (
            <>
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Current Stock</span>
                  <div className="flex items-baseline space-x-1.5 mt-1">
                    <span
                      className={`text-xl font-bold font-mono ${
                        isOutOfStock
                          ? 'text-red-700'
                          : isLowStock
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {product.current_stock}
                    </span>
                    <span className="text-xs text-stone-500 font-medium">{product.unit}</span>
                  </div>
                  <span
                    className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      isOutOfStock
                        ? 'bg-red-100 text-red-800'
                        : isLowStock
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isOutOfStock ? 'OUT OF STOCK' : isLowStock ? 'LOW STOCK' : 'IN STOCK'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Retail Price</span>
                  <div className="text-xl font-bold font-mono text-stone-900 mt-1">
                    {formatCurrency(product.selling_price)}
                  </div>
                  <span className="text-[10px] text-stone-400 mt-1 block">Per {product.unit}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Wholesale Price</span>
                  <div className="text-xl font-bold font-mono text-stone-900 mt-1">
                    {formatCurrency(product.wholesale_price || product.selling_price)}
                  </div>
                  <span className="text-[10px] text-stone-400 mt-1 block">Trade / Contractors</span>
                </div>

                {isAdmin && (
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Gross Margin</span>
                    <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                      +{grossMargin}%
                    </div>
                    <span className="text-[10px] text-stone-500 mt-1 block">
                      Cost: {formatCurrency(product.purchase_price)}
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic Pricing Configuration Card */}
              {isAdmin && (
                <div className="bg-amber-50/50 rounded-xl border border-amber-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center space-x-1.5">
                      <Calculator className="w-4 h-4 text-amber-700" />
                      <span>Dynamic Pricing Rules & Cost Tracking</span>
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                      MODE: {product.pricing_mode || 'FIXED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-stone-500 block text-[11px]">Latest Purchase Cost</span>
                      <span className="font-bold font-mono text-stone-900">
                        {formatCurrency(product.purchase_price)}
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[11px]">Previous Cost</span>
                      <span className="font-bold font-mono text-stone-700">
                        {product.previous_cost ? formatCurrency(product.previous_cost) : '—'}
                      </span>
                      {product.cost_change_percent !== undefined && product.cost_change_percent !== 0 && (
                        <span
                          className={`ml-1 text-[10px] font-bold font-mono ${
                            product.cost_change_percent > 0 ? 'text-red-700' : 'text-emerald-700'
                          }`}
                        >
                          ({product.cost_change_percent > 0 ? '+' : ''}
                          {product.cost_change_percent}%)
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[11px]">Pricing Strategy Rule</span>
                      <span className="font-semibold text-stone-800">
                        {product.pricing_mode === 'MARKUP'
                          ? `+${product.markup_percentage || 0}% Markup`
                          : product.pricing_mode === 'MARGIN'
                          ? `${product.margin_percentage || 0}% Gross Margin`
                          : 'Manual / Fixed'}
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[11px]">Auto-Price Update</span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          product.auto_price_update
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {product.auto_price_update ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Attributes Grid */}
              <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Specifications & Classification
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-stone-400 block text-[11px]">Category</span>
                    <span className="font-semibold text-stone-800">{product.category_name || 'General'}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[11px]">Subcategory</span>
                    <span className="font-semibold text-stone-800">{product.subcategory_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[11px]">Brand / Line</span>
                    <span className="font-semibold text-stone-800">{product.brand || '—'}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[11px]">Primary Supplier</span>
                    <span className="font-semibold text-stone-800">{product.supplier_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[11px]">Safety Min Stock</span>
                    <span className="font-semibold text-stone-800">
                      {product.minimum_stock} {product.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[11px]">Status</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        product.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {product.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {product.description && (
                  <div className="pt-2 border-t border-stone-100">
                    <span className="text-stone-400 block text-[11px] mb-1">Description</span>
                    <p className="text-xs text-stone-600 leading-relaxed">{product.description}</p>
                  </div>
                )}
              </div>
            </>
          ) : activeTab === 'price_history' ? (
            /* Price History Audit Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center space-x-1.5">
                  <History className="w-4 h-4 text-amber-700" />
                  <span>Price & Cost Adjustment Audit Log</span>
                </h3>
              </div>

              {isLoadingHistory ? (
                <div className="py-12 text-center text-xs text-stone-500 flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-700" />
                  <span>Fetching price history...</span>
                </div>
              ) : priceHistory.length === 0 ? (
                <div className="p-8 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-500 text-center">
                  <History className="w-6 h-6 text-stone-300 mx-auto mb-2" />
                  <p className="font-semibold text-stone-700">No price adjustments recorded yet</p>
                  <p className="text-stone-400 mt-0.5 text-[11px]">
                    Adjustments from purchase inward or manual catalog edits will appear here.
                  </p>
                </div>
              ) : (
                <div className="border border-stone-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] bg-stone-50">
                        <th className="py-2.5 px-3 font-semibold">Date & Time</th>
                        <th className="py-2.5 px-3 font-semibold">Purchase Cost</th>
                        <th className="py-2.5 px-3 font-semibold">Selling Price</th>
                        <th className="py-2.5 px-3 font-semibold">Reason</th>
                        <th className="py-2.5 px-3 font-semibold">Changed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {priceHistory.map((h) => {
                        const costDiff = h.new_cost - h.old_cost;
                        const priceDiff = h.new_selling_price - h.old_selling_price;
                        return (
                          <tr key={h.id} className="hover:bg-stone-50/70">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-stone-800 text-[11px]">
                                {new Date(h.created_at).toLocaleDateString()}
                              </div>
                              <span className="text-[10px] text-stone-400">
                                {new Date(h.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {h.purchase_number && (
                                <span className="block text-[9px] font-mono text-amber-800 font-bold">
                                  PO: {h.purchase_number}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center space-x-1 font-mono text-xs">
                                <span className="text-stone-400 line-through">
                                  {formatCurrency(h.old_cost)}
                                </span>
                                <ArrowRight className="w-3 h-3 text-stone-400" />
                                <span className="font-bold text-stone-900">
                                  {formatCurrency(h.new_cost)}
                                </span>
                              </div>
                              {Math.abs(costDiff) > 0.001 && (
                                <span
                                  className={`text-[10px] font-mono font-bold mt-0.5 inline-block ${
                                    costDiff > 0 ? 'text-red-700' : 'text-emerald-700'
                                  }`}
                                >
                                  {costDiff > 0 ? '+' : ''}
                                  {h.cost_change_percent}%
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center space-x-1 font-mono text-xs">
                                <span className="text-stone-400 line-through">
                                  {formatCurrency(h.old_selling_price)}
                                </span>
                                <ArrowRight className="w-3 h-3 text-stone-400" />
                                <span className="font-bold text-amber-900">
                                  {formatCurrency(h.new_selling_price)}
                                </span>
                              </div>
                              {Math.abs(priceDiff) > 0.001 && (
                                <span
                                  className={`text-[10px] font-mono font-bold mt-0.5 inline-block ${
                                    priceDiff > 0 ? 'text-blue-700' : 'text-stone-600'
                                  }`}
                                >
                                  {priceDiff > 0 ? '+' : ''}
                                  {h.price_change_percent}%
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-stone-600">
                              {h.reason || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-stone-500">
                              {h.user_name || 'System'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : activeTab === 'batches' ? (
            /* Inventory Batches (FIFO) Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center space-x-1.5">
                  <Boxes className="w-4 h-4 text-amber-700" />
                  <span>Active Stock Batches (FIFO Depletion Order)</span>
                </h3>
              </div>

              {isLoadingBatches ? (
                <div className="py-12 text-center text-xs text-stone-500 flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-700" />
                  <span>Loading batch allocations...</span>
                </div>
              ) : batches.length === 0 ? (
                <div className="p-8 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-500 text-center">
                  <Boxes className="w-6 h-6 text-stone-300 mx-auto mb-2" />
                  <p className="font-semibold text-stone-700">No active stock batches found</p>
                  <p className="text-stone-400 mt-0.5 text-[11px]">
                    New batches will be logged automatically on purchase order delivery.
                  </p>
                </div>
              ) : (
                <div className="border border-stone-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] bg-stone-50">
                        <th className="py-2.5 px-3 font-semibold">Batch #</th>
                        <th className="py-2.5 px-3 font-semibold">Received Date</th>
                        <th className="py-2.5 px-3 font-semibold">Initial Qty</th>
                        <th className="py-2.5 px-3 font-semibold">Remaining Qty</th>
                        <th className="py-2.5 px-3 font-semibold">Unit Cost</th>
                        <th className="py-2.5 px-3 font-semibold">Batch Valuation</th>
                        <th className="py-2.5 px-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {batches.map((b) => (
                        <tr key={b.id} className="hover:bg-stone-50/70">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-900">
                            {b.batch_number}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-stone-600">
                            {new Date(b.received_date).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-stone-600">
                            {b.quantity_initial} {product.unit}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-stone-900">
                            {b.quantity_remaining} {product.unit}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-stone-700">
                            {formatCurrency(b.unit_cost)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-stone-900">
                            {formatCurrency(b.quantity_remaining * b.unit_cost)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                b.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* Movement Ledger Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center space-x-1.5">
                  <History className="w-4 h-4 text-amber-700" />
                  <span>Stock Movement History</span>
                </h3>
              </div>

              {(!product.transactions || product.transactions.length === 0) ? (
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-500 text-center">
                  No stock movements recorded yet.
                </div>
              ) : (
                <div className="border border-stone-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] bg-stone-50">
                        <th className="py-2.5 px-3 font-semibold">Type</th>
                        <th className="py-2.5 px-3 font-semibold">Qty</th>
                        <th className="py-2.5 px-3 font-semibold">Before</th>
                        <th className="py-2.5 px-3 font-semibold">After</th>
                        <th className="py-2.5 px-3 font-semibold">Notes</th>
                        <th className="py-2.5 px-3 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {product.transactions.map((t) => {
                        const isPositive = t.quantity > 0;
                        return (
                          <tr key={t.id} className="hover:bg-stone-50">
                            <td className="py-2.5 px-3 font-semibold text-[11px]">
                              <span
                                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isPositive
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : 'bg-rose-50 text-rose-800'
                                }`}
                              >
                                <span>{t.transaction_type}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold">
                              {isPositive ? `+${t.quantity}` : t.quantity} {product.unit}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-stone-500">{t.stock_before}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-stone-900">
                              {t.stock_after}
                            </td>
                            <td className="py-2.5 px-3 text-stone-600 text-[11px]">
                              {t.notes || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-stone-400 text-[11px]">
                              {new Date(t.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {product && (
          <div className="px-6 py-4 border-t border-stone-200 bg-stone-50/70 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
            >
              Close
            </button>

            {isAdmin && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAdjustStock(product);
                  }}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800 rounded-lg text-xs font-semibold shadow-xs transition-colors"
                >
                  Adjust Physical Stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditProduct(product);
                  }}
                  className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                >
                  Edit Product & Pricing
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
