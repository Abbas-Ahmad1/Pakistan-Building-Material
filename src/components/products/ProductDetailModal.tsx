import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
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
  History,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
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
  const { formatCurrency } = useSettings();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [product, setProduct] = useState<(Product & { transactions?: any[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    }
  }, [productId, isOpen]);

  if (!isOpen || !productId) return null;

  const isLowStock =
    product && product.current_stock > 0 && product.current_stock <= product.minimum_stock;
  const isOutOfStock = product && product.current_stock <= 0;

  const grossMargin =
    product && product.purchase_price > 0
      ? (((product.selling_price - product.purchase_price) / product.purchase_price) * 100).toFixed(1)
      : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading || !product ? (
            <div className="py-12 text-center text-xs text-stone-500">Loading product information...</div>
          ) : (
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
                    <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Markup / Margin</span>
                    <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                      +{grossMargin}%
                    </div>
                    <span className="text-[10px] text-stone-500 mt-1 block">
                      Cost: {formatCurrency(product.purchase_price)}
                    </span>
                  </div>
                )}
              </div>

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

              {/* Recent Inventory Transactions Ledger */}
              {isAdmin && (
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
            </>
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
                  Edit Product
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
