import React, { useState, useEffect } from 'react';
import { ProductPriceHistory, Product } from '../../types';
import { apiRequest } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import {
  X,
  History,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  User,
  Calendar,
  Layers,
  DollarSign,
  AlertCircle,
  FileText,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface PriceHistoryModalProps {
  productId: number | null;
  isOpen: boolean;
  onClose: () => void;
  productName?: string;
  productSku?: string;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  productId,
  isOpen,
  onClose,
  productName,
  productSku,
}) => {
  const { formatCurrency } = useSettings();
  const [history, setHistory] = useState<ProductPriceHistory[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = async () => {
    if (!productId) return;
    setIsLoading(true);
    try {
      const [histRes, prodRes] = await Promise.all([
        apiRequest<ProductPriceHistory[]>(`/api/products/${productId}/price-history`),
        apiRequest<Product>(`/api/products/${productId}`),
      ]);

      if (histRes.success && histRes.data) {
        setHistory(histRes.data);
      }
      if (prodRes.success && prodRes.data) {
        setProduct(prodRes.data);
      }
    } catch (err) {
      console.error('Error fetching price history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && productId) {
      fetchHistory();
    } else {
      setHistory([]);
      setProduct(null);
    }
  }, [isOpen, productId]);

  if (!isOpen || !productId) return null;

  const currentCost = product?.purchase_price ?? 0;
  const currentPrice = product?.selling_price ?? 0;
  const currentMargin =
    currentPrice > 0 ? (((currentPrice - currentCost) / currentPrice) * 100).toFixed(1) : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Price & Cost History Audit Trail
              </h2>
              <div className="flex items-center space-x-2 text-xs text-stone-500 mt-0.5">
                <span className="font-semibold text-stone-800">{productName || product?.name}</span>
                <span className="font-mono text-stone-600 font-medium">
                  (SKU: {productSku || product?.sku})
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={fetchHistory}
              title="Refresh"
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="p-6 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50/30">
          <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block">
              Current Cost
            </span>
            <div className="text-lg font-bold font-mono text-stone-900 mt-0.5">
              {formatCurrency(currentCost)}
            </div>
            {product?.cost_change_percent !== undefined && product.cost_change_percent !== 0 && (
              <span
                className={`inline-flex items-center text-[10px] font-bold font-mono mt-0.5 ${
                  product.cost_change_percent > 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {product.cost_change_percent > 0 ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                )}
                {product.cost_change_percent > 0 ? '+' : ''}
                {product.cost_change_percent}% last shift
              </span>
            )}
          </div>

          <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block">
              Selling Price
            </span>
            <div className="text-lg font-bold font-mono text-stone-900 mt-0.5">
              {formatCurrency(currentPrice)}
            </div>
            <span className="text-[10px] text-stone-400 block mt-0.5">
              Per {product?.unit || 'Unit'}
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block">
              Current Margin
            </span>
            <div className="text-lg font-bold font-mono text-emerald-700 mt-0.5">
              +{currentMargin}%
            </div>
            <span className="text-[10px] text-stone-500 block mt-0.5">
              Profit: {formatCurrency(Math.max(0, currentPrice - currentCost))}
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block">
              Pricing Mode
            </span>
            <div className="text-sm font-bold text-amber-900 mt-1 uppercase">
              {product?.pricing_mode || 'FIXED'}
            </div>
            <span className="text-[10px] text-stone-500 block mt-0.5">
              {product?.auto_price_update ? '⚡ Auto-updating' : 'Manual pricing'}
            </span>
          </div>
        </div>

        {/* History Table */}
        <div className="flex-1 overflow-y-auto p-6 pt-3">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-stone-500 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-700" />
              <span>Loading price history trail...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center text-xs text-stone-400 flex flex-col items-center justify-center">
              <History className="w-8 h-8 text-stone-300 mb-2" />
              <p className="font-semibold text-stone-600">No price adjustments recorded yet</p>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Changes made during purchase inwards or manual edits will be logged here.
              </p>
            </div>
          ) : (
            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] bg-stone-50">
                    <th className="py-3 px-3 font-semibold">Date & Time</th>
                    <th className="py-3 px-3 font-semibold">Purchase Cost</th>
                    <th className="py-3 px-3 font-semibold">Selling Price</th>
                    <th className="py-3 px-3 font-semibold">Mode / Reason</th>
                    <th className="py-3 px-3 font-semibold">Changed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {history.map((h) => {
                    const costDiff = h.new_cost - h.old_cost;
                    const priceDiff = h.new_selling_price - h.old_selling_price;
                    const costPercent = h.cost_change_percent || 0;
                    const pricePercent = h.price_change_percent || 0;

                    return (
                      <tr key={h.id} className="hover:bg-stone-50/70 transition-colors">
                        {/* Timestamp & PO */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-stone-800 text-[11px]">
                            {new Date(h.created_at).toLocaleDateString()}{' '}
                            <span className="text-stone-400 font-normal">
                              {new Date(h.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {h.purchase_number && (
                            <span className="inline-flex items-center text-[10px] font-mono text-amber-800 font-bold bg-amber-50 px-1.5 py-0.2 rounded mt-0.5">
                              PO: {h.purchase_number}
                            </span>
                          )}
                        </td>

                        {/* Purchase Cost */}
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5 font-mono text-xs">
                            <span className="text-stone-400 line-through">
                              {formatCurrency(h.old_cost)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-stone-400 shrink-0" />
                            <span className="font-bold text-stone-900">
                              {formatCurrency(h.new_cost)}
                            </span>
                          </div>
                          {Math.abs(costDiff) > 0.001 && (
                            <span
                              className={`inline-flex items-center text-[10px] font-mono font-bold mt-0.5 px-1.5 py-0.2 rounded ${
                                costDiff > 0
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {costDiff > 0 ? '+' : ''}
                              {costPercent}%
                            </span>
                          )}
                        </td>

                        {/* Selling Price */}
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5 font-mono text-xs">
                            <span className="text-stone-400 line-through">
                              {formatCurrency(h.old_selling_price)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-stone-400 shrink-0" />
                            <span className="font-bold text-amber-900">
                              {formatCurrency(h.new_selling_price)}
                            </span>
                          </div>
                          {Math.abs(priceDiff) > 0.001 && (
                            <span
                              className={`inline-flex items-center text-[10px] font-mono font-bold mt-0.5 px-1.5 py-0.2 rounded ${
                                priceDiff > 0
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-stone-100 text-stone-700'
                              }`}
                            >
                              {priceDiff > 0 ? '+' : ''}
                              {pricePercent}%
                            </span>
                          )}
                        </td>

                        {/* Reason / Mode */}
                        <td className="py-3 px-3">
                          <div className="text-[11px] font-medium text-stone-700">
                            {h.reason || 'Price adjustment'}
                          </div>
                          {h.pricing_mode && (
                            <span className="text-[10px] text-stone-400 uppercase font-mono block mt-0.5">
                              Mode: {h.pricing_mode}
                            </span>
                          )}
                        </td>

                        {/* Changed by */}
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1 text-[11px] text-stone-600">
                            <User className="w-3 h-3 text-stone-400 shrink-0" />
                            <span>{h.user_name || 'System / Admin'}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50/70 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            {history.length} price change record{history.length === 1 ? '' : 's'} logged
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
