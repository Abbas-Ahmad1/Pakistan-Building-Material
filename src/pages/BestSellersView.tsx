import React, { useState, useEffect } from 'react';
import {
  Flame,
  AlertTriangle,
  Clock,
  TrendingUp,
  Package,
  Boxes,
  RefreshCw,
  ShoppingBag,
  ArrowUpRight,
  DollarSign,
} from 'lucide-react';
import { apiRequest } from '../services/api';

export const BestSellersView: React.FC = () => {
  const [data, setData] = useState<{
    bestsellers: any[];
    low_stock: any[];
    dead_stock: any[];
  }>({
    bestsellers: [],
    low_stock: [],
    dead_stock: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<any>('/api/reports/bestsellers');
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Error fetching bestsellers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-stone-900 tracking-tight flex items-center space-x-2">
            <Flame className="w-6 h-6 text-amber-600" />
            <span>Best Sellers & Inventory Velocity</span>
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Identify your highest-grossing products, fast-moving items, low-stock restock alerts, and dormant capital.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-bold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-stone-400 bg-white rounded-xl border border-stone-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
          Calculating product velocity & sales ranks...
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: TOP BEST SELLERS */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-stone-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Flame className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-sm">Top 15 Fast-Moving & Highest Revenue Products</h2>
              </div>
              <span className="text-xs text-stone-400">Ranked by volume & turnover</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 text-stone-600 font-bold uppercase border-b border-stone-200 text-[10px] tracking-wider">
                    <th className="py-3 px-4 text-center">Rank</th>
                    <th className="py-3 px-4">Product Name & SKU</th>
                    <th className="py-3 px-4">Brand / Category</th>
                    <th className="py-3 px-4 text-center">Units Sold</th>
                    <th className="py-3 px-4 text-right">Retail Rate</th>
                    <th className="py-3 px-4 text-right">Total Revenue</th>
                    <th className="py-3 px-4 text-right">Profit Generated</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {data.bestsellers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-stone-400">
                        No sales data available yet to rank products.
                      </td>
                    </tr>
                  ) : (
                    data.bestsellers.map((item, idx) => (
                      <tr key={item.product_id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                              idx === 0
                                ? 'bg-amber-400 text-stone-900'
                                : idx === 1
                                ? 'bg-stone-300 text-stone-900'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-stone-900">{item.product_name}</div>
                          <span className="font-mono text-[10px] text-stone-400">{item.sku}</span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-stone-800">{item.brand || 'Local'}</div>
                          <span className="text-[10px] text-stone-500">{item.category_name}</span>
                        </td>

                        <td className="py-3 px-4 text-center font-black text-blue-700 text-sm">
                          {item.units_sold} <span className="text-[10px] font-normal text-stone-500">{item.unit}</span>
                        </td>

                        <td className="py-3 px-4 text-right font-medium text-stone-700">
                          Rs. {Number(item.selling_price).toLocaleString()}
                        </td>

                        <td className="py-3 px-4 text-right font-black text-stone-900">
                          Rs. {Number(item.total_revenue).toLocaleString()}
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          Rs. {Number(item.total_profit).toLocaleString()}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.current_stock <= 5
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-stone-100 text-stone-800'
                            }`}
                          >
                            {item.current_stock} {item.unit}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 2 & 3: LOW STOCK ALERTS & DEAD STOCK */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Alerts */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-rose-50 border-b border-rose-200 flex justify-between items-center text-rose-900">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    Critical Low Stock Alerts ({data.low_stock.length})
                  </h3>
                </div>
                <span className="text-[10px] font-semibold">Immediate re-order needed</span>
              </div>

              <div className="p-4 space-y-3">
                {data.low_stock.length === 0 ? (
                  <div className="py-8 text-center text-stone-400 text-xs">
                    All inventory stocks are above minimum safety thresholds.
                  </div>
                ) : (
                  data.low_stock.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="font-bold text-stone-900">{item.name}</div>
                        <div className="text-[10px] text-stone-500">
                          {item.brand} • {item.category_name} • SKU: {item.sku}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-black text-sm block ${
                            item.current_stock <= 0 ? 'text-rose-700' : 'text-amber-700'
                          }`}
                        >
                          {item.current_stock} {item.unit} left
                        </span>
                        <span className="text-[10px] text-stone-400">
                          Min Alert: {item.minimum_stock} {item.unit}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dead Stock / Dormant Capital */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-amber-50 border-b border-amber-200 flex justify-between items-center text-amber-900">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    Dormant / Slow-Moving Stock ({data.dead_stock.length})
                  </h3>
                </div>
                <span className="text-[10px] font-semibold">Tied-up working capital</span>
              </div>

              <div className="p-4 space-y-3">
                {data.dead_stock.length === 0 ? (
                  <div className="py-8 text-center text-stone-400 text-xs">
                    No stagnant inventory detected. Product turnover is healthy.
                  </div>
                ) : (
                  data.dead_stock.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="font-bold text-stone-900">{item.name}</div>
                        <div className="text-[10px] text-stone-500">
                          {item.current_stock} {item.unit} in warehouse • {item.category_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-sm text-stone-900 block">
                          Rs. {Number(item.tied_up_capital).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-stone-400">Tied-up purchase cost</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
