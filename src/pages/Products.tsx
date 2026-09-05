import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { apiRequest } from '../services/api';
import { Product, Category, Supplier } from '../types';
import { ProductFormModal } from '../components/products/ProductFormModal';
import { ProductDetailModal } from '../components/products/ProductDetailModal';
import { StockAdjustmentModal } from '../components/inventory/StockAdjustmentModal';
import {
  Package,
  Search,
  Plus,
  Filter,
  Eye,
  Edit2,
  Trash2,
  AlertTriangle,
  Boxes,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  Tag,
  SlidersHorizontal,
} from 'lucide-react';

interface ProductsProps {
  onNavigate?: (view: string) => void;
}

export const Products: React.FC<ProductsProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const isAdmin = user?.role === 'ADMIN';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  const [detailProductId, setDetailProductId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);

  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load auxiliary meta
  const fetchMetadata = async () => {
    const [catRes, supRes, brandRes] = await Promise.all([
      apiRequest<Category[]>('/api/categories'),
      apiRequest<Supplier[]>('/api/suppliers'),
      apiRequest<string[]>('/api/products/meta/brands'),
    ]);

    if (catRes.success && catRes.data) setCategories(catRes.data);
    if (supRes.success && supRes.data) setSuppliers(supRes.data);
    if (brandRes.success && brandRes.data) setBrands(brandRes.data);
  };

  // Load products list with current filters
  const fetchProducts = async () => {
    setIsLoading(true);
    let url = `/api/products?limit=250`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    if (selectedCategory !== 'all') url += `&category_id=${selectedCategory}`;
    if (selectedBrand !== 'all') url += `&brand=${encodeURIComponent(selectedBrand)}`;
    if (stockFilter !== 'all') url += `&stock_status=${stockFilter}`;
    if (statusFilter !== 'all') url += `&status=${statusFilter}`;

    const res = await apiRequest<Product[]>(url);
    if (res.success && res.data) {
      setProducts(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, selectedBrand, stockFilter, statusFilter]);

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Are you sure you want to remove/discontinue "${product.name}"?`)) {
      return;
    }

    const res = await apiRequest(`/api/products/${product.id}`, { method: 'DELETE' });
    if (res.success) {
      setAlertMessage({ type: 'success', text: res.message || 'Product removed successfully.' });
      fetchProducts();
    } else {
      setAlertMessage({ type: 'error', text: res.message || 'Failed to remove product.' });
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center space-x-2">
            <span>Hardware & Sanitary Products Catalog</span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage hardware inventory items, units of measure, wholesale & retail pricing
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={fetchProducts}
            title="Refresh list"
            className="p-2 bg-white border border-stone-200 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-700' : ''}`} />
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setProductToEdit(null);
                setIsFormOpen(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product</span>
            </button>
          )}
        </div>
      </div>

      {alertMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            alertMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{alertMessage.text}</span>
          <button
            type="button"
            onClick={() => setAlertMessage(null)}
            className="text-stone-400 hover:text-stone-600 ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by SKU, Barcode, Product Name, Brand..."
              className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Brand Filter */}
          <div>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
            >
              <option value="all">Stock: All</option>
              <option value="in_stock">In Stock (&gt; Min)</option>
              <option value="low">Low Stock Alert (&le; Min)</option>
              <option value="out">Out of Stock (0)</option>
            </select>
          </div>
        </div>

        {/* Quick summary strip */}
        <div className="flex items-center justify-between text-[11px] text-stone-500 pt-2 border-t border-stone-100">
          <span>
            Found <strong className="text-stone-800">{products.length}</strong> matching products
          </span>
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>In Stock</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Low Stock</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Out of Stock</span>
            </span>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
        {products.length === 0 && !isLoading ? (
          <div className="py-16 text-center">
            <Package className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-stone-700">No products found</p>
            <p className="text-xs text-stone-400 mt-0.5">Try clearing your filters or adding a new product.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] bg-stone-50/50">
                  <th className="py-3 px-4 font-semibold">SKU & Product</th>
                  <th className="py-3 px-4 font-semibold">Category & Brand</th>
                  <th className="py-3 px-4 font-semibold">Unit</th>
                  <th className="py-3 px-4 font-semibold">Current Stock</th>
                  <th className="py-3 px-4 font-semibold text-right">Retail Price</th>
                  <th className="py-3 px-4 font-semibold text-right">Wholesale</th>
                  {isAdmin && <th className="py-3 px-4 font-semibold text-right">Purchase Cost</th>}
                  {isAdmin && <th className="py-3 px-4 font-semibold text-center">Margin</th>}
                  <th className="py-3 px-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {products.map((p) => {
                  const isOutOfStock = p.current_stock <= 0;
                  const isLowStock = p.current_stock > 0 && p.current_stock <= p.minimum_stock;
                  const margin =
                    p.purchase_price > 0
                      ? (((p.selling_price - p.purchase_price) / p.purchase_price) * 100).toFixed(0)
                      : '0';

                  return (
                    <tr key={p.id} className="hover:bg-stone-50/70 transition-colors">
                      {/* SKU & Product Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-start space-x-3">
                          <div className="w-9 h-9 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Package className="w-4 h-4 text-stone-400" />
                            )}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                setDetailProductId(p.id);
                                setIsDetailOpen(true);
                              }}
                              className="font-semibold text-stone-900 hover:text-amber-800 text-left line-clamp-1 cursor-pointer transition-colors"
                            >
                              {p.name}
                            </button>
                            <div className="flex items-center space-x-2 text-[10px] text-stone-500 font-mono mt-0.5">
                              <span className="font-bold text-stone-700">{p.sku}</span>
                              {p.barcode && <span>• {p.barcode}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category & Brand */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-stone-800 block">{p.category_name}</span>
                        <span className="text-[11px] text-stone-400">{p.brand || '—'}</span>
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium text-[11px]">
                          {p.unit}
                        </span>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isOutOfStock
                                ? 'text-red-700'
                                : isLowStock
                                ? 'text-amber-700'
                                : 'text-emerald-800'
                            }`}
                          >
                            {p.current_stock}
                          </span>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              isOutOfStock
                                ? 'bg-red-100 text-red-800'
                                : isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isOutOfStock ? 'OUT' : isLowStock ? 'LOW' : 'OK'}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400 block mt-0.5">
                          Min: {p.minimum_stock}
                        </span>
                      </td>

                      {/* Retail Price */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                        {formatCurrency(p.selling_price)}
                      </td>

                      {/* Wholesale Price */}
                      <td className="py-3 px-4 text-right font-mono text-stone-700">
                        {formatCurrency(p.wholesale_price || p.selling_price)}
                      </td>

                      {/* Purchase Cost (Admin) */}
                      {isAdmin && (
                        <td className="py-3 px-4 text-right font-mono text-stone-500">
                          {formatCurrency(p.purchase_price)}
                        </td>
                      )}

                      {/* Margin % (Admin) */}
                      {isAdmin && (
                        <td className="py-3 px-4 text-center">
                          <span className="text-[10px] font-bold font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            +{margin}%
                          </span>
                        </td>
                      )}

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailProductId(p.id);
                              setIsDetailOpen(true);
                            }}
                            title="View Full Details"
                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setAdjustProduct(p);
                                  setIsAdjustOpen(true);
                                }}
                                title="Adjust Stock"
                                className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded transition-colors"
                              >
                                <Boxes className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setProductToEdit(p);
                                  setIsFormOpen(true);
                                }}
                                title="Edit Product"
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(p)}
                                title="Delete or Discontinue"
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
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

      {/* Modals */}
      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => {
          fetchProducts();
          fetchMetadata();
          setAlertMessage({
            type: 'success',
            text: productToEdit ? 'Product updated successfully.' : 'Product created successfully.',
          });
        }}
        productToEdit={productToEdit}
        categories={categories}
        suppliers={suppliers}
      />

      <ProductDetailModal
        productId={detailProductId}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailProductId(null);
        }}
        onAdjustStock={(p) => {
          setAdjustProduct(p);
          setIsAdjustOpen(true);
        }}
        onEditProduct={(p) => {
          setProductToEdit(p);
          setIsFormOpen(true);
        }}
      />

      <StockAdjustmentModal
        isOpen={isAdjustOpen}
        onClose={() => {
          setIsAdjustOpen(false);
          setAdjustProduct(null);
        }}
        onSuccess={() => {
          fetchProducts();
          setAlertMessage({ type: 'success', text: 'Stock level updated in database ledger.' });
        }}
        product={adjustProduct}
        allProducts={products}
      />
    </div>
  );
};
