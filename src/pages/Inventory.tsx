import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { apiRequest } from '../services/api';
import { Product, InventorySummary, InventoryTransaction } from '../types';
import { StockAdjustmentModal } from '../components/inventory/StockAdjustmentModal';
import { ProductDetailModal } from '../components/products/ProductDetailModal';
import {
  Boxes,
  TrendingUp,
  AlertTriangle,
  PackageX,
  History,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Eye,
  SlidersHorizontal,
  CheckCircle2,
  DollarSign,
  Package,
  Building2,
} from 'lucide-react';

interface InventoryProps {
  onNavigate?: (view: string) => void;
}

export const Inventory: React.FC<InventoryProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'valuation' | 'ledger'>('valuation');
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters for Tab 1 (Valuation)
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out' | 'in_stock'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Filters for Tab 2 (Ledger)
  const [transTypeFilter, setTransTypeFilter] = useState<string>('all');

  // Modals
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [detailProductId, setDetailProductId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSummary = async () => {
    const res = await apiRequest<InventorySummary>('/api/inventory/summary');
    if (res.success && res.data) {
      setSummary(res.data);
    }
  };

  const fetchProducts = async () => {
    const res = await apiRequest<Product[]>('/api/products?limit=250');
    if (res.success && res.data) {
      setProducts(res.data);
    }
  };

  const fetchTransactions = async () => {
    let url = '/api/inventory/transactions?limit=100';
    if (transTypeFilter !== 'all') {
      url += `&transaction_type=${transTypeFilter}`;
    }
    const res = await apiRequest<InventoryTransaction[]>(url);
    if (res.success && res.data) {
      setTransactions(res.data);
    }
  };

  const refreshAll = async () => {
    setIsLoading(true);
    await Promise.all([fetchSummary(), fetchProducts(), fetchTransactions()]);
    setIsLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchTransactions();
    }
  }, [transTypeFilter, activeTab]);

  // Filtered products list for valuation table
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (stockStatusFilter === 'out') return p.current_stock <= 0;
    if (stockStatusFilter === 'low') return p.current_stock > 0 && p.current_stock <= p.minimum_stock;
    if (stockStatusFilter === 'in_stock') return p.current_stock > p.minimum_stock;

    return true;
  });

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center space-x-2">
            <span>Inventory Valuation & Stock Audit Ledger</span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time physical stock monitoring, valuation at cost vs retail, and forensic movement trail
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={refreshAll}
            title="Refresh database records"
            className="p-2 bg-white border border-stone-200 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-700' : ''}`} />
          </button>

          {isAdmin && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('branches')}
              className="flex items-center space-x-1.5 px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Building2 className="w-4 h-4 text-amber-400" />
              <span>Multi-Branch Matrix</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setSelectedProduct(null);
                setIsAdjustModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Boxes className="w-4 h-4" />
              <span>Stock Adjustment</span>
            </button>
          )}
        </div>
      </div>

      {notification && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{notification.text}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-stone-400 hover:text-stone-600"
          >
            &times;
          </button>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin && (
          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
              Total Inventory (Cost)
            </span>
            <div className="text-xl font-bold font-mono text-stone-900 mt-1">
              {formatCurrency(summary?.total_cost_value || 0)}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Capital tied up at purchase prices
            </p>
          </div>
        )}

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
            Total Inventory (Retail)
          </span>
          <div className="text-xl font-bold font-mono text-stone-900 mt-1">
            {formatCurrency(summary?.total_retail_value || 0)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            Realizable value at current selling prices
          </p>
        </div>

        {isAdmin && (
          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
              Potential Gross Profit
            </span>
            <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
              {formatCurrency(summary?.potential_profit || 0)}
            </div>
            <p className="text-[11px] text-emerald-600 mt-1">
              Margin on current inventory liquidation
            </p>
          </div>
        )}

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
            Physical Units & SKUs
          </span>
          <div className="text-xl font-bold font-mono text-stone-900 mt-1">
            {summary?.total_units || 0} <span className="text-xs font-normal text-stone-500">units</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            Across {summary?.total_items || 0} catalog hardware products
          </p>
        </div>
      </div>

      {/* Stock Alerts Notice Bar */}
      {((summary?.low_stock_count || 0) > 0 || (summary?.out_of_stock_count || 0) > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-200/80 text-amber-900 flex items-center justify-center font-bold shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-800" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-900">
                Inventory Reorder Thresholds Triggered
              </h3>
              <p className="text-xs text-amber-800/90 mt-0.5">
                {summary?.out_of_stock_count || 0} item(s) are completely out of stock and{' '}
                {summary?.low_stock_count || 0} item(s) have reached minimum reorder levels.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('valuation');
              setStockStatusFilter('low');
            }}
            className="px-3 py-1.5 bg-amber-800 text-white rounded-lg text-xs font-semibold hover:bg-amber-900 transition-colors shadow-xs shrink-0"
          >
            Review Low Stock Items
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="border-b border-stone-200 flex space-x-6">
        <button
          type="button"
          onClick={() => setActiveTab('valuation')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'valuation'
              ? 'border-amber-800 text-amber-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Stock Valuation & Thresholds ({filteredProducts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'ledger'
              ? 'border-amber-800 text-amber-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Stock Movement Ledger (Audit Log)</span>
        </button>
      </div>

      {/* Tab 1: Valuation Table */}
      {activeTab === 'valuation' && (
        <div className="space-y-4">
          {/* Controls Strip */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-72">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products by SKU or name..."
                className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs text-stone-500 font-medium">Filter:</span>
              <div className="flex rounded-lg border border-stone-200 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStockStatusFilter('all')}
                  className={`px-3 py-1 rounded font-semibold transition-colors ${
                    stockStatusFilter === 'all'
                      ? 'bg-amber-800 text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setStockStatusFilter('low')}
                  className={`px-3 py-1 rounded font-semibold transition-colors ${
                    stockStatusFilter === 'low'
                      ? 'bg-amber-800 text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Low Stock
                </button>
                <button
                  type="button"
                  onClick={() => setStockStatusFilter('out')}
                  className={`px-3 py-1 rounded font-semibold transition-colors ${
                    stockStatusFilter === 'out'
                      ? 'bg-amber-800 text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Out of Stock
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] bg-stone-50/50">
                    <th className="py-3 px-4 font-semibold">SKU & Item Name</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Current Stock</th>
                    <th className="py-3 px-4 font-semibold">Safety Min</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    {isAdmin && (
                      <th className="py-3 px-4 font-semibold text-right">Cost Value</th>
                    )}
                    <th className="py-3 px-4 font-semibold text-right">Retail Value</th>
                    <th className="py-3 px-4 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredProducts.map((p) => {
                    const isOutOfStock = p.current_stock <= 0;
                    const isLowStock = p.current_stock > 0 && p.current_stock <= p.minimum_stock;
                    const costVal = p.current_stock * p.purchase_price;
                    const retailVal = p.current_stock * p.selling_price;

                    return (
                      <tr key={p.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailProductId(p.id);
                              setIsDetailModalOpen(true);
                            }}
                            className="font-semibold text-stone-900 hover:text-amber-800 text-left line-clamp-1 transition-colors"
                          >
                            {p.name}
                          </button>
                          <span className="font-mono text-[10px] text-stone-500 block">
                            SKU: {p.sku}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-stone-600">{p.category_name}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isOutOfStock
                                ? 'text-red-700'
                                : isLowStock
                                ? 'text-amber-700'
                                : 'text-emerald-800'
                            }`}
                          >
                            {p.current_stock}
                          </span>{' '}
                          <span className="text-[11px] text-stone-500">{p.unit}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-stone-600">
                          {p.minimum_stock} {p.unit}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              isOutOfStock
                                ? 'bg-red-100 text-red-800'
                                : isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isOutOfStock ? 'OUT OF STOCK' : isLowStock ? 'LOW STOCK' : 'HEALTHY'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right font-mono font-semibold text-stone-800">
                            {formatCurrency(costVal)}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                          {formatCurrency(retailVal)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setDetailProductId(p.id);
                                setIsDetailModalOpen(true);
                              }}
                              title="View Details"
                              className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProduct(p);
                                  setIsAdjustModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded text-[10px] font-bold flex items-center space-x-1 transition-colors"
                              >
                                <Boxes className="w-3 h-3" />
                                <span>Adjust</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Stock Movement Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
                Transaction Type Filter:
              </span>
              <select
                value={transTypeFilter}
                onChange={(e) => setTransTypeFilter(e.target.value)}
                className="px-3 py-1.5 border border-stone-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-600 focus:outline-none"
              >
                <option value="all">All Movements</option>
                <option value="OPENING_STOCK">Opening Stock</option>
                <option value="PURCHASE">Purchases Inward</option>
                <option value="SALE">Sales Outward</option>
                <option value="ADJUSTMENT_IN">Manual Adjustment (In)</option>
                <option value="ADJUSTMENT_OUT">Manual Adjustment (Out)</option>
              </select>
            </div>

            <span className="text-xs text-stone-500">
              Showing last <strong className="text-stone-800">{transactions.length}</strong> recorded movements
            </span>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] bg-stone-50/50">
                    <th className="py-3 px-4 font-semibold">Date & Time</th>
                    <th className="py-3 px-4 font-semibold">Product</th>
                    <th className="py-3 px-4 font-semibold">Transaction Type</th>
                    <th className="py-3 px-4 font-semibold">Quantity</th>
                    <th className="py-3 px-4 font-semibold">Stock Before</th>
                    <th className="py-3 px-4 font-semibold">Stock After</th>
                    <th className="py-3 px-4 font-semibold">Notes / Reason</th>
                    <th className="py-3 px-4 font-semibold">Staff Member</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {transactions.map((t) => {
                    const isPositive = t.quantity > 0;
                    return (
                      <tr key={t.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">
                          {new Date(t.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-stone-900 block">{t.product_name}</span>
                          <span className="font-mono text-[10px] text-stone-400">SKU: {t.sku}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.transaction_type === 'PURCHASE' || t.transaction_type === 'ADJUSTMENT_IN' || t.transaction_type === 'OPENING_STOCK'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {t.transaction_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          <span className={isPositive ? 'text-emerald-700' : 'text-rose-700'}>
                            {isPositive ? `+${t.quantity}` : t.quantity} {t.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-stone-500">{t.stock_before}</td>
                        <td className="py-3 px-4 font-mono font-bold text-stone-900">
                          {t.stock_after}
                        </td>
                        <td className="py-3 px-4 text-stone-600 text-[11px] max-w-xs truncate">
                          {t.notes || '—'}
                        </td>
                        <td className="py-3 px-4 text-stone-500 text-[11px]">
                          {t.user_name || 'System'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <StockAdjustmentModal
        isOpen={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false);
          setSelectedProduct(null);
        }}
        onSuccess={() => {
          refreshAll();
          setNotification({
            type: 'success',
            text: 'Physical stock adjusted and logged in inventory transactions.',
          });
        }}
        product={selectedProduct}
        allProducts={products}
      />

      <ProductDetailModal
        productId={detailProductId}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailProductId(null);
        }}
        onAdjustStock={(p) => {
          setSelectedProduct(p);
          setIsAdjustModalOpen(true);
        }}
        onEditProduct={() => {
          setIsDetailModalOpen(false);
        }}
      />
    </div>
  );
};
