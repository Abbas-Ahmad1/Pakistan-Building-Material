import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { apiRequest } from '../../services/api';
import { X, AlertCircle, CheckCircle2, ArrowRight, Boxes, Plus, Minus } from 'lucide-react';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: Product | null;
  allProducts?: Product[];
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  product,
  allProducts = [],
}) => {
  const [selectedProductId, setSelectedProductId] = useState<number | ''>(product?.id || '');
  const [adjustmentType, setAdjustmentType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('ADJUSTMENT_IN');
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setSelectedProductId(product.id);
    } else if (allProducts.length > 0 && !selectedProductId) {
      setSelectedProductId(allProducts[0].id);
    }
    setQuantity('');
    setNotes('');
    setError(null);
  }, [product, allProducts, isOpen]);

  if (!isOpen) return null;

  const currentProduct = product || allProducts.find((p) => p.id === Number(selectedProductId));
  const currentStock = currentProduct ? currentProduct.current_stock : 0;
  const numQty = Number(quantity) || 0;

  const calculatedNewStock =
    adjustmentType === 'ADJUSTMENT_IN' ? currentStock + numQty : currentStock - numQty;

  const isInvalidOut = adjustmentType === 'ADJUSTMENT_OUT' && numQty > currentStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) {
      setError('Please select a product to adjust.');
      return;
    }
    if (numQty <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (isInvalidOut) {
      setError(
        `Cannot deduct ${numQty} ${currentProduct.unit}. Only ${currentStock} ${currentProduct.unit} available in stock.`
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await apiRequest('/api/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({
        product_id: currentProduct.id,
        adjustment_type: adjustmentType,
        quantity: numQty,
        notes: notes.trim() || 'Physical inventory audit adjustment',
      }),
    });

    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setError(res.message || 'Failed to adjust stock.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Manual Stock Adjustment</h2>
              <p className="text-xs text-stone-500">Record physical count audits or discrepancy writes</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Select Product
            </label>
            {product ? (
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
                <span className="font-bold text-xs text-stone-900 block">{product.name}</span>
                <span className="text-[11px] font-mono text-stone-500">
                  SKU: {product.sku} • Current: {product.current_stock} {product.unit}
                </span>
              </div>
            ) : (
              <select
                required
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
              >
                {allProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — {p.current_stock} {p.unit}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Adjustment Type Switcher */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Adjustment Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('ADJUSTMENT_IN')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                  adjustmentType === 'ADJUSTMENT_IN'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Stock In (+) / Surplus</span>
              </button>

              <button
                type="button"
                onClick={() => setAdjustmentType('ADJUSTMENT_OUT')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                  adjustmentType === 'ADJUSTMENT_OUT'
                    ? 'border-rose-600 bg-rose-50 text-rose-900'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Minus className="w-3.5 h-3.5 text-rose-600" />
                <span>Stock Out (-) / Deficit</span>
              </button>
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Adjustment Quantity ({currentProduct?.unit || 'Units'})
            </label>
            <input
              type="number"
              step="any"
              required
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 10"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-amber-600 focus:outline-none"
            />
          </div>

          {/* Real-time Math Preview Box */}
          {currentProduct && numQty > 0 && (
            <div
              className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                isInvalidOut
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-amber-50/70 border-amber-200 text-stone-800'
              }`}
            >
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Current</span>
                <span className="font-mono font-bold">{currentStock}</span>
              </div>

              <div className="font-bold text-stone-400">
                {adjustmentType === 'ADJUSTMENT_IN' ? '+' : '-'} {numQty}
              </div>

              <ArrowRight className="w-4 h-4 text-stone-400" />

              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">New Level</span>
                <span
                  className={`font-mono font-bold ${
                    isInvalidOut ? 'text-red-700' : 'text-emerald-800'
                  }`}
                >
                  {calculatedNewStock} {currentProduct.unit}
                </span>
              </div>
            </div>
          )}

          {/* Audit Reason */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Audit Note / Reason
            </label>
            <input
              type="text"
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. End of month physical recount, damaged during handling"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isInvalidOut || numQty <= 0}
              className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Adjusting...' : 'Save Stock Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
