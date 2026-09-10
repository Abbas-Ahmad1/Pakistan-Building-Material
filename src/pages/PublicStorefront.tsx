import React, { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Product, Category } from '../types';
import { apiRequest } from '../services/api';
import {
  Store,
  Phone,
  MapPin,
  Clock,
  Search,
  ShoppingCart,
  CheckCircle,
  Truck,
  ShieldCheck,
  Tag,
  MessageCircle,
  Lock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  X,
  Plus,
  Minus,
  Trash2,
  Paintbrush,
  Wrench,
  Layers,
  Sparkles,
  Building2,
  Send,
  HelpCircle,
} from 'lucide-react';

interface PublicStorefrontProps {
  onOpenLogin: () => void;
  onGoToDashboard?: () => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export const PublicStorefront: React.FC<PublicStorefrontProps> = ({
  onOpenLogin,
  onGoToDashboard,
}) => {
  const { settings } = useSettings();
  const { isAuthenticated, user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Inquiry form fields
  const [customerName, setCustomerName] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState<boolean>(false);
  const [inquirySuccessInfo, setInquirySuccessInfo] = useState<{ quotationNumber: string } | null>(null);

  // Fetch public products and categories
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [prodRes, catRes] = await Promise.all([
          apiRequest<Product[]>('/api/products?limit=100'),
          apiRequest<Category[]>('/api/categories'),
        ]);

        if (prodRes.success && Array.isArray(prodRes.data)) {
          setProducts(prodRes.data);
        }
        if (catRes.success && Array.isArray(catRes.data)) {
          setCategories(catRes.data);
        }
      } catch (err) {
        console.error('Failed to load public catalog:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        (p.brand && p.brand.toLowerCase().includes(query)) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.category_name && p.category_name.toLowerCase().includes(query));

      // Category
      const matchesCat =
        selectedCategory === 'all' ||
        p.category_id?.toString() === selectedCategory ||
        p.category_name?.toLowerCase() === selectedCategory.toLowerCase();

      // Stock
      const matchesStock = !onlyInStock || (p.current_stock && p.current_stock > 0);

      return matchesSearch && matchesCat && matchesStock;
    });
  }, [products, searchQuery, selectedCategory, onlyInStock]);

  // Cart operations
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalCartAmount = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + (item.product.selling_price || 0) * item.quantity,
      0
    );
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Phone numbers configuration
  const primaryPhone = settings.phone_primary || '+92 300 5936652';
  const secondaryPhone = settings.phone_secondary || '+92 300 1801818';

  const cleanPhone = (num: string) => {
    const digits = (num || '').replace(/[^0-9]/g, '');
    return digits.startsWith('92') ? digits : '92' + digits.replace(/^0/, '');
  };

  const waNumber1 = cleanPhone(primaryPhone);
  const waNumber2 = cleanPhone(secondaryPhone);

  // Generate WhatsApp inquiry link and save directly to SQLite backend
  const sendWhatsAppInquiry = async () => {
    if (cart.length === 0 || isSubmittingInquiry) return;
    setIsSubmittingInquiry(true);

    let createdQuotationNumber = '';
    try {
      // 1. Save quotation automatically to SQLite backend database
      const quotePayload = {
        customer_name: customerName.trim() || 'Online Customer / Contractor',
        customer_phone: customerPhone.trim() || 'Website Inquiry',
        project_title: customerAddress.trim() ? `Delivery Site: ${customerAddress.trim()}` : 'Website Material Estimate',
        notes: customerNotes.trim() || 'Submitted via online website catalog cart.',
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.selling_price || 0,
        })),
      };

      const res = await apiRequest<{ id: number; quotation_number: string }>('/api/quotations', {
        method: 'POST',
        body: JSON.stringify(quotePayload),
      });

      if (res.success && res.data?.quotation_number) {
        createdQuotationNumber = res.data.quotation_number;
        setInquirySuccessInfo({ quotationNumber: createdQuotationNumber });
      }
    } catch (e) {
      console.warn('Could not save estimate to database directly, continuing to WhatsApp:', e);
    } finally {
      setIsSubmittingInquiry(false);
    }

    // 2. Prepare WhatsApp message
    let message = `*Assalam o Alaikum! New Order / Estimate Inquiry*\n`;
    if (createdQuotationNumber) {
      message += `*Estimate Ref:* #${createdQuotationNumber}\n`;
    }
    message += `*Store:* ${settings.store_name}\n`;
    message += `*Proprietor:* ${settings.owner_name || 'Imtiaz Ali'}\n`;
    message += `*Location:* ${settings.address}\n`;
    message += `----------------------------------------\n`;

    if (customerName.trim()) {
      message += `*Customer/Contractor Name:* ${customerName.trim()}\n`;
    }
    if (customerPhone.trim()) {
      message += `*Contact:* ${customerPhone.trim()}\n`;
    }
    if (customerAddress.trim()) {
      message += `*Project Site / Delivery Address:* ${customerAddress.trim()}\n`;
    }
    if (customerNotes.trim()) {
      message += `*Special Note:* ${customerNotes.trim()}\n`;
    }

    message += `----------------------------------------\n`;
    message += `*Requested Items:*\n`;

    cart.forEach((item, index) => {
      const p = item.product;
      const subtotal = (p.selling_price || 0) * item.quantity;
      message += `${index + 1}. ${p.name} (${p.brand || 'Standard'})\n`;
      message += `   Qty: ${item.quantity} ${p.unit || 'pcs'} × Rs. ${p.selling_price?.toLocaleString()} = *Rs. ${subtotal.toLocaleString()}*\n`;
    });

    message += `----------------------------------------\n`;
    message += `*Total Estimated Value:* Rs. ${totalCartAmount.toLocaleString()}\n\n`;
    message += `Please confirm current stock availability, wholesale contractor discount, and delivery schedule. Thank you!`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${waNumber1}?text=${encoded}`, '_blank');
  };

  const sendSingleItemInquiry = (product: Product) => {
    const text = `Assalam o Alaikum Imtiaz Ali Sahib! I am interested in: *${product.name}* (${product.brand || 'Product SKU: ' + product.sku}) priced at Rs. ${product.selling_price?.toLocaleString()} per ${product.unit || 'unit'}. Please confirm wholesale availability at Kumber Bazar store.`;
    window.open(`https://wa.me/${waNumber1}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* 1. TOP ANNOUNCEMENT BAR */}
      <div className="bg-stone-900 text-stone-200 text-xs py-2 px-4 border-b border-stone-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center space-x-2 text-stone-300">
            <span className="font-semibold text-amber-400">🇵🇰 Pakistan Building Materials & Paint Store</span>
            <span className="text-stone-600 hidden md:inline">•</span>
            <span className="hidden md:inline text-stone-400">
              Proprietor: <strong className="text-stone-200">{settings.owner_name || 'Imtiaz Ali'}</strong>
            </span>
            <span className="text-stone-600 hidden lg:inline">•</span>
            <span className="hidden lg:inline text-stone-400">Wholesale & Retail Authorized Dealer</span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-stone-300">
              <a
                href={`tel:${primaryPhone.replace(/\s+/g, '')}`}
                className="flex items-center space-x-1 hover:text-amber-400 transition-colors font-semibold"
                title="Call Primary Phone"
              >
                <Phone className="w-3.5 h-3.5 text-amber-500" />
                <span>{primaryPhone}</span>
              </a>
              <span className="text-stone-600">/</span>
              <a
                href={`tel:${secondaryPhone.replace(/\s+/g, '')}`}
                className="hover:text-amber-400 transition-colors text-stone-300 font-medium"
                title="Call Secondary Phone"
              >
                <span>{secondaryPhone}</span>
              </a>
            </div>

            <div className="h-3 w-px bg-stone-700 hidden sm:block" />

            {/* Staff / POS Login Button */}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onGoToDashboard}
                className="flex items-center space-x-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium transition-colors shadow-xs"
              >
                <span>POS & Store Management</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="flex items-center space-x-1 text-stone-300 hover:text-amber-400 transition-colors"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Staff & Owner Login</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. MAIN STORE HEADER */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex items-center justify-between gap-4">
            {/* Store Brand / Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-700 to-amber-900 text-white flex items-center justify-center shadow-md border border-amber-600 shrink-0">
                <Store className="w-6 h-6 text-amber-100" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight leading-tight uppercase">
                  {settings.store_name}
                </h1>
                <p className="text-xs text-stone-600 font-medium hidden sm:block">
                  Proprietor: <span className="text-amber-900 font-bold">{settings.owner_name || 'Imtiaz Ali'}</span> • Hardware, Sanitary, Pipes & Paints
                </p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md hidden md:block">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search Berger paint, Sonex mixer, PPRC pipe, cement..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-xs bg-stone-50 focus:bg-white focus:ring-2 focus:ring-amber-600 focus:outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons (Cart / WhatsApp) */}
            <div className="flex items-center space-x-3">
              <a
                href={`https://wa.me/${waNumber1}?text=${encodeURIComponent('Assalam o Alaikum Imtiaz Ali Sahib! I want to inquire about building materials, sanitary and paint prices.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Order</span>
              </a>

              {/* Estimate / Inquiry Basket Button */}
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="relative flex items-center space-x-2 px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden sm:inline">Inquiry List</span>
                {totalItemsCount > 0 && (
                  <span className="bg-amber-400 text-stone-900 text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center -ml-1">
                    {totalItemsCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <div className="mt-3 md:hidden">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search paints, sanitary, valves, pipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-xs bg-stone-50 focus:bg-white focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION */}
      <section className="relative bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 text-white py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Wholesale & Retail Construction Depot • Imtiaz Ali</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
                Everything for Your Building, Sanitary & Paint Needs
              </h2>

              <p className="text-sm sm:text-base text-stone-300 max-w-2xl leading-relaxed">
                Authorized dealer of high-grade construction materials, Berger & Brighto paints, Master & Sonex sanitary fittings, PPRC/PVC water pipelines, and hardware tools. Direct supply for home owners, builders & commercial contractors.
              </p>

              {/* Value Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="flex items-center space-x-2 text-xs text-stone-200 bg-white/5 backdrop-blur-xs p-2.5 rounded-lg border border-white/10">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>100% Genuine Brands</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-stone-200 bg-white/5 backdrop-blur-xs p-2.5 rounded-lg border border-white/10">
                  <Tag className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Wholesale Contractor Rates</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-stone-200 bg-white/5 backdrop-blur-xs p-2.5 rounded-lg border border-white/10 col-span-2 sm:col-span-1">
                  <Truck className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Same-Day Site Loading</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex flex-wrap gap-3">
                <a
                  href="#catalog"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold tracking-wide transition-all shadow-md flex items-center space-x-2"
                >
                  <span>Explore Product Catalog</span>
                  <ChevronRight className="w-4 h-4" />
                </a>

                <a
                  href={`https://wa.me/${waNumber1}?text=${encodeURIComponent('Assalam o Alaikum Imtiaz Ali Sahib! We have a construction project and need a bulk quotation for cement, sanitary and paints.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold tracking-wide transition-all shadow-md flex items-center space-x-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Request WhatsApp Estimate</span>
                </a>
              </div>
            </div>

            {/* Quick Contact & Shop Card */}
            <div className="lg:col-span-4 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/15 text-stone-100 shadow-xl space-y-4">
              <div className="flex items-center space-x-3 pb-3 border-b border-white/15">
                <div className="w-10 h-10 rounded-lg bg-amber-500 text-stone-950 flex items-center justify-center font-black text-base">
                  IA
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{settings.owner_name || 'Imtiaz Ali'}</h3>
                  <p className="text-xs text-amber-300 font-medium">Proprietor / Managing Partner</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-stone-300">
                <div className="flex items-start space-x-2.5">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">{settings.address}</span>
                    <span className="text-[11px] text-stone-400">Kumber, Lower Dir (Maidan), KPK</span>
                  </div>
                </div>
                <div className="flex items-start space-x-2.5">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col space-y-0.5">
                    <div className="flex items-center space-x-1.5">
                      <a href={`tel:${primaryPhone.replace(/\s+/g, '')}`} className="font-bold text-emerald-300 hover:underline">
                        {primaryPhone}
                      </a>
                      <span className="text-[10px] bg-emerald-950/70 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-700/50">Primary / WhatsApp</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-stone-300">
                      <a href={`tel:${secondaryPhone.replace(/\s+/g, '')}`} className="hover:underline text-stone-200 font-medium">
                        {secondaryPhone}
                      </a>
                      <span className="text-[10px] text-stone-400">Secondary</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Sat – Thu (Full Week Open): 8:00 AM – 8:30 PM • Friday OFF (Emergency Loading Available)</span>
                </div>
              </div>

              <div className="pt-2">
                <div className="bg-stone-900/60 p-3 rounded-lg border border-white/10 text-center">
                  <span className="text-[11px] text-amber-300 font-bold block mb-1">
                    Special Contractor & Plumber Khata
                  </span>
                  <p className="text-[11px] text-stone-400">
                    Kachha Bill, Project Estimates and credit facility available for verified builders.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FEATURED PRODUCT CATEGORIES */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
              Major Department Categories
            </h2>
            <p className="text-xs text-stone-600 mt-1">
              Select a category to view in-stock products with live prices and wholesale rates
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className="text-xs text-amber-800 hover:text-amber-900 font-bold"
          >
            Show All Items ({products.length})
          </button>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { id: 'paints', label: 'Paints & Finishes', icon: Paintbrush, color: 'text-rose-600 bg-rose-50 border-rose-200' },
            { id: 'sanitary', label: 'Sanitary Ware', icon: Sparkles, color: 'text-blue-600 bg-blue-50 border-blue-200' },
            { id: 'pipes', label: 'Pipes & Fittings', icon: Layers, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
            { id: 'faucets', label: 'Faucets & Mixers', icon: Wrench, color: 'text-amber-600 bg-amber-50 border-amber-200' },
            { id: 'hardware', label: 'Hardware & Tools', icon: Building2, color: 'text-stone-600 bg-stone-100 border-stone-300' },
            { id: 'building', label: 'Building Materials', icon: Store, color: 'text-purple-600 bg-purple-50 border-purple-200' },
          ].map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory.toLowerCase().includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  const catalogEl = document.getElementById('catalog');
                  if (catalogEl) catalogEl.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'border-amber-700 bg-amber-50 ring-2 ring-amber-600 ring-offset-1'
                    : 'border-stone-200 bg-white hover:border-stone-400 hover:shadow-xs'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${cat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-stone-900 leading-snug">
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. PRODUCT CATALOG & LIVE INQUIRY */}
      <section id="catalog" className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex-1">
        {/* Filter Controls Bar */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs mb-6 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {/* Category Pills */}
            <div className="flex items-center space-x-2 overflow-x-auto w-full pb-1 md:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                All Products ({products.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id.toString())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedCategory === c.id.toString()
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* In-stock toggle */}
            <label className="flex items-center space-x-2 text-xs font-semibold text-stone-700 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span>In-Stock Only</span>
            </label>
          </div>

          {/* Active filter summary */}
          {(searchQuery || selectedCategory !== 'all' || onlyInStock) && (
            <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs text-stone-600">
              <span>
                Showing <strong>{filteredProducts.length}</strong> matching products
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setOnlyInStock(false);
                }}
                className="text-amber-800 font-bold hover:underline"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="py-20 text-center text-stone-500 space-y-3">
            <div className="w-8 h-8 border-2 border-amber-800 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold uppercase tracking-wider">Loading items catalog...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center max-w-md mx-auto space-y-3">
            <Search className="w-10 h-10 text-stone-400 mx-auto" />
            <h3 className="font-bold text-stone-800 text-sm">No items found matching your search</h3>
            <p className="text-xs text-stone-500">
              Try searching with a broader word or contact Imtiaz Ali on WhatsApp for custom orders.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-bold"
            >
              Reset Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => {
              const inStock = (product.current_stock || 0) > 0;
              const cartItem = cart.find((i) => i.product.id === product.id);

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col justify-between hover:border-amber-600/60 hover:shadow-md transition-all group"
                >
                  <div className="space-y-2.5">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                        {product.category_name || 'Hardware'}
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded ${
                          inStock
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {inStock ? `In Stock (${product.current_stock} ${product.unit})` : 'Available on Order'}
                      </span>
                    </div>

                    {/* Product Name & Brand */}
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm leading-snug group-hover:text-amber-900 transition-colors">
                        {product.name}
                      </h3>
                      <div className="flex items-center space-x-2 text-xs text-stone-500 mt-1">
                        {product.brand && <span className="font-medium text-stone-700">{product.brand}</span>}
                        {product.brand && <span>•</span>}
                        <span className="font-mono text-[11px]">SKU: {product.sku}</span>
                      </div>
                    </div>

                    {/* Description */}
                    {product.description && (
                      <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>

                  {/* Pricing and Action Area */}
                  <div className="mt-4 pt-3 border-t border-stone-100 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-stone-500 block">
                          Selling Price
                        </span>
                        <div className="flex items-baseline space-x-1">
                          <span className="text-base font-black text-stone-900">
                            Rs. {product.selling_price?.toLocaleString()}
                          </span>
                          <span className="text-xs text-stone-500 font-medium">
                            / {product.unit || 'pc'}
                          </span>
                        </div>
                      </div>

                      {product.wholesale_price && product.wholesale_price > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-amber-700 block">
                            Wholesale Rate
                          </span>
                          <span className="text-xs font-bold text-amber-900">
                            Rs. {product.wholesale_price?.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        className={`w-full py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                          cartItem
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-stone-900 hover:bg-stone-800 text-white'
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>{cartItem ? `In List (${cartItem.quantity})` : 'Add to List'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => sendSingleItemInquiry(product)}
                        className="w-full py-2 px-2 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors flex items-center justify-center space-x-1"
                        title="Inquire directly on WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. CONTRACTOR & TRADE DISCOUNTS CALLOUT */}
      <section className="bg-amber-900 text-amber-50 py-10 px-4 sm:px-6 lg:px-8 my-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-amber-300 text-xs font-bold uppercase tracking-wider">
              Contractor & Builder Trade Service
            </span>
            <h3 className="text-2xl font-black text-white">
              Planning a Plaza, House, or Commercial Project?
            </h3>
            <p className="text-xs sm:text-sm text-amber-200 max-w-2xl">
              Get special slab discounts on bulk cement, steel, sanitary bathroom sets, Berger paints, and PVC pipelines. Direct site deliveries with flexible payment terms and project khata.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <a
              href={`tel:${primaryPhone.replace(/\s+/g, '')}`}
              className="w-full sm:w-auto px-5 py-3 bg-white text-stone-900 hover:bg-amber-100 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center space-x-2"
              title="Call Primary Phone"
            >
              <Phone className="w-4 h-4 text-emerald-700" />
              <span>Call: {primaryPhone}</span>
            </a>
            <a
              href={`tel:${secondaryPhone.replace(/\s+/g, '')}`}
              className="w-full sm:w-auto px-5 py-3 bg-amber-800 hover:bg-amber-700 text-white border border-amber-600 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center space-x-2"
              title="Call Secondary Phone"
            >
              <Phone className="w-4 h-4 text-amber-300" />
              <span>Call: {secondaryPhone}</span>
            </a>
          </div>
        </div>
      </section>

      {/* 7. STORE LOCATION, TIMINGS & TRUST */}
      <section className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Address & Location */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-stone-900 text-sm">Store Location</h4>
            <p className="text-xs font-semibold text-stone-800 leading-relaxed">
              {settings.address}
            </p>
            <div className="pt-2 text-[11px] text-stone-500 font-medium">
              Landmark: Kumber Bazar, Main Road, Lower Dir, Maidan (KPK). Suzuki and Mazda loading facility available directly in front of the shop.
            </div>
          </div>

          {/* Card 2: Business Hours */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-stone-900 text-sm">Working Hours & Schedule</h4>
            <div className="space-y-2 text-xs text-stone-600">
              <div className="flex justify-between items-center bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200/80">
                <span className="font-semibold text-emerald-950">Saturday – Thursday (Whole Week):</span>
                <span className="font-bold text-emerald-800 text-[12px]">8:00 AM – 8:30 PM (Open)</span>
              </div>
              <div className="flex justify-between items-center bg-red-50/80 p-2.5 rounded-lg border border-red-200">
                <span className="font-semibold text-red-950">Friday (جمعہ المبارک):</span>
                <span className="font-bold text-red-700 uppercase tracking-wide">Weekly OFF / Closed</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px] flex items-start space-x-2">
                <span className="text-base leading-none">🚚</span>
                <div>
                  <span className="font-bold block text-amber-950">Friday Emergency Loading Available:</span>
                  <span className="text-stone-700">Urgent Suzuki/Mazda loading and emergency material supply is available on call even on Friday.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Direct Contact */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-stone-900 text-sm">Direct Contacts</h4>
            <p className="text-xs text-stone-600">
              For price inquiry, billing, and freight booking:
            </p>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                <div className="text-[10px] text-stone-500 font-bold uppercase">Primary Contact / WhatsApp</div>
                <div className="flex items-center justify-between mt-1">
                  <a href={`tel:${primaryPhone.replace(/\s+/g, '')}`} className="font-bold text-stone-900 hover:text-amber-700">
                    {primaryPhone}
                  </a>
                  <a
                    href={`https://wa.me/${waNumber1}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center space-x-1"
                  >
                    <span>Chat</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                <div className="text-[10px] text-stone-500 font-bold uppercase">Secondary Contact</div>
                <div className="flex items-center justify-between mt-1">
                  <a href={`tel:${secondaryPhone.replace(/\s+/g, '')}`} className="font-bold text-stone-900 hover:text-amber-700">
                    {secondaryPhone}
                  </a>
                  <a
                    href={`https://wa.me/${waNumber2}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center space-x-1"
                  >
                    <span>Chat</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="text-stone-600 pt-1">
                Owner: <strong>{settings.owner_name || 'Imtiaz Ali'}</strong> • Email: <span className="font-mono text-stone-800">{settings.email}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-8 px-4 sm:px-6 lg:px-8 border-t border-stone-800 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Store className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-stone-200">
              {settings.store_name}
            </span>
            <span className="text-stone-600">•</span>
            <span>Proprietor: {settings.owner_name || 'Imtiaz Ali'}</span>
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onGoToDashboard}
                className="text-amber-400 hover:underline font-bold"
              >
                Back to POS / Management
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="text-stone-400 hover:text-amber-400 flex items-center space-x-1"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Staff Login Portal</span>
              </button>
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-4 pt-4 border-t border-stone-800/60 text-center sm:text-left text-stone-500 text-[11px]">
          © 2026 {settings.store_name}. All rights reserved. Wholesale & Retail Building Materials, Sanitary, Pipes & Paint Dealer.
        </div>
      </footer>

      {/* 9. SLIDE-OUT INQUIRY & ESTIMATE DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-900 text-white">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  Order & Estimate Inquiry ({totalItemsCount} items)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body: Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-stone-400 space-y-2">
                  <ShoppingCart className="w-10 h-10 mx-auto text-stone-300" />
                  <p className="text-xs font-semibold">Your inquiry list is empty</p>
                  <p className="text-[11px] text-stone-500">
                    Add products from the catalog to prepare a custom WhatsApp estimate.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {cart.map((item) => {
                      const p = item.product;
                      const itemTotal = (p.selling_price || 0) * item.quantity;
                      return (
                        <div
                          key={p.id}
                          className="bg-stone-50 rounded-xl border border-stone-200 p-3 flex items-start justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-xs text-stone-900 truncate">
                              {p.name}
                            </h4>
                            <p className="text-[11px] text-stone-500">
                              Rs. {p.selling_price?.toLocaleString()} / {p.unit || 'unit'}
                            </p>
                            <p className="text-xs font-bold text-amber-900 mt-1">
                              Subtotal: Rs. {itemTotal.toLocaleString()}
                            </p>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <div className="flex items-center border border-stone-300 rounded-lg bg-white">
                              <button
                                type="button"
                                onClick={() => updateQuantity(p.id, -1)}
                                className="p-1 text-stone-600 hover:text-stone-900"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2 text-xs font-bold text-stone-800">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(p.id, 1)}
                                className="p-1 text-stone-600 hover:text-stone-900"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(p.id)}
                              className="p-1 text-stone-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Customer Information Form */}
                  <div className="mt-6 pt-4 border-t border-stone-200 space-y-3">
                    <h4 className="font-bold text-xs text-stone-900 uppercase tracking-wider">
                      Your Contact / Site Details (Optional)
                    </h4>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Your Name / Contractor Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Tariq Contractor / Muhammad Bilal"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Project Site / Delivery Area
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. DHA Phase 5 / Gulberg / Model Town"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Phone / WhatsApp
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 0300 1234567"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer: Total & WhatsApp Submit */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-stone-200 bg-stone-50 space-y-3">
                {inquirySuccessInfo && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 flex items-start space-x-2.5">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-bold">
                        Estimate Saved #{inquirySuccessInfo.quotationNumber}!
                      </div>
                      <div className="text-emerald-800 text-[11px] mt-0.5">
                        Your inquiry has been recorded in the store database and opened in WhatsApp for instant response.
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-stone-600">Total Estimate Value:</span>
                  <span className="text-lg font-black text-stone-900">
                    Rs. {totalCartAmount.toLocaleString()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={sendWhatsAppInquiry}
                  disabled={isSubmittingInquiry}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSubmittingInquiry
                      ? 'Saving Estimate to Store Database...'
                      : 'Send Estimate to Imtiaz Ali on WhatsApp'}
                  </span>
                </button>

                <p className="text-[11px] text-center text-stone-500">
                  Automatically logged in store database & opens WhatsApp with your item list!
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
