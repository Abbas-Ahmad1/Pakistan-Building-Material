import React, { useState, useEffect } from 'react';
import { Product, Category, Supplier, ProductUnit } from '../../types';
import { apiRequest } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import { X, Save, AlertCircle, RefreshCw, Wand2, Package, DollarSign, Barcode, Image as ImageIcon } from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productToEdit?: Product | null;
  categories: Category[];
  suppliers: Supplier[];
}

const UNITS: ProductUnit[] = [
  'Piece',
  'Box',
  'Bag',
  'Meter',
  'Feet',
  'Kg',
  'Ton',
  'Liter',
  'Set',
  'Roll',
];

export const CEMENT_BRANDS = [
  'Cherat Cement',
  'Fauji Cement (FCCL)',
  'Lucky Cement',
  'Bestway Cement',
  'D.G. Khan Cement (DGKC)',
  'Maple Leaf Cement',
  'Falcon Cement',
  'Kohat Cement',
  'Pioneer Cement',
  'Power Cement',
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  productToEdit,
  categories,
  suppliers,
}) => {
  const { settings } = useSettings();
  const isEditing = Boolean(productToEdit);

  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    category_id: '' as string | number,
    subcategory_id: '' as string | number,
    brand: '',
    description: '',
    unit: 'Piece' as ProductUnit,
    purchase_price: '',
    selling_price: '',
    wholesale_price: '',
    current_stock: '0',
    minimum_stock: '5',
    supplier_id: '' as string | number,
    image_url: '',
    status: 'active' as 'active' | 'inactive',
    pricing_mode: 'FIXED' as 'FIXED' | 'MARKUP' | 'MARGIN',
    markup_percentage: '',
    margin_percentage: '',
    auto_price_update: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productToEdit) {
      setFormData({
        sku: productToEdit.sku || '',
        barcode: productToEdit.barcode || '',
        name: productToEdit.name || '',
        category_id: productToEdit.category_id || '',
        subcategory_id: productToEdit.subcategory_id || '',
        brand: productToEdit.brand || '',
        description: productToEdit.description || '',
        unit: productToEdit.unit || 'Piece',
        purchase_price: productToEdit.purchase_price?.toString() || '',
        selling_price: productToEdit.selling_price?.toString() || '',
        wholesale_price: productToEdit.wholesale_price?.toString() || '',
        current_stock: productToEdit.current_stock?.toString() || '0',
        minimum_stock: productToEdit.minimum_stock?.toString() || '5',
        supplier_id: productToEdit.supplier_id || '',
        image_url: productToEdit.image_url || '',
        status: (productToEdit.status as 'active' | 'inactive') || 'active',
        pricing_mode: productToEdit.pricing_mode || 'FIXED',
        markup_percentage: productToEdit.markup_percentage ? productToEdit.markup_percentage.toString() : '',
        margin_percentage: productToEdit.margin_percentage ? productToEdit.margin_percentage.toString() : '',
        auto_price_update: Boolean(productToEdit.auto_price_update),
      });
    } else {
      setFormData({
        sku: '',
        barcode: '',
        name: '',
        category_id: categories.length > 0 ? categories[0].id : '',
        subcategory_id: '',
        brand: '',
        description: '',
        unit: 'Piece',
        purchase_price: '',
        selling_price: '',
        wholesale_price: '',
        current_stock: '0',
        minimum_stock: settings.low_stock_threshold?.toString() || '5',
        supplier_id: suppliers.length > 0 ? suppliers[0].id : '',
        image_url: '',
        status: 'active',
        pricing_mode: 'FIXED',
        markup_percentage: '20',
        margin_percentage: '15',
        auto_price_update: false,
      });
    }
    setError(null);
  }, [productToEdit, isOpen, categories, suppliers, settings]);

  if (!isOpen) return null;

  // Selected category subcategories
  const selectedCategory = categories.find((c) => c.id === Number(formData.category_id));
  const availableSubcategories = selectedCategory?.subcategories || [];

  const handleGenerateSKU = () => {
    const prefix = selectedCategory?.code || 'SKU';
    const random = Math.floor(1000 + Math.random() * 9000);
    setFormData((prev) => ({ ...prev, sku: `${prefix}-${random}` }));
  };

  const handleGenerateBarcode = () => {
    // Standard 12-digit EAN/UPC style test barcode
    const random = Math.floor(100000000000 + Math.random() * 900000000000);
    setFormData((prev) => ({ ...prev, barcode: random.toString() }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cost = Number(formData.purchase_price) || 0;
    const selling = Number(formData.selling_price) || 0;
    const wholesale = Number(formData.wholesale_price) || selling;
    const margin = formData.margin_percentage ? Number(formData.margin_percentage) : 0;
    const markup = formData.markup_percentage ? Number(formData.markup_percentage) : 0;

    if (cost < 0 || selling < 0 || wholesale < 0) {
      setError('Prices cannot be negative.');
      return;
    }

    if (formData.pricing_mode === 'MARGIN' && margin >= 100) {
      setError('Target margin percentage must be strictly less than 100%.');
      return;
    }

    if (formData.pricing_mode === 'MARKUP' && markup < 0) {
      setError('Markup percentage cannot be negative.');
      return;
    }

    if (formData.pricing_mode === 'MARGIN' && margin < 0) {
      setError('Margin percentage cannot be negative.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      ...formData,
      category_id: Number(formData.category_id),
      subcategory_id: formData.subcategory_id ? Number(formData.subcategory_id) : null,
      supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
      purchase_price: cost,
      selling_price: selling,
      wholesale_price: wholesale,
      current_stock: Number(formData.current_stock) || 0,
      minimum_stock: Number(formData.minimum_stock) || 5,
      pricing_mode: formData.pricing_mode,
      markup_percentage: formData.markup_percentage ? Number(formData.markup_percentage) : null,
      margin_percentage: formData.margin_percentage ? Number(formData.margin_percentage) : null,
      auto_price_update: Boolean(formData.auto_price_update),
    };

    const endpoint = isEditing ? `/api/products/${productToEdit?.id}` : '/api/products';
    const method = isEditing ? 'PUT' : 'POST';

    const res = await apiRequest(endpoint, {
      method,
      body: JSON.stringify(payload),
    });

    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setError(res.message || 'Operation failed.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                {isEditing ? `Edit Product: ${productToEdit?.name}` : 'Add New Hardware & Sanitary Product'}
              </h2>
              <p className="text-xs text-stone-500">
                {isEditing
                  ? 'Update product attributes, prices, and stock thresholds'
                  : 'Enter SKU, pricing tiers, unit of measure, and initial stock'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Identification Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center space-x-1.5">
              <span>1. Basic Identification</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-stone-700">SKU (Stock Keeping Unit) *</label>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={handleGenerateSKU}
                      className="text-[10px] text-amber-700 hover:text-amber-900 flex items-center space-x-1 font-semibold"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>Auto-Generate</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="e.g. PPR-ELB-25"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-stone-700">Barcode / UPC (Optional)</label>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="text-[10px] text-amber-700 hover:text-amber-900 flex items-center space-x-1 font-semibold"
                  >
                    <Barcode className="w-3 h-3" />
                    <span>Generate</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="e.g. 890123456789"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. PPRC 90 Degree Elbow 25mm PN25"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category_id: e.target.value,
                      subcategory_id: '',
                    })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Subcategory
                </label>
                <select
                  value={formData.subcategory_id}
                  onChange={(e) => setFormData({ ...formData, subcategory_id: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
                >
                  <option value="">-- General / None --</option>
                  {availableSubcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Brand / Manufacturer
                </label>
                <input
                  type="text"
                  list="cement-brands-list"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="e.g. Cherat, Fauji, Lucky, Bestway, Master"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
                <datalist id="cement-brands-list">
                  {CEMENT_BRANDS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                  <option value="Popular Pipes" />
                  <option value="Master Sanitary" />
                  <option value="Master Ceramics" />
                  <option value="Crown Valves" />
                  <option value="Berger Paints" />
                  <option value="Brighto Paints" />
                  <option value="Diamond Paints" />
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Unit of Measure (UOM) *
                </label>
                <select
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value as ProductUnit })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Select Cement Brands if category is Cement */}
              {selectedCategory?.name?.toLowerCase().includes('cement') && (
                <div className="col-span-full bg-amber-50/50 p-2.5 rounded-lg border border-amber-200">
                  <span className="text-[11px] font-bold text-amber-900 block mb-1.5">
                    Select Brand for Cement & Aggregates:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CEMENT_BRANDS.map((b) => {
                      const isSelected = formData.brand === b;
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            const matchedSub = availableSubcategories.find(
                              (s) => s.name.toLowerCase() === b.toLowerCase()
                            );
                            setFormData((prev) => ({
                              ...prev,
                              brand: b,
                              subcategory_id: matchedSub ? String(matchedSub.id) : prev.subcategory_id,
                              unit: 'Bag',
                            }));
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50 hover:border-amber-400'
                          }`}
                        >
                          {b}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pricing & Stock Section */}
          <div className="space-y-3 pt-3 border-t border-stone-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center space-x-1.5">
                <span>2. Dynamic Pricing Strategy & Stock Thresholds</span>
              </h3>
              {isEditing && productToEdit?.previous_cost && productToEdit.previous_cost > 0 && (
                <span className="text-[10px] text-stone-500 font-mono">
                  Prev Cost: {settings.currency} {productToEdit.previous_cost}
                  {productToEdit.cost_change_percent !== undefined && productToEdit.cost_change_percent !== 0 && (
                    <span
                      className={`ml-1 font-bold ${
                        productToEdit.cost_change_percent > 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      ({productToEdit.cost_change_percent > 0 ? '+' : ''}
                      {productToEdit.cost_change_percent}%)
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Pricing Mode & Dynamic Formula Bar */}
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Pricing Mode
                  </label>
                  <select
                    value={formData.pricing_mode}
                    onChange={(e) => {
                      const newMode = e.target.value as 'FIXED' | 'MARKUP' | 'MARGIN';
                      setFormData((prev) => {
                        const cost = Number(prev.purchase_price) || 0;
                        let newSelling = prev.selling_price;
                        if (newMode === 'MARKUP' && cost > 0 && prev.markup_percentage) {
                          newSelling = (cost * (1 + Number(prev.markup_percentage) / 100)).toFixed(2);
                        } else if (newMode === 'MARGIN' && cost > 0 && prev.margin_percentage) {
                          const margin = Number(prev.margin_percentage);
                          if (margin < 100) {
                            newSelling = (cost / (1 - margin / 100)).toFixed(2);
                          }
                        }
                        return { ...prev, pricing_mode: newMode, selling_price: newSelling };
                      });
                    }}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
                  >
                    <option value="FIXED">Manual / Fixed Price</option>
                    <option value="MARKUP">Cost + Markup Percentage (%)</option>
                    <option value="MARGIN">Cost + Target Margin (%)</option>
                  </select>
                </div>

                {formData.pricing_mode === 'MARKUP' && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Markup Percentage (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={formData.markup_percentage}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((prev) => {
                            const cost = Number(prev.purchase_price) || 0;
                            const newSelling = cost > 0 ? (cost * (1 + (Number(val) || 0) / 100)).toFixed(2) : prev.selling_price;
                            return { ...prev, markup_percentage: val, selling_price: newSelling };
                          });
                        }}
                        placeholder="e.g. 20"
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-amber-600 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-stone-400">%</span>
                    </div>
                  </div>
                )}

                {formData.pricing_mode === 'MARGIN' && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Target Gross Margin (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max="99.9"
                        value={formData.margin_percentage}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((prev) => {
                            const cost = Number(prev.purchase_price) || 0;
                            const margin = Number(val) || 0;
                            const newSelling = cost > 0 && margin < 100 ? (cost / (1 - margin / 100)).toFixed(2) : prev.selling_price;
                            return { ...prev, margin_percentage: val, selling_price: newSelling };
                          });
                        }}
                        placeholder="e.g. 15"
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-amber-600 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-stone-400">%</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.auto_price_update}
                      onChange={(e) => setFormData({ ...formData, auto_price_update: e.target.checked })}
                      className="rounded border-stone-300 text-amber-800 focus:ring-amber-600 w-4 h-4"
                    />
                    <span className="text-xs font-semibold text-stone-800">
                      Auto-update price on purchase inward
                    </span>
                  </label>
                </div>
              </div>

              {/* Profit & Margin Live Indicator */}
              {Number(formData.purchase_price) > 0 && Number(formData.selling_price) > 0 && (
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-stone-200">
                  <span className="text-stone-600">
                    Gross Profit:{' '}
                    <strong className="text-stone-900 font-mono">
                      {settings.currency}{' '}
                      {(Number(formData.selling_price) - Number(formData.purchase_price)).toFixed(2)}
                    </strong>
                  </span>
                  <span className="text-stone-600">
                    Gross Margin:{' '}
                    <strong className="text-emerald-700 font-mono">
                      {(
                        ((Number(formData.selling_price) - Number(formData.purchase_price)) /
                          Number(formData.selling_price)) *
                        100
                      ).toFixed(1)}
                      %
                    </strong>
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Purchase Price (Cost) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-stone-400 font-bold">
                    {settings.currency}
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    value={formData.purchase_price}
                    onChange={(e) => {
                      const costVal = e.target.value;
                      setFormData((prev) => {
                        const cost = Number(costVal) || 0;
                        let newSelling = prev.selling_price;
                        if (prev.pricing_mode === 'MARKUP' && cost > 0 && prev.markup_percentage) {
                          newSelling = (cost * (1 + Number(prev.markup_percentage) / 100)).toFixed(2);
                        } else if (prev.pricing_mode === 'MARGIN' && cost > 0 && prev.margin_percentage) {
                          const margin = Number(prev.margin_percentage);
                          if (margin < 100) {
                            newSelling = (cost / (1 - margin / 100)).toFixed(2);
                          }
                        }
                        return { ...prev, purchase_price: costVal, selling_price: newSelling };
                      });
                    }}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Retail Selling Price *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-stone-400 font-bold">
                    {settings.currency}
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-lg text-xs font-mono font-bold text-stone-900 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Wholesale Price (Contractor)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-stone-400 font-bold">
                    {settings.currency}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.wholesale_price}
                    onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                    placeholder="Same as retail if empty"
                    className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {isEditing ? 'Current Stock Level' : 'Initial Stock Quantity'}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  disabled={isEditing}
                  value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                  className={`w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-none ${
                    isEditing ? 'bg-stone-100 cursor-not-allowed text-stone-500' : ''
                  }`}
                />
                {isEditing && (
                  <span className="text-[10px] text-stone-400 mt-0.5 block">
                    Use &ldquo;Adjust Stock&rdquo; to modify physical inventory.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Low Stock Alert Threshold
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.minimum_stock}
                  onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                  placeholder="5"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Primary Supplier
                </label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.company})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Media & Details */}
          <div className="space-y-3 pt-3 border-t border-stone-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center space-x-1.5">
              <span>3. Media & Extra Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Image URL / Link
                </label>
                <div className="flex space-x-2">
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  />
                  {formData.image_url && (
                    <div className="w-9 h-9 rounded-lg border border-stone-300 overflow-hidden shrink-0 bg-stone-100 flex items-center justify-center">
                      <img
                        src={formData.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
                >
                  <option value="active">Active (Available for sale)</option>
                  <option value="inactive">Inactive (Temporarily hidden)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Description & Technical Specifications
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Material specs, pressure rating, thread type, standards..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-end space-x-3">
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
              className="flex items-center space-x-2 px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
