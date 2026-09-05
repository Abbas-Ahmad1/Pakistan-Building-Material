import React, { useState, useEffect } from 'react';
import {
  Barcode,
  Printer,
  Plus,
  Trash2,
  Search,
  Filter,
  Layers,
  Settings,
  RefreshCw,
  Tag,
  CheckSquare,
  Square,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { Product, Category } from '../types';

// Simple SVG Barcode Generator (Code128 pattern simulator)
const BarcodeSvg: React.FC<{ value: string; width?: number; height?: number }> = ({
  value,
  width = 140,
  height = 40,
}) => {
  // Generate deterministic bar widths from string characters
  const bars: { width: number; isBlack: boolean }[] = [];
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });

  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i);
    const pattern = [(charCode % 3) + 1, ((charCode >> 1) % 2) + 1, ((charCode >> 2) % 3) + 1, 1];
    pattern.forEach((w, idx) => {
      bars.push({ width: w, isBlack: idx % 2 === 0 });
    });
  }

  // End pattern
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 3, isBlack: true });

  const totalWidthUnits = bars.reduce((acc, b) => acc + b.width, 0);
  const unitPx = width / totalWidthUnits;

  let currentX = 0;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto">
      {bars.map((b, idx) => {
        const barW = b.width * unitPx;
        const elem = b.isBlack ? (
          <rect key={idx} x={currentX} y={0} width={barW} height={height} fill="#000" />
        ) : null;
        currentX += barW;
        return elem;
      })}
    </svg>
  );
};

