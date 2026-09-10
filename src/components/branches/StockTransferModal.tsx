import React, { useState } from 'react';
import { X, ArrowRight, Plus, Trash2, AlertCircle, CheckCircle2, RefreshCw, Boxes, ArrowLeftRight } from 'lucide-react';
import { Branch, ProductBranchStockMatrix } from '../../types';
import { apiRequest } from '../../services/api';

interface StockTransferModalProps {
  branches: Branch[];
  stockMatrix: ProductBranchStockMatrix[];
  onClose: () => void;
  onTransferSuccess: () => void;
}

interface TransferRow {
  productId: number;
  quantity: number;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  branches,
  stockMatrix,
  onClose,
  onTransferSuccess,
}) => {
  const [fromBranchId, setFromBranchId] = useState<number>(branches[0]?.id || 1);
  const [toBranchId, setToBranchId] = useState<number>(branches[1]?.id || (branches[0]?.id === 1 ? 2 : 1));
  const [rows, setRows] = useState<TransferRow[]>([
    { productId: stockMatrix[0]?.id || 0, quantity: 1 },
  ]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getSourceBranchStock = (productId: number, branchId: number): number => {
    const product = stockMatrix.find((p) => p.id === productId);
    if (!product) return 0;
    const branchBreakdown = product.branches?.find((b) => b.branch_id === branchId);
    return branchBreakdown ? branchBreakdown.current_stock : 0;
  };

  const handleAddRow = () => {
    const availableProducts = stockMatrix.filter((p) => !rows.some((r) => r.productId === p.id));
    const nextProduct = availableProducts[0] || stockMatrix[0];
    if (nextProduct) {
      setRows([...rows, { productId: nextProduct.id, quantity: 1 }]);
    }
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, newProductId: number) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        return { ...row, productId: newProductId, quantity: 1 };
      })
    );
  };

  const handleQtyChange = (index: number, newQty: number) => {
    const safeQty = Math.max(1, Math.round(newQty));
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, quantity: safeQty } : row))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (fromBranchId === toBranchId) {
      setErrorMessage('Source and Destination branches must be different.');
      return;
    }

    if (rows.length === 0) {
      setErrorMessage('Please add at least one product to transfer.');
      return;
    }

    // Validation: ensure source branch has sufficient stock
    for (const row of rows) {
      const product = stockMatrix.find((p) => p.id === row.productId);
      const available = getSourceBranchStock(row.productId, fromBranchId);
      if (row.quantity > available) {
        setErrorMessage(
          `Cannot transfer ${row.quantity} units of "${product?.name || 'Item'}". Only ${available} available in source branch.`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const res = await apiRequest('/api/branches/transfers', {
        method: 'POST',
        body: JSON.stringify({
          from_branch_id: fromBranchId,
          to_branch_id: toBranchId,
          notes: notes.trim(),
          items: rows.map((r) => ({
            product_id: r.productId,
            quantity: r.quantity,
          })),
        }),
      });

      if (res.success) {
        onTransferSuccess();
        onClose();
      } else {
        setErrorMessage(res.message || 'Failed to complete stock transfer.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Server error while processing transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fromBranch = branches.find((b) => b.id === fromBranchId);
  const toBranch = branches.find((b) => b.id === toBranchId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-stone-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-stone-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-amber-600 rounded-lg text-white">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">Branch Stock Transfer</h3>
              <p className="text-[11px] text-stone-400">
                Move inventory stock safely between stores with automatic ledger updates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Branch Selector Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                From Branch (Source):
              </label>
              <select
                value={fromBranchId}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFromBranchId(val);
                  if (val === toBranchId) {
                    const alt = branches.find((b) => b.id !== val);
                    if (alt) setToBranchId(alt.id);
                  }
                }}
                className="w-full py-2 px-3 bg-white border border-stone-300 rounded-lg font-semibold text-stone-800 focus:ring-2 focus:ring-amber-500 focus:outline-none text-xs"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code}){b.is_main ? ' — Main' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-stone-500 mt-1">
                Stock will be deducted from this branch.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                To Branch (Destination):
              </label>
              <select
                value={toBranchId}
                onChange={(e) => setToBranchId(Number(e.target.value))}
                className="w-full py-2 px-3 bg-white border border-stone-300 rounded-lg font-semibold text-stone-800 focus:ring-2 focus:ring-amber-500 focus:outline-none text-xs"
              >
                {branches
                  .filter((b) => b.id !== fromBranchId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code}){b.is_main ? ' — Main' : ''}
                    </option>
                  ))}
              </select>
              <p className="text-[10px] text-stone-500 mt-1">
                Stock will be replenished into this branch.
              </p>
            </div>
          </div>

          {/* Transfer Summary Badge */}
          <div className="px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 flex items-center justify-between font-medium">
            <span>
              Transfer Route: <strong>{fromBranch?.name || 'Branch 1'}</strong>
            </span>
            <ArrowRight className="w-4 h-4 text-amber-700" />
            <span>
              Destination: <strong>{toBranch?.name || 'Branch 2'}</strong>
            </span>
          </div>

          {/* Transfer Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">
                Items to Transfer:
              </label>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-colors border border-stone-300"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="border border-stone-200 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-stone-100 text-stone-700 font-bold text-[10px] uppercase border-b border-stone-200">
                  <tr>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-2 text-center w-24">Available in {fromBranch?.code || 'Src'}</th>
                    <th className="py-2 px-2 text-center w-24">Transfer Qty</th>
                    <th className="py-2 px-2 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((row, index) => {
                    const available = getSourceBranchStock(row.productId, fromBranchId);
                    const selectedProduct = stockMatrix.find((p) => p.id === row.productId);
                    const isExceeded = row.quantity > available;

                    return (
                      <tr key={index} className="hover:bg-stone-50">
                        <td className="py-2 px-3">
                          <select
                            value={row.productId}
                            onChange={(e) => handleProductChange(index, Number(e.target.value))}
                            className="w-full py-1.5 px-2 bg-white border border-stone-300 rounded font-medium text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          >
                            {stockMatrix.map((prod) => (
                              <option key={prod.id} value={prod.id}>
                                {prod.name} ({prod.brand || 'General'}) [{prod.unit}]
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                              available > 0
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {available} {selectedProduct?.unit || ''}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            max={available > 0 ? available : 1}
                            value={row.quantity}
                            onChange={(e) => handleQtyChange(index, Number(e.target.value))}
                            className={`w-20 py-1 px-2 border rounded font-mono font-bold text-center text-xs focus:outline-none focus:ring-1 ${
                              isExceeded
                                ? 'border-rose-500 bg-rose-50 text-rose-800 focus:ring-rose-500'
                                : 'border-stone-300 text-stone-900 focus:ring-amber-500'
                            }`}
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(index)}
                            disabled={rows.length === 1}
                            className="p-1 text-stone-400 hover:text-rose-600 disabled:opacity-30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Transfer Notes / Driver / Vehicle details:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dispatched via Suzuki pickup (Driver: Tariq Khan, Phone: 0300-9876543)"
              className="w-full py-2 px-3 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm flex items-center space-x-1.5 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Transfer...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Execute Stock Transfer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
