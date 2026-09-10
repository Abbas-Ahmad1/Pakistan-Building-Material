import React, { useState, useEffect } from 'react';
import {
  Building2,
  Boxes,
  ArrowLeftRight,
  TrendingUp,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  User,
  ShieldCheck,
  Package,
  Calendar,
  Layers,
  ArrowUpRight,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { apiRequest } from '../services/api';
import {
  Branch,
  ProductBranchStockMatrix,
  StockTransfer,
  BranchAnalyticsData,
} from '../types';
import { StockTransferModal } from '../components/branches/StockTransferModal';
import { BranchFormModal } from '../components/branches/BranchFormModal';

export const MultiBranchView: React.FC = () => {
  const { user, branches, refreshBranches, currentBranch, switchBranch } = useAuth();
  const { formatCurrency } = useSettings();

  const [activeTab, setActiveTab] = useState<'matrix' | 'transfers' | 'analytics' | 'branches'>('matrix');

  // Data States
  const [stockMatrix, setStockMatrix] = useState<ProductBranchStockMatrix[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [analytics, setAnalytics] = useState<BranchAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filters for Matrix
  const [matrixSearch, setMatrixSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [cementOnly, setCementOnly] = useState(false);

  // Modals
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Quick cement brands list requested by user
  const cementBrands = [
    'Falcon Cement',
    'Lucky Cement',
    'Fauji Cement (FCCL)',
    'Bestway Cement',
    'Cherat Cement',
    'D.G. Khan Cement (DGKC)',
    'Maple Leaf Cement',
    'Kohat Cement',
    'Pioneer Cement',
    'Power Cement',
  ];

  // Fetch Matrix
  const fetchStockMatrix = async () => {
    try {
      const res = await apiRequest<ProductBranchStockMatrix[]>('/api/branches/stock-matrix');
      if (res.success && res.data) {
        setStockMatrix(res.data);
      }
    } catch (e) {
      console.error('Error fetching stock matrix:', e);
    }
  };

  // Fetch Transfers
  const fetchTransfers = async () => {
    try {
      const res = await apiRequest<StockTransfer[]>('/api/branches/transfers?limit=50');
      if (res.success && res.data) {
        setTransfers(res.data);
      }
    } catch (e) {
      console.error('Error fetching transfers:', e);
    }
  };

  // Fetch Analytics
  const fetchAnalytics = async () => {
    try {
      const res = await apiRequest<BranchAnalyticsData>('/api/branches/analytics/overview');
      if (res.success && res.data) {
        setAnalytics(res.data);
      }
    } catch (e) {
      console.error('Error fetching analytics:', e);
    }
  };

  const loadAll = async () => {
    setIsLoading(true);
    await Promise.all([
      refreshBranches(),
      fetchStockMatrix(),
      fetchTransfers(),
      fetchAnalytics(),
    ]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Filtered Stock Matrix
  const filteredMatrix = stockMatrix.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(matrixSearch.toLowerCase()) ||
      item.sku.toLowerCase().includes(matrixSearch.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(matrixSearch.toLowerCase()));

    const matchesBrand =
      brandFilter === 'ALL' ||
      (item.brand && item.brand.toLowerCase() === brandFilter.toLowerCase());

    const matchesCement = !cementOnly || item.category_name?.toLowerCase().includes('cement');

    return matchesSearch && matchesBrand && matchesCement;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-100 overflow-hidden">
      {/* Top Banner / Navigation */}
      <div className="bg-white border-b border-stone-200 px-6 py-4 shrink-0 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-black text-stone-900 tracking-tight flex items-center space-x-2">
                  <span>Multi-Branch & Cashier Shift Tracking</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase tracking-wider">
                    {branches.length} Stores Online
                  </span>
                </h1>
                <p className="text-xs text-stone-500 font-medium">
                  Branch-wise live inventory matrix, stock transfers, and cashier audit trail
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions & Active Terminal Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Active Switcher */}
            <div className="flex items-center bg-stone-50 border border-stone-300 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-[11px] font-bold text-stone-500 mr-2">Operating Branch:</span>
              <select
                value={user?.branch_id || currentBranch?.id || 1}
                onChange={async (e) => {
                  const bId = Number(e.target.value);
                  await switchBranch(bId);
                  loadAll();
                }}
                className="bg-transparent font-bold text-stone-900 focus:outline-none cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code}){b.is_main ? ' ★ Main' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowTransferModal(true)}
              className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Transfer Stock</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingBranch(null);
                setShowBranchModal(true);
              }}
              className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Branch</span>
            </button>

            <button
              type="button"
              onClick={loadAll}
              title="Refresh All Data"
              className="p-2 border border-stone-300 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-stone-200">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 transition-colors ${
              activeTab === 'matrix'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Branch-Wise Stock Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transfers')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 transition-colors ${
              activeTab === 'transfers'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Inter-Branch Transfers ({transfers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 transition-colors ${
              activeTab === 'analytics'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Admin Multi-Branch Analytics & Cashiers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branches')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 transition-colors ${
              activeTab === 'branches'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Store Locations Directory ({branches.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ================= TAB 1: STOCK MATRIX ================= */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            {/* Example Banner matching user prompt */}
            <div className="bg-gradient-to-r from-amber-900 to-stone-900 text-white p-4 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="px-2 py-0.5 bg-amber-500/30 text-amber-300 text-[10px] font-bold rounded uppercase tracking-wide">
                  Live Multi-Store Inventory Matrix
                </span>
                <h3 className="text-sm font-bold">
                  Per-Branch Stock Breakdown (Falcon Cement, Fauji, Lucky, Cherat, Bestway & More)
                </h3>
                <p className="text-xs text-stone-300">
                  Example: <strong>Falcon Cement</strong> has 50 bags in Branch 1 (Main Store), 20 bags in Branch 2 (Gulberg), and 0 in Branch 3.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(true)}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                >
                  Move Stock Between Stores →
                </button>
              </div>
            </div>

            {/* Matrix Filters */}
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2 flex-1 min-w-[280px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search by product name, SKU, brand (e.g. Falcon, Bestway, PVC)..."
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
                  />
                </div>

                {matrixSearch && (
                  <button
                    type="button"
                    onClick={() => setMatrixSearch('')}
                    className="text-xs text-stone-500 hover:text-stone-800 font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Cement Quick Toggle */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCementOnly(!cementOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    cementOnly
                      ? 'bg-amber-800 text-white border-amber-900'
                      : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                  }`}
                >
                  {cementOnly ? '✓ Cement & Aggregates Only' : 'Filter Cement Brands'}
                </button>

                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="py-1.5 px-3 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="ALL">All Brands ({stockMatrix.length} items)</option>
                  {cementBrands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Cement Brand Filter Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider shrink-0">
                Cement Brands:
              </span>
              <button
                type="button"
                onClick={() => setBrandFilter('ALL')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  brandFilter === 'ALL'
                    ? 'bg-stone-900 text-white'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                All Brands
              </button>
              {cementBrands.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => setBrandFilter(brand)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                    brandFilter === brand
                      ? 'bg-amber-800 text-white'
                      : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>

            {/* Matrix Table */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-900 text-white uppercase text-[11px] font-bold">
                    <tr>
                      <th className="py-3 px-4">Item Details</th>
                      <th className="py-3 px-3">Brand & Category</th>
                      <th className="py-3 px-3 text-center bg-stone-800">Total System Stock</th>
                      {branches.map((branch) => (
                        <th key={branch.id} className="py-3 px-3 text-center border-l border-stone-800">
                          <div className="flex flex-col items-center">
                            <span>{branch.name}</span>
                            <span className="text-[9px] font-normal text-amber-400 font-mono">
                              ({branch.code}){branch.is_main ? ' ★' : ''}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th className="py-3 px-4 text-center">Transfer Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {filteredMatrix.length === 0 ? (
                      <tr>
                        <td colSpan={4 + branches.length} className="py-8 text-center text-stone-400">
                          No products found matching your search or filters.
                        </td>
                      </tr>
                    ) : (
                      filteredMatrix.map((item) => (
                        <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-stone-900">{item.name}</div>
                            <div className="text-[10px] text-stone-500 font-mono">
                              SKU: {item.sku} | Unit: {item.unit}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-stone-800">{item.brand || 'General'}</span>
                            <div className="text-[10px] text-stone-500">{item.category_name || 'Hardware'}</div>
                          </td>
                          <td className="py-3 px-3 text-center bg-stone-50/60 font-mono font-black text-sm text-stone-900">
                            {item.total_stock} <span className="text-[10px] font-normal text-stone-500">{item.unit}</span>
                          </td>
                          {branches.map((branch) => {
                            const bStock = item.branches?.find((b) => b.branch_id === branch.id);
                            const stockCount = bStock ? bStock.current_stock : 0;
                            const isOut = stockCount <= 0;
                            const isLow = stockCount > 0 && stockCount <= (item.minimum_stock || 5);

                            return (
                              <td key={branch.id} className="py-3 px-3 text-center border-l border-stone-100">
                                <span
                                  className={`inline-block font-mono font-bold px-2.5 py-1 rounded text-xs ${
                                    isOut
                                      ? 'bg-rose-100 text-rose-800'
                                      : isLow
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {stockCount} {item.unit}
                                </span>
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setShowTransferModal(true)}
                              className="px-2.5 py-1 bg-stone-100 hover:bg-amber-600 hover:text-white text-stone-700 rounded font-bold text-xs transition-colors border border-stone-300 shadow-2xs"
                              title={`Transfer ${item.name} between stores`}
                            >
                              Transfer
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
        )}

        {/* ================= TAB 2: INTER-BRANCH TRANSFERS ================= */}
        {activeTab === 'transfers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Stock Transfer Audit Logs</h3>
                <p className="text-xs text-stone-500">
                  History of inventory dispatched and received across branches
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowTransferModal(true)}
                className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Stock Transfer</span>
              </button>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 text-stone-700 uppercase font-bold text-[10px] border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Transfer #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Source Store (From)</th>
                    <th className="py-3 px-3">Destination Store (To)</th>
                    <th className="py-3 px-3 text-center">Items Transferred</th>
                    <th className="py-3 px-3 text-center">Total Units</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4">Created By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-stone-400">
                        No stock transfers recorded yet. Click "New Stock Transfer" to move goods.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((t) => (
                      <tr key={t.id} className="hover:bg-stone-50">
                        <td className="py-3 px-4 font-mono font-bold text-stone-900">
                          {t.transfer_number}
                        </td>
                        <td className="py-3 px-3 text-stone-600">
                          {new Date(t.transfer_date).toLocaleDateString('en-PK')}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-stone-900">{t.from_branch_name}</span>
                          <span className="text-[10px] text-stone-500 ml-1">({t.from_branch_code})</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-stone-900">{t.to_branch_name}</span>
                          <span className="text-[10px] text-stone-500 ml-1">({t.to_branch_code})</span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-stone-800">
                          {t.items_count || 1} item(s)
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-amber-800">
                          {t.total_quantity || 0} units
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-stone-700">
                          {t.created_by_name || 'Admin'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 3: ADMIN MULTI-BRANCH ANALYTICS ================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Branch Performance Comparison Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-stone-900">Comparative Store Performance</h3>
                <span className="text-xs text-stone-500">Live aggregated metrics per branch</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(analytics?.branch_performance || []).map((bp) => (
                  <div
                    key={bp.branch_id}
                    className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                      <div>
                        <h4 className="font-black text-sm text-stone-900">{bp.branch_name}</h4>
                        <span className="text-[10px] font-mono text-stone-500 uppercase font-bold">
                          Code: {bp.branch_code} {bp.is_main ? '• Central Store' : ''}
                        </span>
                      </div>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          bp.is_main ? 'bg-amber-600' : 'bg-emerald-500'
                        }`}
                      />
                    </div>

                    {/* Today's Sales */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-stone-50 p-2 rounded-lg">
                        <span className="text-[10px] text-stone-500 font-bold uppercase">Today's Sales</span>
                        <div className="font-black text-stone-900 text-sm">
                          Rs. {bp.today.revenue.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-stone-500">{bp.today.orders} orders</span>
                      </div>

                      <div className="bg-emerald-50 p-2 rounded-lg">
                        <span className="text-[10px] text-emerald-700 font-bold uppercase">Cash Collected</span>
                        <div className="font-black text-emerald-900 text-sm">
                          Rs. {bp.today.paid.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-emerald-600">Today</span>
                      </div>
                    </div>

                    {/* Inventory Overview */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
                      <span>Store Stock:</span>
                      <strong className="text-stone-900">
                        {bp.inventory.total_units?.toLocaleString() || 0} units ({bp.inventory.total_products || 0} products)
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-600">
                      <span>Stock Valuation (Cost):</span>
                      <strong className="text-stone-900">
                        Rs. {(bp.inventory.total_cost_value || 0).toLocaleString()}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span>Low / Out of Stock:</span>
                      <span className="font-bold text-rose-700">
                        {bp.inventory.low_stock + bp.inventory.out_of_stock} items
                      </span>
                    </div>

                    {/* All-Time Stats */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
                      <span>Total All-Time Revenue:</span>
                      <strong className="text-amber-900 font-bold">
                        Rs. {bp.all_time.revenue.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cashier Shift Reconciliation & Collection Table */}
            <div className="space-y-3 pt-4 border-t border-stone-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    Cashier Shift Tracking & Till Reconciliation (All Stores)
                  </h3>
                  <p className="text-xs text-stone-500">
                    Audit trail of invoices billed, cash collected, refunds, and net cash in hand per cashier
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 bg-stone-100 text-stone-700 text-xs font-bold rounded-lg border border-stone-300">
                    Daily Shift Audit
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-900 text-white uppercase font-bold text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Cashier Name</th>
                      <th className="py-3 px-3">Branch Location</th>
                      <th className="py-3 px-3 text-center">Invoices Billed</th>
                      <th className="py-3 px-3 text-right">Total Billed (Rs.)</th>
                      <th className="py-3 px-3 text-right">Cash In Till</th>
                      <th className="py-3 px-3 text-right">Card / Bank Pay</th>
                      <th className="py-3 px-3 text-right">Refunds Paid</th>
                      <th className="py-3 px-4 text-right bg-stone-800">Net Cash In Hand</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {(analytics?.cashier_collections || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-stone-400">
                          No sales transactions logged under cashiers yet.
                        </td>
                      </tr>
                    ) : (
                      (analytics?.cashier_collections || []).map((row, idx) => (
                        <tr key={idx} className="hover:bg-stone-50">
                          <td className="py-3 px-4 font-bold text-stone-900 flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px]">
                              {row.cashier_name.charAt(0)}
                            </div>
                            <span>{row.cashier_name}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-stone-800">{row.branch_name}</span>
                            <span className="text-[10px] text-stone-500 ml-1">({row.branch_code})</span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold font-mono">
                            {row.invoices_count}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-stone-800">
                            Rs. {row.total_billed.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-700 font-bold">
                            Rs. {row.cash_collected.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-stone-600">
                            Rs. {row.bank_card_collected.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-rose-700">
                            {row.cash_refund > 0 ? `-Rs. ${row.cash_refund.toLocaleString()}` : 'Rs. 0'}
                          </td>
                          <td className="py-3 px-4 text-right bg-stone-50/70 font-mono font-black text-sm text-emerald-800">
                            Rs. {row.net_cash_in_hand.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: STORE DIRECTORY ================= */}
        {activeTab === 'branches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Branch Locations Directory</h3>
                <p className="text-xs text-stone-500">
                  Manage physical store locations, warehouses, manager contacts, and addresses
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingBranch(null);
                  setShowBranchModal(true);
                }}
                className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Store Location</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {branches.map((b) => (
                <div
                  key={b.id}
                  className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-800 font-bold">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-stone-900">{b.name}</h4>
                          <span className="font-mono text-[10px] font-bold text-stone-500">
                            Code: {b.code}
                          </span>
                        </div>
                      </div>
                      {Boolean(b.is_main) && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-black rounded uppercase">
                          Central Hub
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-stone-600 space-y-1 pt-2 border-t border-stone-100">
                      <div>
                        <strong className="text-stone-700">Address:</strong> {b.address || 'Not specified'}
                      </div>
                      <div>
                        <strong className="text-stone-700">Phone:</strong> {b.phone || 'Not specified'}
                      </div>
                      <div>
                        <strong className="text-stone-700">Manager:</strong> {b.manager_name || 'Not assigned'}
                      </div>
                      <div>
                        <strong className="text-stone-700">Status:</strong>{' '}
                        <span
                          className={`font-bold ${
                            b.status === 'ACTIVE' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={async () => {
                        await switchBranch(b.id);
                        loadAll();
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                        (user?.branch_id || 1) === b.id
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                      }`}
                    >
                      {(user?.branch_id || 1) === b.id ? '✓ Current Terminal' : 'Set as Current'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingBranch(b);
                        setShowBranchModal(true);
                      }}
                      className="p-1.5 text-stone-400 hover:text-stone-800 rounded transition-colors"
                      title="Edit Branch Information"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stock Transfer Modal */}
      {showTransferModal && (
        <StockTransferModal
          branches={branches}
          stockMatrix={stockMatrix}
          onClose={() => setShowTransferModal(false)}
          onTransferSuccess={() => {
            loadAll();
          }}
        />
      )}

      {/* Branch Form Modal */}
      {showBranchModal && (
        <BranchFormModal
          branch={editingBranch}
          onClose={() => {
            setShowBranchModal(false);
            setEditingBranch(null);
          }}
          onSuccess={() => {
            loadAll();
          }}
        />
      )}
    </div>
  );
};