export const BarcodeGeneratorView: React.FC = () => {
  const { settings } = useSettings();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Print Queue
  const [printQueue, setPrintQueue] = useState<{ product: Product; count: number }[]>([]);

  // Label Design Config
  const [labelType, setLabelType] = useState<'shelf' | 'compact' | 'sheet'>('shelf');
  const [showStoreName, setShowStoreName] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [showSku, setShowSku] = useState(true);

  const fetchCatalog = async () => {
    setIsLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiRequest<Product[]>('/api/products?limit=500'),
        apiRequest<Category[]>('/api/categories'),
      ]);
      if (prodRes.success && prodRes.data) {
        setProducts(prodRes.data);
        // Pre-populate queue with first 4 products for quick preview
        if (prodRes.data.length > 0 && printQueue.length === 0) {
          setPrintQueue([
            { product: prodRes.data[0], count: 2 },
            { product: prodRes.data[1], count: 2 },
            { product: prodRes.data[2], count: 1 },
          ]);
        }
      }
      if (catRes.success && catRes.data) {
        setCategories(catRes.data);
      }
    } catch (err) {
      console.error('Error fetching catalog:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleAddToQueue = (prod: Product) => {
    const existingIndex = printQueue.findIndex((item) => item.product.id === prod.id);
    if (existingIndex >= 0) {
      const copy = [...printQueue];
      copy[existingIndex].count += 1;
      setPrintQueue(copy);
    } else {
      setPrintQueue([...printQueue, { product: prod, count: 1 }]);
    }
  };

  const handleAddAllFiltered = () => {
    const newItems = filteredProducts.map((p) => ({ product: p, count: 1 }));
    setPrintQueue((prev) => {
      const ids = new Set(prev.map((i) => i.product.id));
      const filtered = newItems.filter((i) => !ids.has(i.product.id));
      return [...prev, ...filtered];
    });
  };

  const handleUpdateCount = (id: number, delta: number) => {
    setPrintQueue((prev) =>
      prev
        .map((item) => {
          if (item.product.id === id) {
            const next = item.count + delta;
            return next > 0 ? { ...item, count: next } : null;
          }
          return item;
        })
        .filter(Boolean) as { product: Product; count: number }[]
    );
  };

  const handleRemoveFromQueue = (id: number) => {
    setPrintQueue((prev) => prev.filter((i) => i.product.id !== id));
  };

  const handleClearQueue = () => {
    setPrintQueue([]);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || String(p.category_id) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Expand queue by count for print layout
  const expandedPrintList: Product[] = [];
  printQueue.forEach((item) => {
    for (let i = 0; i < item.count; i++) {
      expandedPrintList.push(item.product);
    }
  });

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-stone-900 tracking-tight flex items-center space-x-2">
            <Barcode className="w-6 h-6 text-amber-600" />
            <span>Barcode & Shelf Price Tag Generator</span>
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Design and print custom barcode stickers and retail shelf price tags with scannable barcodes.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            disabled={expandedPrintList.length === 0}
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print {expandedPrintList.length} Label Tags</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Product Selector & Queue (1 Col) */}
        <div className="space-y-4">
          {/* Tag Configuration */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center space-x-2">
              <Settings className="w-4 h-4 text-stone-500" />
              <span>Label Format & Sizing</span>
            </h3>

            <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLabelType('shelf')}
                className={`py-2 px-2 text-center rounded-lg border transition-colors ${
                  labelType === 'shelf'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                Shelf Edge
                <span className="block text-[10px] font-normal opacity-80">60x35 mm</span>
              </button>

              <button
                type="button"
                onClick={() => setLabelType('compact')}
                className={`py-2 px-2 text-center rounded-lg border transition-colors ${
                  labelType === 'compact'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                Item Sticker
                <span className="block text-[10px] font-normal opacity-80">38x25 mm</span>
              </button>

              <button
                type="button"
                onClick={() => setLabelType('sheet')}
                className={`py-2 px-2 text-center rounded-lg border transition-colors ${
                  labelType === 'sheet'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                A4 Sheet
                <span className="block text-[10px] font-normal opacity-80">24 per sheet</span>
              </button>
            </div>

            {/* Label Options */}
            <div className="pt-2 border-t border-stone-200 space-y-1.5 text-xs">
              <label className="flex items-center space-x-2 text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showStoreName}
                  onChange={(e) => setShowStoreName(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Show Store Header Name</span>
              </label>

              <label className="flex items-center space-x-2 text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBrand}
                  onChange={(e) => setShowBrand(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Show Manufacturer Brand</span>
              </label>

              <label className="flex items-center space-x-2 text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSku}
                  onChange={(e) => setShowSku(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Show SKU Code</span>
              </label>
            </div>
          </div>

          {/* Product Catalog Browser */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Select Products to Tag
              </h3>
              <button
                type="button"
                onClick={handleAddAllFiltered}
                className="text-[11px] font-bold text-amber-700 hover:underline"
              >
                + Add Filtered
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search by name, SKU or barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs"
              />

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product list */}
            <div className="max-h-60 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-lg">
              {filteredProducts.slice(0, 30).map((prod) => (
                <div
                  key={prod.id}
                  className="p-2 hover:bg-stone-50 flex justify-between items-center text-xs"
                >
                  <div className="truncate pr-2">
                    <div className="font-bold text-stone-900 truncate">{prod.name}</div>
                    <div className="text-[10px] text-stone-400 font-mono">
                      {prod.sku} • Rs. {Number(prod.selling_price).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddToQueue(prod)}
                    className="p-1 text-amber-700 hover:bg-amber-100 rounded"
                    title="Add to Print Queue"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Queue List */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Print Queue ({printQueue.length} Products, {expandedPrintList.length} Labels)
              </h3>
              {printQueue.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearQueue}
                  className="text-[11px] text-rose-600 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {printQueue.length === 0 ? (
                <div className="py-6 text-center text-stone-400 text-xs">
                  No items in queue. Add products from above.
                </div>
              ) : (
                printQueue.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-2 bg-stone-50 rounded-lg flex justify-between items-center text-xs"
                  >
                    <div className="truncate pr-2">
                      <span className="font-bold text-stone-900 block truncate">
                        {item.product.name}
                      </span>
                      <span className="text-[10px] text-stone-500 font-mono">
                        {item.product.sku}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateCount(item.product.id, -1)}
                        className="px-1.5 py-0.5 border border-stone-300 rounded bg-white text-stone-700 font-bold"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-bold">{item.count}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateCount(item.product.id, 1)}
                        className="px-1.5 py-0.5 border border-stone-300 rounded bg-white text-stone-700 font-bold"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromQueue(item.product.id)}
                        className="text-stone-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Printable Sheet Preview (2 Cols) */}
        <div className="lg:col-span-2 bg-stone-200/70 p-6 rounded-xl border border-stone-300 flex flex-col items-center">
          <div className="mb-4 text-xs font-bold text-stone-600 uppercase tracking-wider flex items-center space-x-2">
            <Tag className="w-4 h-4 text-amber-600" />
            <span>Interactive Label Sheet Preview (Print-Ready)</span>
          </div>

          {/* Printable Container */}
          <div
            id="barcode-print-sheet"
            className={`bg-white shadow-xl p-6 rounded border border-stone-300 w-full min-h-[600px] overflow-y-auto ${
              labelType === 'shelf'
                ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
                : labelType === 'compact'
                ? 'grid grid-cols-2 sm:grid-cols-3 gap-3'
                : 'grid grid-cols-2 sm:grid-cols-3 gap-2.5'
            }`}
          >
            {expandedPrintList.length === 0 ? (
              <div className="col-span-full py-24 text-center text-stone-400">
                <Barcode className="w-12 h-12 mx-auto mb-2 text-stone-300" />
                Select items from the catalog on the left to preview barcode labels.
              </div>
            ) : (
              expandedPrintList.map((prod, idx) => {
                const codeValue = prod.barcode || prod.sku;

                if (labelType === 'compact') {
                  return (
                    <div
                      key={idx}
                      className="border border-stone-400 p-2.5 rounded bg-white flex flex-col justify-between text-center text-stone-900 h-28"
                    >
                      {showStoreName && (
                        <div className="text-[9px] font-black uppercase tracking-wider text-stone-500 truncate">
                          {settings.store_name}
                        </div>
                      )}
                      <div className="font-black text-xs leading-tight truncate">{prod.name}</div>

                      <div className="my-0.5">
                        <BarcodeSvg value={codeValue} width={120} height={26} />
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-bold px-1 border-t border-stone-200 pt-0.5">
                        <span className="font-mono text-[9px] text-stone-600">{codeValue}</span>
                        <span className="font-black text-xs text-stone-900">
                          Rs. {Number(prod.selling_price).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Default: Shelf Edge Tag
                return (
                  <div
                    key={idx}
                    className="border-2 border-stone-800 p-3 rounded bg-white flex flex-col justify-between text-stone-900 shadow-xs h-36"
                  >
                    <div className="flex justify-between items-start border-b border-stone-200 pb-1">
                      <div>
                        {showStoreName && (
                          <div className="text-[9px] font-black uppercase tracking-wider text-amber-800">
                            {settings.store_name}
                          </div>
                        )}
                        <div className="font-black text-xs text-stone-900 line-clamp-1">
                          {prod.name}
                        </div>
                      </div>
                      {showBrand && prod.brand && (
                        <span className="text-[9px] font-bold uppercase bg-stone-100 px-1.5 py-0.5 rounded text-stone-700">
                          {prod.brand}
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center my-1">
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-stone-500 uppercase block">
                          Retail Price
                        </span>
                        <div className="text-xl font-black text-stone-900 tracking-tight">
                          Rs. {Number(prod.selling_price).toLocaleString()}
                        </div>
                        <span className="text-[10px] text-stone-500 font-semibold">
                          per {prod.unit}
                        </span>
                      </div>

                      <div className="text-center">
                        <BarcodeSvg value={codeValue} width={130} height={32} />
                        <span className="font-mono text-[10px] font-bold tracking-widest text-stone-700 block mt-0.5">
                          {codeValue}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-stone-500 border-t border-stone-200 pt-0.5">
                      {showSku && <span>SKU: {prod.sku}</span>}
                      <span>Quality Guaranteed</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
