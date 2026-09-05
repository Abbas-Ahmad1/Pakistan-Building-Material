import React from 'react';
import { AlertTriangle, PackageX, ArrowRight } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

interface LowStockAlertProps {
  products: {
    id: number;
    sku: string;
    name: string;
    category_name: string;
    unit: string;
    current_stock: number;
    minimum_stock: number;
    purchase_price: number;
    selling_price: number;
  }[];
  onNavigateToProducts?: () => void;
  isAdmin: boolean;
}

export const LowStockAlert: React.FC<LowStockAlertProps> = ({
  products,
  onNavigateToProducts,
  isAdmin,
}) => {
  const { formatCurrency } = useSettings();

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-amber-50 rounded-lg text-amber-700">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-sm">Inventory Alerts</h3>
            <p className="text-xs text-stone-500">Items at or below safety threshold</p>
          </div>
        </div>

        {onNavigateToProducts && (
          <button
            type="button"
            onClick={onNavigateToProducts}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
            ✓
          </div>
          <p className="text-xs font-semibold text-stone-700">All Stock Levels Healthy</p>
          <p className="text-[11px] text-stone-400 mt-0.5">No products require immediate restocking</p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px]">
                <th className="py-2 px-1 font-semibold">Product</th>
                <th className="py-2 px-1 font-semibold">Category</th>
                <th className="py-2 px-1 font-semibold text-right">Available</th>
                <th className="py-2 px-1 font-semibold text-right">Min</th>
                <th className="py-2 px-1 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {products.map((item) => {
                const isOutOfStock = item.current_stock <= 0;
                return (
                  <tr key={item.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-2.5 px-1">
                      <div className="font-semibold text-stone-900">{item.name}</div>
                      <div className="text-[10px] text-stone-400 font-mono">{item.sku}</div>
                    </td>
                    <td className="py-2.5 px-1 text-stone-600">{item.category_name}</td>
                    <td className="py-2.5 px-1 text-right font-mono font-bold text-stone-900">
                      {item.current_stock} <span className="text-[10px] font-normal text-stone-500">{item.unit}</span>
                    </td>
                    <td className="py-2.5 px-1 text-right font-mono text-stone-500">
                      {item.minimum_stock}
                    </td>
                    <td className="py-2.5 px-1 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isOutOfStock ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
