import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  User,
  UserPlus,
  Printer,
  CreditCard,
  Banknote,
  Building2,
  Clock,
  Check,
  AlertCircle,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  RotateCcw,
  QrCode,
  ScanLine,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Product, Customer, CartItem, Sale, Category } from '../types';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { InvoiceLookupModal } from '../components/pos/InvoiceLookupModal';
import { BarcodeSvg } from '../components/common/BarcodeSvg';

export const PosTerminal: React.FC = () => {
  // Products & Categories
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(1);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    address: '',
    credit_limit: '',
  });

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Credit' | 'Bank Transfer' | 'Card'>('Cash');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Completed Invoice Modal
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Invoice Barcode Scanning & Verification Center State
  const [showInvoiceLookupModal, setShowInvoiceLookupModal] = useState(false);
  const [activeInvoiceForLookup, setActiveInvoiceForLookup] = useState<Sale | null>(null);
  const [barcodeScanInput, setBarcodeScanInput] = useState('');
  const [isScanningInvoice, setIsScanningInvoice] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState<{ id: number; invoice_number: string; payment_status: string }[]>([]);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial products, categories, customers
  const fetchData = async () => {
    setIsLoadingProducts(true);
    try {
      const [prodRes, catRes, custRes] = await Promise.all([
        apiRequest<Product[]>('/api/products?status=active'),
        apiRequest<Category[]>('/api/categories'),
        apiRequest<Customer[]>('/api/customers'),
      ]);

      if (prodRes.success && prodRes.data) setProducts(prodRes.data);
      if (catRes.success && catRes.data) setCategories(catRes.data);
      if (custRes.success && custRes.data) {
        setCustomers(custRes.data);
        // Find walk-in customer id as default
        const walkIn = custRes.data.find((c) => c.is_walk_in);
        if (walkIn) setSelectedCustomerId(walkIn.id);
      }

      // Also fetch recent invoices for quick lookup chips
      try {
        const salesRes = await apiRequest<Sale[]>('/api/sales?limit=5');
        if (salesRes.success && salesRes.data) {
          setRecentInvoices(
            salesRes.data.map((s) => ({
              id: s.id,
              invoice_number: s.invoice_number,
              payment_status: s.payment_status,
            }))
          );
        }
      } catch (_) {}
    } catch (err: any) {
      console.error('Error loading POS data:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Quick Barcode Scanning Handler for receipts
  const handleScanInvoiceBarcode = async (inputCode?: string) => {
    const code = (inputCode || barcodeScanInput).trim();
    if (!code) {
      setActiveInvoiceForLookup(null);
      setShowInvoiceLookupModal(true);
      return;
    }

    setIsScanningInvoice(true);
    try {
      const res = await apiRequest<Sale>(`/api/sales/lookup/${encodeURIComponent(code)}`);
      if (res.success && res.data) {
        setActiveInvoiceForLookup(res.data);
      } else {
        setActiveInvoiceForLookup(null);
      }
      setShowInvoiceLookupModal(true);
      setBarcodeScanInput('');
    } catch (err) {
      setActiveInvoiceForLookup(null);
      setShowInvoiceLookupModal(true);
    } finally {
      setIsScanningInvoice(false);
    }
  };

  // Keyboard shortcut Ctrl+B or F2 to focus barcode scanner input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'b') || e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = selectedCategory === 'ALL' || p.category_id === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery)) ||
        (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || customers[0];
  }, [customers, selectedCustomerId]);

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.current_stock <= 0) {
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) => {
          if (item.product.id === product.id) {
            const newQty = item.quantity + 1;
            return {
              ...item,
              quantity: newQty,
              lineTotal: Math.max(0, newQty * item.unitPrice - item.discount),
            };
          }
          return item;
        });
      }

      // Add new item with default retail price
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unitPrice: product.selling_price,
          priceTier: 'retail',
          discount: 0,
          lineTotal: product.selling_price,
        },
      ];
    });
  };

  // Update quantity
  const updateQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          return {
            ...item,
            quantity: qty,
            lineTotal: Math.max(0, qty * item.unitPrice - item.discount),
          };
        }
        return item;
      })
    );
  };

  // Toggle Price Tier (Retail vs Wholesale)
  const togglePriceTier = (productId: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const nextTier = item.priceTier === 'retail' ? 'wholesale' : 'retail';
          const nextPrice =
            nextTier === 'wholesale' && item.product.wholesale_price > 0
              ? item.product.wholesale_price
              : item.product.selling_price;
          return {
            ...item,
            priceTier: nextTier,
            unitPrice: nextPrice,
            lineTotal: Math.max(0, item.quantity * nextPrice - item.discount),
          };
        }
        return item;
      })
    );
  };

  // Remove from cart
  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [cart]);

  const grandTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - (Number(orderDiscount) || 0));
  }, [cartSubtotal, orderDiscount]);

  // Sync paid amount when grand total changes or payment method toggled
  useEffect(() => {
    if (paymentMethod === 'Cash' || paymentMethod === 'Card' || paymentMethod === 'Bank Transfer') {
      setPaidAmount(grandTotal > 0 ? grandTotal.toString() : '');
    } else if (paymentMethod === 'Credit') {
      setPaidAmount('0');
    }
  }, [grandTotal, paymentMethod]);

  const numPaid = Number(paidAmount) || 0;
  const changeToReturn = Math.max(0, numPaid - grandTotal);
  const remainingDue = Math.max(0, grandTotal - numPaid);

  // Quick New Customer Submit
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) return;

    try {
      const res = await apiRequest<Customer>('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: newCustomerForm.name.trim(),
          phone: newCustomerForm.phone.trim(),
          address: newCustomerForm.address.trim(),
          credit_limit: Number(newCustomerForm.credit_limit) || 0,
        }),
      });

      if (res.success && res.data) {
        setCustomers((prev) => [res.data!, ...prev]);
        setSelectedCustomerId(res.data.id);
        setShowAddCustomerModal(false);
        setNewCustomerForm({ name: '', phone: '', address: '', credit_limit: '' });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create customer');
    }
  };

  // Complete Sale Checkout
  const handleCheckout = async () => {
    setErrorMsg(null);

    if (cart.length === 0) {
      setErrorMsg('Cart is empty. Please select products.');
      return;
    }

    if (selectedCustomer?.is_walk_in && remainingDue > 0 && paymentMethod === 'Cash') {
      setErrorMsg('Walk-in cash customers must pay the full bill. Select or create a contractor customer for Udhaar (Credit).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customer_id: selectedCustomerId,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount: item.discount,
        })),
        discount_amount: Number(orderDiscount) || 0,
        paid_amount: numPaid,
        payment_method: paymentMethod,
      };

      const res = await apiRequest<{ invoice: Sale; items: any[]; settings: any }>('/api/sales', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success && res.data) {
        const fullSale: Sale = {
          ...res.data.invoice,
          items: res.data.items,
          settings: res.data.settings,
        };

        // Open print modal
        setCompletedSale(fullSale);

        // Reset cart
        setCart([]);
        setOrderDiscount(0);

        // Refresh product stock list & customer balance
        fetchData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-stone-100">
      {/* ================= TOP SCANNER & BILL VERIFICATION BAR ================= */}
      <div className="bg-stone-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 shrink-0 shadow-md">
        {/* Left: Barcode Gun / Input Field */}
        <div className="flex items-center space-x-3 flex-1 min-w-[280px] max-w-2xl">
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] font-bold text-amber-400 shrink-0">
            <ScanLine className="w-3.5 h-3.5 animate-pulse text-amber-400" />
            <span>Barcode Gun Ready</span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleScanInvoiceBarcode();
            }}
            className="flex-1 flex items-center space-x-1.5"
          >
            <div className="relative flex-1">
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan Receipt Barcode with scanner gun OR enter Invoice # (Ctrl+B)..."
                value={barcodeScanInput}
                onChange={(e) => setBarcodeScanInput(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-stone-800/90 border border-stone-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg text-xs text-white placeholder-stone-400 font-medium"
              />
              <QrCode className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-400/80" />
            </div>

            <button
              type="submit"
              disabled={isScanningInvoice}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-xs flex items-center space-x-1"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isScanningInvoice ? 'Looking up...' : 'Verify Bill'}</span>
            </button>
          </form>
        </div>

        {/* Right: Quick Action Buttons & Recent Invoices */}
        <div className="flex items-center space-x-2">
          {recentInvoices.length > 0 && (
            <div className="hidden xl:flex items-center space-x-1.5 mr-2">
              <span className="text-[10px] uppercase font-bold text-stone-400">Recent Bills:</span>
              {recentInvoices.slice(0, 3).map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => handleScanInvoiceBarcode(rec.invoice_number)}
                  className="px-2 py-0.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded text-[10px] font-mono font-medium text-stone-300 hover:text-white flex items-center space-x-1 transition-colors"
                  title={`Quick verify ${rec.invoice_number}`}
                >
                  <span>{rec.invoice_number}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      rec.payment_status === 'PAID' ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveInvoiceForLookup(null);
              setShowInvoiceLookupModal(true);
            }}
            className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white rounded-lg text-xs font-bold border border-stone-700 flex items-center space-x-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>Return Items & Restock</span>
          </button>
        </div>
      </div>

      {/* Main POS Interface Columns */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* ================= LEFT COLUMN: PRODUCT SELECTION ================= */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-stone-200 bg-white">
        {/* Top Controls: Search Bar & Refresh */}
        <div className="p-4 border-b border-stone-200 flex items-center space-x-3 bg-stone-50/50">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search by product name, SKU, barcode (e.g. Paint, Cement, PVC, 8964...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-stone-300 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all shadow-xs"
            />
          </div>
          <button
            type="button"
            onClick={fetchData}
            title="Refresh Inventory"
            className="p-2 border border-stone-300 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Category Pills Slider */}
        <div className="px-4 py-2.5 border-b border-stone-200 overflow-x-auto flex space-x-2 bg-stone-50/30 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === 'ALL'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
            }`}
          >
            All Items ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          {isLoadingProducts ? (
            <div className="flex flex-col items-center justify-center h-64 text-stone-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
              <p className="text-xs">Loading store catalog...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-stone-400 space-y-2">
              <Package className="w-10 h-10 text-stone-300" />
              <p className="text-sm font-medium text-stone-600">No matching products found</p>
              <p className="text-xs text-stone-400">Try changing the category or search keywords</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map((product) => {
                const inCart = cart.find((i) => i.product.id === product.id);
                const isOutOfStock = product.current_stock <= 0;
                const isLowStock = !isOutOfStock && product.current_stock <= product.minimum_stock;

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => addToCart(product)}
                    className={`relative p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-150 ${
                      isOutOfStock
                        ? 'bg-stone-100 border-stone-200 opacity-60 cursor-not-allowed'
                        : inCart
                        ? 'bg-amber-50/50 border-amber-400 shadow-sm ring-1 ring-amber-400'
                        : 'bg-white border-stone-200 hover:border-amber-400 hover:shadow-xs active:scale-[0.99]'
                    }`}
                  >
                    {/* Top Tag: Unit & In-Cart Badge */}
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                        {product.unit}
                      </span>

                      {inCart && (
                        <span className="inline-flex items-center px-1.5 py-0.2 bg-amber-600 text-white rounded text-[10px] font-black">
                          {inCart.quantity} in cart
                        </span>
                      )}
                    </div>

                    {/* Product Name & Brand */}
                    <div className="mb-2">
                      <h4 className="text-xs font-bold text-stone-900 leading-snug line-clamp-2">
                        {product.name}
                      </h4>
                      <p className="text-[10px] text-stone-500 font-medium truncate mt-0.5">
                        {product.brand} | {product.sku}
                      </p>
                    </div>

                    {/* Pricing & Stock Status */}
                    <div className="pt-2 border-t border-stone-100 flex items-end justify-between w-full">
                      <div>
                        <div className="text-xs font-black text-stone-900">
                          Rs. {product.selling_price.toLocaleString()}
                        </div>
                        {product.wholesale_price > 0 && (
                          <div className="text-[9px] text-stone-500">
                            Ws: Rs. {product.wholesale_price.toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-800'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {isOutOfStock ? '0 Left' : `${product.current_stock} ${product.unit}`}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT COLUMN: FAST CART & CHECKOUT ================= */}
      <div className="w-full md:w-96 lg:w-[420px] bg-stone-50 flex flex-col h-full border-t md:border-t-0 shrink-0">
        {/* Customer Header Bar */}
        <div className="p-3.5 bg-white border-b border-stone-200 flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-2">
            <label className="block text-[10px] uppercase font-bold text-stone-500 tracking-wider mb-1">
              Customer / Khata Account
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
              className="w-full py-1.5 px-2.5 bg-stone-100 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.outstanding_balance > 0 ? `(Khata Due: Rs. ${c.outstanding_balance.toLocaleString()})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowAddCustomerModal(true)}
            title="Add New Customer"
            className="mt-4 p-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shrink-0 shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Customer Khata Pill Banner */}
        {selectedCustomer && !selectedCustomer.is_walk_in && (
          <div className="px-4 py-2 bg-amber-50/80 border-b border-amber-200 text-xs flex items-center justify-between text-amber-900">
            <div>
              <span className="font-semibold">Contractor Khata:</span>{' '}
              <span className="font-bold">Rs. {selectedCustomer.outstanding_balance?.toLocaleString()} Due</span>
            </div>
            <div className="text-[10px] text-amber-700">
              Limit: Rs. {selectedCustomer.credit_limit?.toLocaleString() || 'None'}
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-400 space-y-2 py-12">
              <ShoppingCart className="w-10 h-10 text-stone-300" />
              <p className="text-xs font-semibold text-stone-600">Cart is empty</p>
              <p className="text-[11px] text-stone-400 text-center max-w-[200px]">
                Click on any product from the catalog to add it to the bill.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="p-2.5 bg-white border border-stone-200 rounded-lg shadow-xs space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <h5 className="text-xs font-bold text-stone-900 truncate">
                      {item.product.name}
                    </h5>
                    <div className="text-[10px] text-stone-500">
                      {item.product.brand} | {item.product.unit}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-stone-400 hover:text-rose-600 p-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-100">
                  {/* Quantity Controls */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center font-bold text-stone-700"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.product.id, Math.max(1, Number(e.target.value)))}
                      className="w-12 text-center text-xs font-bold bg-stone-50 border border-stone-200 rounded py-0.5"
                    />
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center font-bold text-stone-700"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Price Tier Toggle */}
                  <button
                    type="button"
                    onClick={() => togglePriceTier(item.product.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                      item.priceTier === 'wholesale'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                    title="Toggle Retail / Wholesale Price"
                  >
                    {item.priceTier === 'wholesale' ? 'Wholesale' : 'Retail'}
                  </button>

                  {/* Line Total */}
                  <div className="font-black text-stone-900 text-right">
                    Rs. {item.lineTotal.toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Checkout & Payment Panel */}
        <div className="p-4 bg-white border-t border-stone-200 space-y-3 shadow-lg shrink-0">
          {/* Subtotal & Order Discount */}
          <div className="space-y-1.5 text-xs text-stone-600">
            <div className="flex justify-between">
              <span>Subtotal ({cart.length} items):</span>
              <span className="font-semibold text-stone-900">Rs. {cartSubtotal.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>Discount (Rs.):</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={orderDiscount || ''}
                onChange={(e) => setOrderDiscount(Math.max(0, Number(e.target.value)))}
                className="w-24 text-right px-2 py-0.5 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-between text-sm font-black text-stone-900 pt-1 border-t border-stone-200">
              <span>Grand Total:</span>
              <span className="text-amber-600">Rs. {grandTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-stone-500 tracking-wider mb-1">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'Cash', label: 'Cash', icon: Banknote },
                { id: 'Credit', label: 'Khata / Due', icon: User },
                { id: 'Bank Transfer', label: 'Bank / Jazz', icon: Building2 },
                { id: 'Card', label: 'Card', icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 mb-0.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Paid & Due / Return Calculation */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-500 mb-0.5">
                Paid Amount (Rs.)
              </label>
              <input
                type="number"
                min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="0"
                className="w-full px-2.5 py-1.5 font-bold text-stone-900 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              {changeToReturn > 0 ? (
                <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-center">
                  <span className="block text-[10px] font-bold uppercase">Change Return</span>
                  <span className="text-xs font-black">Rs. {changeToReturn.toLocaleString()}</span>
                </div>
              ) : (
                <div className="p-1.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-center">
                  <span className="block text-[10px] font-bold uppercase">Khata / Due Balance</span>
                  <span className="text-xs font-black">Rs. {remainingDue.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Checkout Button */}
          <div className="flex space-x-2 pt-1">
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setCart([])}
              className="px-3 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold rounded-xl text-xs transition-colors"
            >
              Clear
            </button>

            <button
              type="button"
              disabled={cart.length === 0 || isSubmitting}
              onClick={handleCheckout}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white font-black rounded-xl text-xs md:text-sm flex items-center justify-center space-x-2 shadow-md transition-all active:scale-[0.99]"
            >
              <Printer className="w-4 h-4" />
              <span>{isSubmitting ? 'Processing Bill...' : 'Complete & Print Bill'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODAL: QUICK ADD CUSTOMER ================= */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900">Add New Contractor / Customer</h3>

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Customer / Contractor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Haji Rashid (Contractor)"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="0300-1234567"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Address / Project Site</label>
                <input
                  type="text"
                  placeholder="e.g. Plot 42, Sector C"
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Credit Limit (Rs.)</label>
                <input
                  type="number"
                  placeholder="e.g. 100000"
                  value={newCustomerForm.credit_limit}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, credit_limit: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: PRINT COMPLETED RECEIPT ================= */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          onClose={() => setCompletedSale(null)}
        />
      )}

      {/* ================= MODAL: INVOICE BARCODE LOOKUP, QUICK PAY & SALES RETURN ================= */}
      {showInvoiceLookupModal && (
        <InvoiceLookupModal
          initialSale={activeInvoiceForLookup}
          onClose={() => {
            setShowInvoiceLookupModal(false);
            setActiveInvoiceForLookup(null);
          }}
          onInvoiceUpdated={(updatedSale) => {
            fetchData();
          }}
        />
      )}
      </div>
    </div>
  );
};
