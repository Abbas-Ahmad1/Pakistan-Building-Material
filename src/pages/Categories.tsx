import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { Category, Subcategory } from '../types';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FolderPlus,
  ArrowLeft,
  X,
  Package,
} from 'lucide-react';

interface CategoriesProps {
  onBack?: () => void;
}

export const Categories: React.FC<CategoriesProps> = ({ onBack }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Category Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: '', code: '', description: '' });

  // Subcategory Modal
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [parentCatId, setParentCatId] = useState<number | null>(null);
  const [subName, setSubName] = useState('');

  const fetchCategories = async () => {
    setIsLoading(true);
    const res = await apiRequest<Category[]>('/api/categories');
    if (res.success && res.data) {
      setCategories(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenCatModal = (cat?: Category) => {
    if (cat) {
      setEditingCat(cat);
      setCatForm({ name: cat.name, code: cat.code, description: cat.description || '' });
    } else {
      setEditingCat(null);
      setCatForm({ name: '', code: '', description: '' });
    }
    setIsCatModalOpen(true);
    setAlert(null);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = editingCat ? `/api/categories/${editingCat.id}` : '/api/categories';
    const method = editingCat ? 'PUT' : 'POST';

    const res = await apiRequest(endpoint, {
      method,
      body: JSON.stringify(catForm),
    });

    if (res.success) {
      setAlert({
        type: 'success',
        text: editingCat ? 'Category updated successfully.' : 'Category created successfully.',
      });
      setIsCatModalOpen(false);
      fetchCategories();
    } else {
      setAlert({ type: 'error', text: res.message || 'Failed to save category.' });
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;

    const res = await apiRequest(`/api/categories/${cat.id}`, { method: 'DELETE' });
    if (res.success) {
      setAlert({ type: 'success', text: 'Category deleted successfully.' });
      fetchCategories();
    } else {
      setAlert({ type: 'error', text: res.message || 'Failed to delete category.' });
    }
  };

  const handleOpenSubModal = (categoryId: number) => {
    setParentCatId(categoryId);
    setSubName('');
    setIsSubModalOpen(true);
    setAlert(null);
  };

  const handleSaveSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentCatId || !subName.trim()) return;

    const res = await apiRequest(`/api/categories/${parentCatId}/subcategories`, {
      method: 'POST',
      body: JSON.stringify({ name: subName.trim() }),
    });

    if (res.success) {
      setAlert({ type: 'success', text: 'Subcategory added successfully.' });
      setIsSubModalOpen(false);
      fetchCategories();
    } else {
      setAlert({ type: 'error', text: res.message || 'Failed to add subcategory.' });
    }
  };

  const handleDeleteSubcategory = async (sub: Subcategory) => {
    if (!window.confirm(`Delete subcategory "${sub.name}"?`)) return;

    const res = await apiRequest(`/api/categories/subcategories/${sub.id}`, { method: 'DELETE' });
    if (res.success) {
      setAlert({ type: 'success', text: 'Subcategory deleted.' });
      fetchCategories();
    } else {
      setAlert({ type: 'error', text: res.message || 'Failed to delete subcategory.' });
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center space-x-2">
            <span>Category & Subcategory Hierarchy</span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Organize hardware, sanitary fittings, pipes, tools, and building material departments
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => handleOpenCatModal()}
            className="flex items-center space-x-1.5 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        )}
      </div>

      {alert && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            alert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{alert.text}</span>
          <button type="button" onClick={() => setAlert(null)} className="text-stone-400 hover:text-stone-600">
            &times;
          </button>
        </div>
      )}

      {/* Categories Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden flex flex-col justify-between"
          >
            {/* Category Header */}
            <div className="p-5 border-b border-stone-100 bg-stone-50/40 flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-stone-900 text-sm">{cat.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {cat.code}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">{cat.description || 'No description provided.'}</p>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => handleOpenCatModal(cat)}
                    className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded transition-colors"
                    title="Edit Category"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat)}
                    className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Subcategories Container */}
            <div className="p-5 flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Subcategories ({cat.subcategories?.length || 0})
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleOpenSubModal(cat.id)}
                    className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Subcategory</span>
                  </button>
                )}
              </div>

              {(!cat.subcategories || cat.subcategories.length === 0) ? (
                <p className="text-xs text-stone-400 italic py-2">No subcategories created yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {cat.subcategories.map((sub) => (
                    <div
                      key={sub.id}
                      className="group inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors"
                    >
                      <span>{sub.name}</span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSubcategory(sub)}
                          className="opacity-40 group-hover:opacity-100 text-stone-400 hover:text-red-600 transition-all"
                          title="Remove subcategory"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category Footer Summary */}
            <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between text-xs text-stone-500">
              <div className="flex items-center space-x-1.5">
                <Package className="w-3.5 h-3.5 text-stone-400" />
                <span>
                  <strong className="text-stone-800">{cat.products_count || 0}</strong> Active Products
                </span>
              </div>
              <span className="text-[11px] text-stone-400 font-mono">ID #{cat.id}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Category Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <h2 className="text-base font-bold text-stone-900">
                {editingCat ? `Edit Category: ${editingCat.name}` : 'Create New Category'}
              </h2>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="e.g. Sanitary & Ceramic"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Unique Code / Prefix (3-6 Chars) *
                </label>
                <input
                  type="text"
                  required
                  value={catForm.code}
                  onChange={(e) => setCatForm({ ...catForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SNT or PPR"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  placeholder="Department details..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subcategory Modal */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <h2 className="text-sm font-bold text-stone-900">Add Subcategory</h2>
              <button
                type="button"
                onClick={() => setIsSubModalOpen(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubcategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Subcategory Name *
                </label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. Elbows & Tees, Brass Bib Cocks"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSubModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Add Subcategory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
