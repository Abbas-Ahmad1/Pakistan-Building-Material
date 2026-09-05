import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { apiRequest } from '../services/api';
import { DashboardMetrics } from '../types';
import { StatCard } from '../components/dashboard/StatCard';
import { SalesChart } from '../components/dashboard/SalesChart';
import { LowStockAlert } from '../components/dashboard/LowStockAlert';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  Package,
  Boxes,
  AlertTriangle,
  PackageX,
  Users,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  PlusCircle,
  Receipt,
  ShoppingCart,
  Calendar,
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { formatCurrency, settings } = useSettings();
  const isAdmin = user?.role === 'ADMIN';

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [range, setRange] = useState<string>('7days');
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async (selectedRange = range) => {
    setIsLoading(true);
    setError(null);
    const res = await apiRequest<DashboardMetrics>(`/api/dashboard/metrics?range=${selectedRange}`);
    if (res.success && res.data) {
      setMetrics(res.data);
    } else {
      setError(res.message || 'Failed to load dynamic database metrics.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMetrics(range);
  }, [range, user?.role]);

  const handleRangeChange = (newRange: string) => {
    setRange(newRange);
  };

  if (isLoading && !metrics) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-700" />
          <span className="text-sm font-medium text-stone-600">Calculating real-time database metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto bg-stone-50">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center space-x-2">
            <span>{isAdmin ? 'Executive Business Dashboard' : 'Cashier Terminal Dashboard'}</span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time ledger summary for{' '}
            <span className="font-semibold text-stone-700">{settings.store_name}</span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => fetchMetrics(range)}
            title="Refresh database records"
            className="p-2 bg-white border border-stone-200 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-700' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Open POS Terminal</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Row 1: Today's Primary Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={formatCurrency(metrics?.todaySales || 0)}
          subtitle={`${metrics?.todayOrdersCount || 0} invoices issued today`}
          icon={DollarSign}
          variant="success"
        />

        {isAdmin ? (
          <StatCard
            title="Today's Gross Profit"
            value={formatCurrency(metrics?.todayProfit || 0)}
            subtitle="Based on actual COGS purchase costs"
            icon={TrendingUp}
            variant="default"
          />
        ) : (
          <StatCard
            title="Shift Orders"
            value={`${metrics?.todayOrdersCount || 0}`}
            subtitle="Completed sales today"
            icon={Receipt}
            variant="default"
          />
        )}

        {isAdmin ? (
          <StatCard
            title="Today's Expenses"
            value={formatCurrency(metrics?.todayExpenses || 0)}
            subtitle="Recorded store operational costs"
            icon={CreditCard}
            variant="danger"
          />
        ) : (
          <StatCard
            title="Active Products"
            value={`${metrics?.totalProducts || 0}`}
            subtitle="Available in catalog"
            icon={Package}
            variant="info"
          />
        )}

        <StatCard
          title="Stock Alerts"
          value={`${(metrics?.lowStockCount || 0) + (metrics?.outOfStockCount || 0)} Items`}
          subtitle={`${metrics?.outOfStockCount || 0} out of stock, ${metrics?.lowStockCount || 0} low`}
          icon={AlertTriangle}
          variant={(metrics?.outOfStockCount || 0) > 0 ? 'danger' : 'warning'}
          badge="Attention"
        />
      </div>

      {/* Row 2: Secondary Store Capital & Balance Ledgers (Admin Only) */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Inventory (Cost)"
            value={formatCurrency(metrics?.totalInventoryCostValue || 0)}
            subtitle={`Retail value: ${formatCurrency(metrics?.totalInventoryRetailValue || 0)}`}
            icon={Boxes}
            variant="info"
          />

          <StatCard
            title="Catalog Items"
            value={`${metrics?.totalProducts || 0} SKUs`}
            subtitle="Active hardware & sanitary items"
            icon={Package}
            variant="default"
          />

          <StatCard
            title="Customer Credit Due"
            value={formatCurrency(metrics?.customerOutstandingBalance || 0)}
            subtitle={`Across ${metrics?.totalCustomers || 0} registered trade customers`}
            icon={Users}
            variant="warning"
          />

          <StatCard
            title="Supplier Payables"
            value={formatCurrency(metrics?.supplierPayableBalance || 0)}
            subtitle={`Due to ${metrics?.totalSuppliers || 0} product manufacturers`}
            icon={Truck}
            variant="danger"
          />
        </div>
      )}

      {/* Row 3: Interactive Recharts Sales Trend & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SalesChart
            data={metrics?.chartData || []}
            range={range}
            onRangeChange={handleRangeChange}
            isAdmin={isAdmin}
          />
        </div>

        <div className="lg:col-span-1">
          <LowStockAlert
            products={metrics?.lowStockProducts || []}
            onNavigateToProducts={() => onNavigate('products')}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      {/* Row 4: Recent Real-Time Transactions Feed */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">Recent Store Invoices</h3>
            <p className="text-xs text-stone-500">Live sales recorded in database</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center space-x-1"
          >
            <span>View All Invoices</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {(!metrics?.recentSales || metrics.recentSales.length === 0) ? (
          <p className="text-xs text-stone-500 text-center py-6">No sales recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-2 font-semibold">Invoice #</th>
                  <th className="py-2.5 px-2 font-semibold">Customer</th>
                  <th className="py-2.5 px-2 font-semibold">Cashier</th>
                  <th className="py-2.5 px-2 font-semibold">Date & Time</th>
                  <th className="py-2.5 px-2 font-semibold">Payment</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Total</th>
                  <th className="py-2.5 px-2 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {metrics.recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-2 font-mono font-bold text-amber-800">
                      {sale.invoice_number}
                    </td>
                    <td className="py-3 px-2 font-medium text-stone-900">{sale.customer_name}</td>
                    <td className="py-3 px-2 text-stone-600">{sale.cashier_name}</td>
                    <td className="py-3 px-2 text-stone-500">
                      {new Date(sale.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-2 text-stone-700 font-medium">{sale.payment_method}</td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-stone-900">
                      {formatCurrency(sale.grand_total)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sale.payment_status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sale.payment_status === 'PARTIAL'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {sale.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
