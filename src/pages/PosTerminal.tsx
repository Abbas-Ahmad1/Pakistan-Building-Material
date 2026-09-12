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
  Wallet,
  ChevronDown,
  ChevronUp,
  X,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Product, Customer, CartItem, Sale, Category, CashDrawerShift } from '../types';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { InvoiceLookupModal } from '../components/pos/InvoiceLookupModal';
import { CashDrawerModal } from '../components/pos/CashDrawerModal';
import { BarcodeSvg } from '../components/common/BarcodeSvg';
import { useAuth } from '../context/AuthContext';

export const PosTerminal: React.FC = () => {
  const { user, branches, currentBranch, switchBranch } = useAuth();

  // Products & Categories
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [loadingFee, setLoadingFee] = useState<number>(0);

  // Customers & Contractor Khata State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(1);
  const [cashierName, setCashierName] = useState<string>('Imtiaz Ali');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [isContractorDropdownOpen, setIsContractorDropdownOpen] = useState(false);
  const [contractorSearchQuery, setContractorSearchQuery] = useState('');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
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

  // Cash Drawer Shift State
  const [activeShift, setActiveShift] = useState<CashDrawerShift | null>(null);
  const [showCashDrawerModal, setShowCashDrawerModal] = useState(false);
  const [isLoadingShift, setIsLoadingShift] = useState(false);

  // Fetch active cash drawer shift
  const fetchShiftData = async () => {
    const branchId = user?.branch_id || currentBranch?.id || 1;
    setIsLoadingShift(true);
    try {
      const res = await apiRequest<{
        hasActiveShift: boolean;
        shift?: CashDrawerShift;
      }>(`/api/cash-drawer/current?branch_id=${branchId}`);

      if (res.success && res.data?.hasActiveShift && res.data?.shift) {
        setActiveShift(res.data.shift);
      } else {
        setActiveShift(null);
      }
    } catch (_) {
      setActiveShift(null);
    } finally {
      setIsLoadingShift(false);
    }
  };

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
    fetchShiftData();
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

  // Keyboard shortcut Ctrl+B or F2 to focus barcode scanner input, F4 for cash drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'b') || e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setShowCashDrawerModal((prev) => !prev);
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
            const wasFullyDelivered = (item.delivered_quantity ?? item.quantity) >= item.quantity;
            return {
              ...item,
              quantity: newQty,
              delivered_quantity: wasFullyDelivered ? newQty : (item.delivered_quantity ?? newQty),
              lineTotal: Math.max(0, Math.round((newQty * item.unitPrice - item.discount) * 100) / 100),
            };
          }
          return item;
        });
      }

      // Add new item with default retail price and 100% picked up by default
      return [
        ...prev,
        {
          product,
          quantity: 1,
          delivered_quantity: 1,
          unitPrice: product.selling_price,
          priceTier: 'retail',
          discount: 0,
          lineTotal: Math.round(product.selling_price * 100) / 100,
        },
      ];
    });
  };

  // Update total purchased quantity
  const updateQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const wasFullyDelivered = (item.delivered_quantity ?? item.quantity) >= item.quantity;
          const newDelivered = wasFullyDelivered ? qty : Math.min(qty, item.delivered_quantity ?? qty);
          return {
            ...item,
            quantity: qty,
            delivered_quantity: newDelivered,
            lineTotal: Math.max(0, Math.round((qty * item.unitPrice - item.discount) * 100) / 100),
          };
        }
        return item;
      })
    );
  };

  // Update delivered / picked up quantity
  const updateDeliveredQuantity = (productId: number, deliveredQty: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const clamped = Math.max(0, Math.min(item.quantity, deliveredQty));
          return {
            ...item,
            delivered_quantity: clamped,
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
            lineTotal: Math.max(0, Math.round((item.quantity * nextPrice - item.discount) * 100) / 100),
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
    return Math.round(cart.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  }, [cart]);

  const grandTotal = useMemo(() => {
    return Math.max(0, Math.round((cartSubtotal - (Number(orderDiscount) || 0) + (Number(loadingFee) || 0)) * 100) / 100);
  }, [cartSubtotal, orderDiscount, loadingFee]);

  // Delivery Units Summary for Cart
  const cartDeliveryTotals = useMemo(() => {
    let purchased = 0;
    let delivered = 0;
    for (const item of cart) {
      purchased += item.quantity;
      delivered += (item.delivered_quantity !== undefined ? item.delivered_quantity : item.quantity);
    }
    const remaining = Math.max(0, purchased - delivered);
    return { purchased, delivered, remaining };
  }, [cart]);

  // Sync paid amount when grand total changes or payment method toggled
  useEffect(() => {
    if (paymentMethod === 'Cash' || paymentMethod === 'Card' || paymentMethod === 'Bank Transfer') {
      setPaidAmount(grandTotal > 0 ? grandTotal.toString() : '');
    } else if (paymentMethod === 'Credit') {
      setPaidAmount('0');
    }
  }, [grandTotal, paymentMethod]);

  const numPaid = Number(paidAmount) || 0;
  const changeToReturn = Math.max(0, Math.round((numPaid - grandTotal) * 100) / 100);
  const remainingDue = Math.max(0, Math.round((grandTotal - numPaid) * 100) / 100);

  // Filtered Contractors for the Contractor & Khata section
  const filteredCustomers = useMemo(() => {
    if (!contractorSearchQuery.trim()) return customers;
    const q = contractorSearchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, contractorSearchQuery]);

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
      const activeBranchId = user?.branch_id || currentBranch?.id || 1;
      const payload = {
        branch_id: activeBranchId,
        customer_id: selectedCustomerId,
        cashier_name: cashierName.trim() || 'Imtiaz Ali',
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          delivered_quantity: item.delivered_quantity !== undefined ? item.delivered_quantity : item.quantity,
          unit_price: item.unitPrice,
          discount: item.discount,
        })),
        discount_amount: Number(orderDiscount) || 0,
        loading_fee: Number(loadingFee) || 0,
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
          cashier_name: res.data.invoice.cashier_name || cashierName.trim() || 'Imtiaz Ali',
          items: res.data.items,
          settings: res.data.settings,
        };

        // Open print modal
        setCompletedSale(fullSale);

        // Reset cart
        setCart([]);
        setOrderDiscount(0);
        setLoadingFee(0);
        setIsMobileCartOpen(false);

        // Refresh product stock list & customer balance
        fetchData();
        fetchShiftData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-[100dvh] md:min-h-0 md:h-full overflow-y-auto md:overflow-hidden bg-stone-100 touch-scroll">
      {/* ================= TOP SCANNER & BILL VERIFICATION BAR ================= */}
      <div className="bg-stone-900 text-white px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-b border-stone-800 shrink-0 shadow-md">
        {/* Left: Barcode Gun / Input Field */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-[240px] sm:min-w-[280px] max-w-2xl">
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

        {/* Right: Quick Action Buttons, Branch/Cashier info, & Recent Invoices */}
        <div className="flex items-center space-x-2">
          {/* Daily Cash Drawer & Shift Closing (Cash-in-Hand Register) */}
          <button
            type="button"
            onClick={() => setShowCashDrawerModal(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center space-x-2 transition-all shadow-xs shrink-0 ${
              activeShift
                ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-600/50 text-emerald-300'
                : 'bg-amber-950/80 hover:bg-amber-900 border-amber-500 text-amber-300 ring-2 ring-amber-500/30'
            }`}
            title="Manage Cash Drawer, Petty Cash & End-of-Shift Closing"
          >
            <Wallet className={`w-3.5 h-3.5 ${activeShift ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-stone-400 leading-tight">
                {activeShift ? 'Cash Register' : 'Shift Closed'}
              </span>
              <span className="font-bold text-white text-xs">
                {activeShift
                  ? `Rs. ${(activeShift.runningMetrics?.expected_closing_cash ?? activeShift.expected_closing_cash ?? 0).toLocaleString()}`
                  : 'Open Shift (F4)'}
              </span>
            </div>
          </button>

          {/* Active Branch & Cashier Shift Tag */}
          <div className="flex items-center space-x-2 bg-stone-800/90 py-1 px-2.5 rounded-lg border border-stone-700 text-xs shrink-0">
            <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-stone-400 leading-tight">Terminal Branch</span>
              <select
                value={user?.branch_id || currentBranch?.id || 1}
                onChange={async (e) => {
                  const bId = Number(e.target.value);
                  await switchBranch(bId);
                  fetchData();
                  fetchShiftData();
                }}
                className="bg-stone-800 text-amber-300 font-bold text-xs focus:outline-none cursor-pointer rounded border-none p-0 pr-1 max-w-[140px] truncate"
              >
                {branches && branches.length > 0 ? (
                  branches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-stone-900 text-white">
                      {b.name} ({b.code})
                    </option>
                  ))
                ) : (
                  <option value={1}>Branch 1 (BR-01)</option>
                )}
              </select>
            </div>
            <div className="w-px h-5 bg-stone-700 mx-0.5" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-stone-400 leading-tight">Cashier Shift</span>
              <span className="font-bold text-white text-xs truncate max-w-[100px]">{user?.name || 'Cashier'}</span>
            </div>
          </div>

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

      {/* Alert Banner if Cash Register Shift is Closed */}
      {!activeShift && !isLoadingShift && (
        <div className="bg-amber-50 border-b border-amber-300 px-4 py-2 text-xs flex items-center justify-between text-amber-900 shrink-0">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Shift Closed:</strong> Cash drawer is currently closed for this branch. Open register shift to log opening cash float and petty expenses.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowCashDrawerModal(true)}
            className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
          >
            Open Shift (F4)
          </button>
        </div>
      )}

      {/* Main POS Interface Columns */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-visible md:overflow-hidden">
        {/* ================= LEFT COLUMN: PRODUCT SELECTION ================= */}
        <div className="flex-1 flex flex-col min-w-0 border-r-0 md:border-r border-stone-200 bg-white overflow-visible md:overflow-hidden">
        {/* Top Controls: Search Bar & Refresh */}
        <div className="p-3 md:p-4 border-b border-stone-200 flex items-center space-x-2 md:space-x-3 bg-stone-50/80 sticky top-0 z-10 backdrop-blur-xs">
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
            className="p-2 border border-stone-300 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Category Pills Slider */}
        <div className="px-3 md:px-4 py-2 md:py-2.5 border-b border-stone-200 overflow-x-auto flex space-x-2 bg-stone-50/40 no-scrollbar touch-pan-x">
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
        <div className="p-3 md:p-4 md:flex-1 md:overflow-y-auto overflow-visible pb-28 md:pb-4 touch-scroll">
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

      {/* Mobile Sticky Floating Cart Summary Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-stone-900/95 backdrop-blur-md border-t border-stone-800 text-white z-40 shadow-[0_-4px_25px_rgba(0,0,0,0.35)] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-stone-950 font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                {cart.length}
              </span>
            )}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-stone-300">
              {cart.length} {cart.length === 1 ? 'item' : 'items'} in Cart
            </div>
            <div className="text-xs font-black text-amber-400">
              Rs. {grandTotal.toLocaleString()}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileCartOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white rounded-xl text-xs font-black shadow-md flex items-center space-x-2 transition-all"
        >
          <span>View Cart & Pay</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* ================= RIGHT COLUMN: FAST CART & CHECKOUT (DESKTOP) ================= */}
      <div className="hidden md:flex w-full md:w-[420px] lg:w-[460px] xl:w-[480px] bg-stone-50 flex-col h-full border-t md:border-t-0 shrink-0 relative overflow-hidden">
        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center space-x-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Scrollable Cart Body: Contractor & Khata + Cart Items + Order Breakdown */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col divide-y divide-stone-200/80">
          {/* ================= 1. CONTRACTOR & KHATA SECTION ================= */}
          <div className="p-4 bg-white space-y-3 shrink-0">
            {/* Cashier / Billed By Input */}
            <div className="bg-stone-50/90 p-2.5 rounded-xl border border-stone-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="cashier-name-desktop" className="text-[11px] font-bold text-stone-700 flex items-center space-x-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Cashier / Billed By</span>
                </label>
                <div className="flex items-center space-x-1.5 text-[10px]">
                  {cashierName !== 'Imtiaz Ali' && (
                    <button
                      type="button"
                      onClick={() => setCashierName('Imtiaz Ali')}
                      className="text-amber-700 hover:text-amber-900 font-bold underline"
                      title="Reset to default (Imtiaz Ali)"
                    >
                      Reset (Imtiaz Ali)
                    </button>
                  )}
                  <span className="text-stone-400 font-medium">Prints on Bill</span>
                </div>
              </div>
              <div className="relative">
                <input
                  id="cashier-name-desktop"
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  placeholder="Cashier Name (e.g. Imtiaz Ali)"
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Section Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-stone-900 uppercase tracking-wide">
                    Contractor & Khata Section
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Select customer account for credit ledger or cash bill
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-colors shadow-2xs shrink-0"
                title="Add new contractor or builder account"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ New Account</span>
              </button>
            </div>

            {/* Dropdown / Selection Box */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsContractorDropdownOpen(!isContractorDropdownOpen)}
                className="w-full p-3 bg-stone-50 hover:bg-stone-100/90 border border-stone-300 rounded-xl flex items-center justify-between text-left transition-colors shadow-2xs group"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-black shrink-0">
                    {selectedCustomer?.name ? selectedCustomer.name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-stone-900 truncate">
                        {selectedCustomer?.name || 'Walk-in Cash Customer'}
                      </span>
                      {selectedCustomer?.is_walk_in ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-700">
                          Walk-in
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Khata Account
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                      {selectedCustomer?.phone || 'No phone recorded'} • {selectedCustomer?.address || 'Kumber Bazar'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 ml-2">
                  {!selectedCustomer?.is_walk_in && (
                    <div className="text-right">
                      <div className="text-[9px] uppercase font-bold text-stone-400">Khata Due</div>
                      <div className="text-xs font-black text-rose-700">
                        Rs. {selectedCustomer?.outstanding_balance?.toLocaleString()}
                      </div>
                    </div>
                  )}
                  <div className="w-6 h-6 rounded-md bg-white border border-stone-200 flex items-center justify-center text-stone-600 group-hover:text-stone-900">
                    {isContractorDropdownOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>
              </button>

              {/* Contractor & Khata Selector Dropdown Panel */}
              {isContractorDropdownOpen && (
                <div className="mt-2 p-3 bg-white border border-stone-200 rounded-xl shadow-xl space-y-2.5 z-30">
                  {/* Search Input with generous padding */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search contractor name, phone number, or project site..."
                      value={contractorSearchQuery}
                      onChange={(e) => setContractorSearchQuery(e.target.value)}
                      autoFocus
                      className="w-full pl-8 pr-7 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    {contractorSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setContractorSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Scrollable Contractor List with INCREASED MAX-HEIGHT (max-h-72) */}
                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-stone-400 text-xs space-y-2">
                        <p>No contractor found matching "{contractorSearchQuery}"</p>
                        <button
                          type="button"
                          onClick={() => setShowAddCustomerModal(true)}
                          className="px-3 py-1 bg-amber-600 text-white rounded text-[11px] font-bold"
                        >
                          Add as New Contractor
                        </button>
                      </div>
                    ) : (
                      filteredCustomers.map((cust) => {
                        const isSelected = cust.id === selectedCustomerId;
                        const hasDue = cust.outstanding_balance > 0;
                        return (
                          <button
                            key={cust.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(cust.id);
                              setIsContractorDropdownOpen(false);
                              setContractorSearchQuery('');
                            }}
                            className={`w-full p-2.5 rounded-xl text-left border flex items-center justify-between transition-all ${
                              isSelected
                                ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400'
                                : 'bg-stone-50/60 hover:bg-stone-100 border-stone-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-stone-900 truncate">
                                  {cust.name}
                                </span>
                                {cust.is_walk_in ? (
                                  <span className="text-[10px] text-stone-500 font-semibold">(Walk-in)</span>
                                ) : (
                                  <span className="text-[10px] text-amber-700 font-bold">(Contractor)</span>
                                )}
                              </div>
                              <div className="text-[11px] text-stone-500 truncate mt-0.5">
                                {cust.phone ? `Ph: ${cust.phone}` : 'No phone'} {cust.address ? `• ${cust.address}` : ''}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {hasDue ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                  Due: Rs. {cust.outstanding_balance.toLocaleString()}
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Clear Khata
                                </span>
                              )}
                              {cust.credit_limit > 0 && (
                                <div className="text-[9px] text-stone-400 mt-0.5">
                                  Limit: Rs. {cust.credit_limit.toLocaleString()}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Roomy Contractor Khata Active Ledger Details Card */}
            {selectedCustomer && !selectedCustomer.is_walk_in && (
              <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-300 rounded-xl space-y-2 text-amber-950 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Contractor Khata Active Ledger</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                    {selectedCustomer.phone || 'Verified'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-amber-200/80 text-xs">
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-200">
                    <span className="block text-[10px] uppercase font-bold text-stone-500">Current Due (Khata)</span>
                    <span className="text-sm font-black text-rose-700">
                      Rs. {selectedCustomer.outstanding_balance?.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-white/80 p-2 rounded-lg border border-amber-200">
                    <span className="block text-[10px] uppercase font-bold text-stone-500">Credit Limit</span>
                    <span className="text-xs font-bold text-stone-800">
                      {selectedCustomer.credit_limit > 0
                        ? `Rs. ${selectedCustomer.credit_limit.toLocaleString()}`
                        : 'No Cap (Open)'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ================= 2. CART ITEMS LIST ================= */}
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                Cart Items ({cart.length})
              </span>
              {cart.length > 0 && (
                <span className="text-[11px] text-stone-500 font-medium">
                  {cartDeliveryTotals.delivered} Picked • {cartDeliveryTotals.remaining} Pending
                </span>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-stone-400 space-y-2 py-10 bg-white rounded-xl border border-dashed border-stone-200">
                <ShoppingCart className="w-10 h-10 text-stone-300" />
                <p className="text-xs font-semibold text-stone-600">Cart is empty</p>
                <p className="text-[11px] text-stone-400 text-center max-w-[200px]">
                  Click on any product from the catalog to add it to the bill.
                </p>
              </div>
            ) : (
              cart.map((item) => {
                const delivered = item.delivered_quantity !== undefined ? item.delivered_quantity : item.quantity;
                const remaining = Math.max(0, item.quantity - delivered);
                const isFullyDelivered = remaining === 0;
                const isPendingPickup = delivered === 0;

                return (
                  <div
                    key={item.product.id}
                    className={`p-3 bg-white border rounded-xl shadow-xs space-y-2.5 transition-all ${
                      remaining > 0 ? 'border-amber-300 bg-amber-50/15 ring-1 ring-amber-300/50' : 'border-stone-200'
                    }`}
                  >
                    {/* Item Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <h5 className="text-xs font-bold text-stone-900 truncate">
                          {item.product.name}
                        </h5>
                        <div className="text-[10px] text-stone-500 flex items-center space-x-2 mt-0.5">
                          <span>{item.product.brand}</span>
                          <span>•</span>
                          <span className="font-semibold text-stone-600 uppercase">{item.product.unit}</span>
                          <span>•</span>
                          <span>SKU: {item.product.sku}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-stone-400 hover:text-rose-600 p-1 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Dual Columns: Total Purchased vs Delivered / Picked Up */}
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/80 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Column 1: Total Purchased (Paid) */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-stone-600 tracking-wider mb-1">
                            Total Purchased:
                          </label>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="w-6 h-6 rounded-md bg-white hover:bg-stone-200 border border-stone-300 flex items-center justify-center font-bold text-stone-700 shadow-2xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product.id, Math.max(1, Number(e.target.value)))}
                              className="w-full text-center text-xs font-black bg-white border border-stone-300 rounded py-1 text-stone-900 focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="w-6 h-6 rounded-md bg-white hover:bg-stone-200 border border-stone-300 flex items-center justify-center font-bold text-stone-700 shadow-2xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Column 2: Delivered / Picked Up */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold uppercase text-stone-600 tracking-wider">
                              Delivered / Picked:
                            </label>
                            <button
                              type="button"
                              onClick={() => updateDeliveredQuantity(item.product.id, item.quantity)}
                              className="text-[9px] font-bold text-amber-700 hover:text-amber-900 underline"
                              title="Set full pickup now"
                            >
                              All
                            </button>
                          </div>
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={delivered}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                updateDeliveredQuantity(item.product.id, isNaN(val) ? 0 : val);
                              }}
                              className={`w-full text-center text-xs font-black bg-white border rounded py-1 focus:ring-1 focus:ring-amber-500 ${
                                remaining > 0 ? 'border-amber-400 text-amber-950 bg-amber-50/50' : 'border-stone-300 text-stone-900'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => updateDeliveredQuantity(item.product.id, 0)}
                              className="px-2 py-1 text-[10px] font-bold rounded-md bg-stone-200 hover:bg-stone-300 text-stone-700 shadow-2xs"
                              title="Set to 0 (Customer will pick up later)"
                            >
                              0
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Auto-Calculated Remaining Balance Row */}
                      <div className="pt-1.5 border-t border-stone-200/60 flex items-center justify-between text-[11px]">
                        <span className="text-[10px] font-semibold text-stone-500">Delivery Status:</span>
                        {isFullyDelivered ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3" />
                            <span>Fully Picked ({delivered} {item.product.unit})</span>
                          </span>
                        ) : isPendingPickup ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800">
                            <span>Pending: {remaining} {item.product.unit} remaining</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            <span>Picked: {delivered} | Balance: {remaining} {item.product.unit}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pricing Row: Price Tier, Unit Price & Grand Charged Line Total */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-100">
                      <div className="flex items-center space-x-2">
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
                        <span className="text-[10px] text-stone-500">
                          @ Rs. {item.unitPrice.toLocaleString()}
                        </span>
                      </div>

                      <div className="text-right">
                        <div className="font-black text-stone-900">
                          Rs. {item.lineTotal.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-stone-400">
                          Billed on {item.quantity} {item.product.unit}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ================= 3. CHECKOUT BREAKDOWN & PAYMENT METHOD ================= */}
          <div className="p-4 bg-white space-y-3.5">
            {/* Partial Delivery Notice Banner */}
            {cartDeliveryTotals.remaining > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs flex items-center justify-between shadow-2xs">
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="font-bold text-[11px]">Partial Delivery Scheduled:</span>
                </div>
                <div className="text-[11px] font-black">
                  {cartDeliveryTotals.delivered} Picked | <span className="text-amber-700">{cartDeliveryTotals.remaining} Pending</span>
                </div>
              </div>
            )}

            {/* Subtotal & Order Discount */}
            <div className="space-y-2 text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-200">
              <div className="flex justify-between">
                <span>Subtotal ({cart.length} items):</span>
                <span className="font-semibold text-stone-900">Rs. {cartSubtotal.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between">
                <span>Order Discount (Rs.):</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={orderDiscount || ''}
                  onChange={(e) => setOrderDiscount(Math.max(0, Number(e.target.value)))}
                  className="w-28 text-right px-2.5 py-1 text-xs font-bold border border-stone-300 rounded-lg focus:ring-1 focus:ring-amber-500 bg-white"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <span>Loading / Unloading Fee:</span>
                  <span className="text-[10px] text-stone-400 font-normal">(Optional)</span>
                </span>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 text-[11px] font-bold">Rs.</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={loadingFee || ''}
                    onChange={(e) => setLoadingFee(Math.max(0, Number(e.target.value)))}
                    className="w-28 text-right pl-7 pr-2.5 py-1 text-xs font-bold border border-stone-300 rounded-lg focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-between text-sm font-black text-stone-900 pt-2 border-t border-stone-200">
                <span>Grand Total:</span>
                <span className="text-amber-600 text-base">Rs. {grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-500 tracking-wider mb-1.5">
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
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center transition-all ${
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
                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                  Paid Amount (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-2 font-bold text-stone-900 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                  {changeToReturn > 0 ? 'Change Return' : 'Khata / Due'}
                </label>
                {changeToReturn > 0 ? (
                  <div className="py-2 px-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-center">
                    <span className="text-xs font-black">Rs. {changeToReturn.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="py-2 px-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-center">
                    <span className="text-xs font-black">Rs. {remainingDue.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= 4. STICKY / FIXED BOTTOM CHECKOUT BUTTON ================= */}
        <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md p-3.5 md:p-4 border-t border-stone-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] shrink-0 flex items-center space-x-2.5">
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={() => setCart([])}
            className="px-3 py-3 bg-stone-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-stone-200 disabled:opacity-40 disabled:hover:bg-stone-100 disabled:hover:text-stone-400 text-stone-600 font-bold rounded-2xl text-xs transition-colors shrink-0 flex flex-col items-center justify-center min-w-[52px]"
            title="Clear Cart"
          >
            <Trash2 className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Clear</span>
          </button>

          <button
            type="button"
            disabled={cart.length === 0 || isSubmitting}
            onClick={handleCheckout}
            className="flex-1 py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-500 hover:to-teal-600 active:scale-[0.98] disabled:from-stone-300 disabled:to-stone-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black rounded-2xl text-xs md:text-sm flex items-center justify-between shadow-lg shadow-emerald-700/25 border border-emerald-500/30 transition-all group"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Printer className="w-4 h-4 text-emerald-100" />
                )}
              </div>
              <div className="text-left truncate">
                <div className="text-[11px] sm:text-xs font-black tracking-wide uppercase leading-tight">
                  {isSubmitting ? 'Processing Bill...' : 'Payment / Confirm Order'}
                </div>
                <div className="text-[10px] text-emerald-100/90 font-medium leading-tight mt-0.5">
                  {cart.length} {cart.length === 1 ? 'item' : 'items'} • {paymentMethod}
                </div>
              </div>
            </div>

            <div className="px-2.5 py-1 bg-white text-emerald-900 rounded-xl font-black text-xs sm:text-sm shadow-xs shrink-0 ml-2">
              Rs. {grandTotal.toLocaleString()}
            </div>
          </button>
        </div>
      </div>

      {/* ================= MOBILE CART MODAL / DRAWER ================= */}
      {isMobileCartOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-stone-50 h-[100dvh] max-h-[100dvh] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-3.5 bg-stone-900 text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Cart & Order ({cart.length} items)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(false)}
                className="p-1.5 text-stone-400 hover:text-white rounded-lg bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Entire Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col divide-y divide-stone-200/80">
              {/* Contractor & Khata Section (Mobile) */}
              <div className="p-4 bg-white space-y-3 shrink-0">
                {/* Cashier / Billed By Input (Mobile) */}
                <div className="bg-stone-50/90 p-2.5 rounded-xl border border-stone-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="cashier-name-mobile" className="text-[11px] font-bold text-stone-700 flex items-center space-x-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                      <span>Cashier / Billed By</span>
                    </label>
                    <div className="flex items-center space-x-1.5 text-[10px]">
                      {cashierName !== 'Imtiaz Ali' && (
                        <button
                          type="button"
                          onClick={() => setCashierName('Imtiaz Ali')}
                          className="text-amber-700 hover:text-amber-900 font-bold underline"
                          title="Reset to default (Imtiaz Ali)"
                        >
                          Reset (Imtiaz Ali)
                        </button>
                      )}
                      <span className="text-stone-400 font-medium">Prints on Bill</span>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      id="cashier-name-mobile"
                      type="text"
                      value={cashierName}
                      onChange={(e) => setCashierName(e.target.value)}
                      placeholder="Cashier Name (e.g. Imtiaz Ali)"
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all shadow-2xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-stone-900 uppercase tracking-wide">
                        Contractor & Khata Section
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Customer account for ledger or cash bill
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(true)}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-colors shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ New</span>
                  </button>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsContractorDropdownOpen(!isContractorDropdownOpen)}
                    className="w-full p-3 bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded-xl flex items-center justify-between text-left transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-black shrink-0">
                        {selectedCustomer?.name ? selectedCustomer.name.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-stone-900 truncate">
                            {selectedCustomer?.name || 'Walk-in Cash Customer'}
                          </span>
                          {selectedCustomer?.is_walk_in ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-700">
                              Walk-in
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Khata
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                          {selectedCustomer?.phone || 'No phone'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 ml-2">
                      {!selectedCustomer?.is_walk_in && (
                        <span className="text-xs font-black text-rose-700">
                          Rs. {selectedCustomer?.outstanding_balance?.toLocaleString()}
                        </span>
                      )}
                      <div className="w-6 h-6 rounded-md bg-white border border-stone-200 flex items-center justify-center text-stone-600">
                        {isContractorDropdownOpen ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>
                  </button>

                  {isContractorDropdownOpen && (
                    <div className="mt-2 p-3 bg-white border border-stone-200 rounded-xl shadow-xl space-y-2.5 z-30">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search contractor..."
                          value={contractorSearchQuery}
                          onChange={(e) => setContractorSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-7 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                        {contractorSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setContractorSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                        {filteredCustomers.map((cust) => {
                          const isSelected = cust.id === selectedCustomerId;
                          return (
                            <button
                              key={cust.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomerId(cust.id);
                                setIsContractorDropdownOpen(false);
                                setContractorSearchQuery('');
                              }}
                              className={`w-full p-2.5 rounded-xl text-left border flex items-center justify-between transition-all ${
                                isSelected
                                  ? 'bg-amber-50 border-amber-400'
                                  : 'bg-stone-50/60 border-stone-200'
                              }`}
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <div className="text-xs font-bold text-stone-900 truncate">
                                  {cust.name}
                                </div>
                                <div className="text-[11px] text-stone-500 truncate">
                                  {cust.phone || 'No phone'}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {cust.outstanding_balance > 0 ? (
                                  <span className="text-[10px] font-black text-rose-700">
                                    Rs. {cust.outstanding_balance.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-700">Clear</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {selectedCustomer && !selectedCustomer.is_walk_in && (
                  <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-amber-900">
                      <span>Contractor Khata Due:</span>
                      <span className="text-rose-700 font-black">
                        Rs. {selectedCustomer.outstanding_balance?.toLocaleString()}
                      </span>
                    </div>
                    {selectedCustomer.credit_limit > 0 && (
                      <div className="flex justify-between text-[11px] text-stone-600">
                        <span>Credit Limit:</span>
                        <span>Rs. {selectedCustomer.credit_limit.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cart Items List (Mobile) */}
              <div className="p-3.5 space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-600 px-1 block">
                  Items in Bill ({cart.length})
                </span>
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-stone-400 text-xs">Cart is empty</div>
                ) : (
                  cart.map((item) => {
                    const delivered = item.delivered_quantity !== undefined ? item.delivered_quantity : item.quantity;
                    const remaining = Math.max(0, item.quantity - delivered);
                    return (
                      <div key={item.product.id} className="p-3 bg-white border border-stone-200 rounded-xl shadow-xs space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-2">
                            <h5 className="text-xs font-bold text-stone-900 truncate">{item.product.name}</h5>
                            <p className="text-[10px] text-stone-500">{item.product.brand} • {item.product.unit}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-stone-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-stone-50 p-2 rounded-lg text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-stone-600 block mb-0.5">Purchased:</span>
                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                className="w-6 h-6 rounded bg-white border border-stone-300 font-bold"
                              >
                                -
                              </button>
                              <span className="font-black px-2">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                className="w-6 h-6 rounded bg-white border border-stone-300 font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-stone-600 block mb-0.5">Picked:</span>
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={delivered}
                                onChange={(e) => updateDeliveredQuantity(item.product.id, Number(e.target.value) || 0)}
                                className="w-14 text-center font-bold border rounded py-0.5 bg-white text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => updateDeliveredQuantity(item.product.id, item.quantity)}
                                className="text-[10px] font-bold text-amber-700 underline"
                              >
                                All
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-100">
                          <button
                            type="button"
                            onClick={() => togglePriceTier(item.product.id)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-700"
                          >
                            {item.priceTier === 'wholesale' ? 'Wholesale' : 'Retail'} @ Rs. {item.unitPrice.toLocaleString()}
                          </button>
                          <span className="font-black text-stone-900">Rs. {item.lineTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Checkout Breakdown (Mobile) */}
              <div className="p-4 bg-white space-y-3">
                <div className="space-y-1.5 text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-bold text-stone-900">Rs. {cartSubtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Discount:</span>
                    <input
                      type="number"
                      min="0"
                      value={orderDiscount || ''}
                      onChange={(e) => setOrderDiscount(Math.max(0, Number(e.target.value)))}
                      className="w-24 text-right px-2 py-0.5 border rounded bg-white text-xs font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <span>Loading / Unloading Fee:</span>
                      <span className="text-[10px] text-stone-400 font-normal">(Opt)</span>
                    </span>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 text-[10px] font-bold">Rs.</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={loadingFee || ''}
                        onChange={(e) => setLoadingFee(Math.max(0, Number(e.target.value)))}
                        className="w-24 text-right pl-6 pr-2 py-0.5 border rounded bg-white text-xs font-bold"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm font-black text-stone-900 pt-1 border-t border-stone-200">
                    <span>Grand Total:</span>
                    <span className="text-amber-600">Rs. {grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {['Cash', 'Credit', 'Bank Transfer', 'Card'].map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setPaymentMethod(pm as any)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold ${
                          paymentMethod === pm
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {pm === 'Credit' ? 'Khata' : pm === 'Bank Transfer' ? 'Bank' : pm}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 mb-0.5">Paid (Rs.)</label>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full px-2 py-1.5 font-bold border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 mb-0.5">
                      {changeToReturn > 0 ? 'Change' : 'Khata Due'}
                    </label>
                    <div className="py-1.5 px-2 bg-stone-100 font-black rounded-lg text-center">
                      Rs. {(changeToReturn > 0 ? changeToReturn : remainingDue).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Drawer Sticky Checkout Button */}
            <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 border-t border-stone-200 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] shrink-0 flex items-center space-x-2.5">
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setCart([])}
                className="px-3 py-3 bg-stone-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-stone-200 disabled:opacity-40 disabled:hover:bg-stone-100 disabled:hover:text-stone-400 text-stone-600 font-bold rounded-2xl text-xs transition-colors shrink-0 flex flex-col items-center justify-center min-w-[52px]"
                title="Clear Cart"
              >
                <Trash2 className="w-4 h-4 mb-0.5" />
                <span className="text-[10px] uppercase tracking-wider font-bold">Clear</span>
              </button>

              <button
                type="button"
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleCheckout}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-500 hover:to-teal-600 active:scale-[0.98] disabled:from-stone-300 disabled:to-stone-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black rounded-2xl text-xs sm:text-sm flex items-center justify-between shadow-lg shadow-emerald-700/25 border border-emerald-500/30 transition-all group"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Printer className="w-4 h-4 text-emerald-100" />
                    )}
                  </div>
                  <div className="text-left truncate">
                    <div className="text-[11px] sm:text-xs font-black tracking-wide uppercase leading-tight">
                      {isSubmitting ? 'Processing Bill...' : 'Payment / Confirm Order'}
                    </div>
                    <div className="text-[10px] text-emerald-100/90 font-medium leading-tight mt-0.5">
                      {cart.length} {cart.length === 1 ? 'item' : 'items'} • {paymentMethod}
                    </div>
                  </div>
                </div>

                <div className="px-2.5 py-1 bg-white text-emerald-900 rounded-xl font-black text-xs sm:text-sm shadow-xs shrink-0 ml-2">
                  Rs. {grandTotal.toLocaleString()}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ================= MODAL: DAILY CASH REGISTER & SHIFT CLOSING ================= */}
      {showCashDrawerModal && (
        <CashDrawerModal
          branchId={user?.branch_id || currentBranch?.id || 1}
          onClose={() => setShowCashDrawerModal(false)}
          onShiftStatusChange={() => {
            fetchShiftData();
          }}
        />
      )}
      </div>
    </div>
  );
};
