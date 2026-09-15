import React, { useState } from 'react';
import { Category, Supplier } from '../../types';
import { apiRequest } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import {
  X,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  Calculator,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Layers,
  DollarSign,
} from 'lucide-react';

interface BulkPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  categories: Category[];
  suppliers: Supplier[];
}

export const BulkPriceModal: React.FC<BulkPriceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categories,
  suppliers,
}) => {
  const { settings } = useSettings();

  const [targetScope, setTargetScope] = useState<'all' | 'category' | 'supplier'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  const [actionType, setActionType] = useState<
    'RECALCULATE_FROM_COST' | 'PERCENTAGE_INCREASE' | 'PERCENTAGE_DECREASE' | 'FIXED_AMOUNT_ADD'
  >('PERCENTAGE_INCREASE');

  const [adjustmentValue, setAdjustmentValue] = useState<string>('5');
  const [roundTo, setRoundTo] = useState<number>(1);
  const [reason, setReason] = useState<string>('Market cost adjustment');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload: any = {
        action_type: actionType,
        adjustment_value: Number(adjustmentValue) || 0,
        round_to: Number(roundTo) || 0,
        reason: reason.trim() || 'Bulk catalog price revision',
      };

      if (targetScope === 'category') {
        if (!selectedCategoryId) {
          setError('Please select a category.');
          setIsSubmitting(false);
          return;
        }
        payload.category_id = Number(selectedCategoryId);
      } else if (targetScope === 'supplier') {
        if (!selectedSupplierId) {
          setError('Please select a supplier.');
          setIsSubmitting(false);
          return;
        }
        payload.supplier_id = Number(selectedSupplierId);
      }

      const res = await apiRequest('/api/products/bulk-price-update', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        onSuccess((res as any).updated_count || 0);
        onClose();
      } else {
        setError(res.message || 'Failed to update prices.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during bulk update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Bulk Price Adjustment</h2>
              <p className="text-xs text-stone-500">
                Update multiple retail selling prices across your hardware catalog
              </p>
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

          {/* Scope Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              1. Target Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetScope('all')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center transition-colors ${
                  targetScope === 'all'
                    ? 'bg-amber-800 text-white border-amber-800'
                    : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                All Products
              </button>
              <button
                type="button"
                onClick={() => setTargetScope('category')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center transition-colors ${
                  targetScope === 'category'
                    ? 'bg-amber-800 text-white border-amber-800'
                    : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                By Category
              </button>
              <button
                type="button"
                onClick={() => setTargetScope('supplier')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center transition-colors ${
                  targetScope === 'supplier'
                    ? 'bg-amber-800 text-white border-amber-800'
                    : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                By Supplier
              </button>
            </div>

            {targetScope === 'category' && (
              <div className="mt-2.5">
                <select
                  required
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {targetScope === 'supplier' && (
              <div className="mt-2.5">
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.company})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Action Type */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              2. Price Adjustment Strategy
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  actionType === 'RECALCULATE_FROM_COST'
                    ? 'bg-amber-50/70 border-amber-600'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="action_type"
                  checked={actionType === 'RECALCULATE_FROM_COST'}
                  onChange={() => setActionType('RECALCULATE_FROM_COST')}
                  className="mt-0.5 text-amber-700 focus:ring-amber-600"
                />
                <div className="ml-2.5">
                  <div className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                    <Calculator className="w-3.5 h-3.5 text-amber-700" />
                    <span>Recalculate from Cost (Markup / Margin Formula)</span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Applies each product&apos;s configured pricing mode (e.g. +20% markup over cost).
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  actionType === 'PERCENTAGE_INCREASE'
                    ? 'bg-amber-50/70 border-amber-600'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="action_type"
                  checked={actionType === 'PERCENTAGE_INCREASE'}
                  onChange={() => setActionType('PERCENTAGE_INCREASE')}
                  className="mt-0.5 text-amber-700 focus:ring-amber-600"
                />
                <div className="ml-2.5">
                  <div className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Percentage Increase (+X%)</span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Bump all existing retail prices by a uniform percentage (e.g., inflation adjustment).
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  actionType === 'PERCENTAGE_DECREASE'
                    ? 'bg-amber-50/70 border-amber-600'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="action_type"
                  checked={actionType === 'PERCENTAGE_DECREASE'}
                  onChange={() => setActionType('PERCENTAGE_DECREASE')}
                  className="mt-0.5 text-amber-700 focus:ring-amber-600"
                />
                <div className="ml-2.5">
                  <div className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-700" />
                    <span>Percentage Decrease (-X%)</span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Apply seasonal discount or price drop across targeted items.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  actionType === 'FIXED_AMOUNT_ADD'
                    ? 'bg-amber-50/70 border-amber-600'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="action_type"
                  checked={actionType === 'FIXED_AMOUNT_ADD'}
                  onChange={() => setActionType('FIXED_AMOUNT_ADD')}
                  className="mt-0.5 text-amber-700 focus:ring-amber-600"
                />
                <div className="ml-2.5">
                  <div className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-700" />
                    <span>Add Fixed Amount (+Rs. X)</span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Add a flat freight or handling surcharge to every item in scope.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Adjustment value if percentage or fixed amount */}
          {actionType !== 'RECALCULATE_FROM_COST' && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                {actionType === 'FIXED_AMOUNT_ADD'
                  ? `Amount to Add (${settings.currency})`
                  : 'Adjustment Percentage (%)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  min="0.1"
                  value={adjustmentValue}
                  onChange={(e) => setAdjustmentValue(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-stone-400">
                  {actionType === 'FIXED_AMOUNT_ADD' ? settings.currency : '%'}
                </span>
              </div>
            </div>
          )}

          {/* Rounding & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Round Prices To
              </label>
              <select
                value={roundTo}
                onChange={(e) => setRoundTo(Number(e.target.value))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
              >
                <option value={0}>Exact (No rounding)</option>
                <option value={1}>Nearest 1 {settings.currency}</option>
                <option value={5}>Nearest 5 {settings.currency}</option>
                <option value={10}>Nearest 10 {settings.currency}</option>
                <option value={50}>Nearest 50 {settings.currency}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Audit Reason
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Factory price revision"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <strong>Note:</strong> Every changed product price will be automatically logged to the{' '}
            <em>Price & Cost History Audit Trail</em> with the specified reason and your user name.
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5"
            >
              {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Execute Price Adjustment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
