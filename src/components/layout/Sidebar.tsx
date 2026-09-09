import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Layers,
  Truck,
  Users,
  ShoppingBag,
  Receipt,
  Wallet,
  TrendingUp,
  FileText,
  Flame,
  Calculator,
  UserCheck,
  Settings as SettingsIcon,
  ShieldAlert,
  HelpCircle,
  FileCheck,
  Barcode,
  Globe,
  X,
  Pin,
  PanelLeftClose,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  onViewWebsite?: () => void;
  isOpen: boolean;
  onClose: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onViewWebsite,
  isOpen,
  onClose,
  isPinned = false,
  onTogglePin,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isPinned) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPinned, onClose]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, role: 'ALL' },
    { id: 'pos', label: 'POS Terminal', icon: ShoppingCart, role: 'ALL', badge: 'Active' },
    { id: 'products', label: 'Products', icon: Package, role: 'ALL' },
    { id: 'categories', label: 'Categories', icon: Layers, role: 'ADMIN' },
    { id: 'inventory', label: 'Inventory & Stock', icon: Boxes, role: 'ADMIN' },
    { id: 'barcodes', label: 'Barcode & Shelf Tags', icon: Barcode, role: 'ADMIN' },
    { id: 'purchases', label: 'Purchases (Stock In)', icon: ShoppingBag, role: 'ADMIN' },
    { id: 'suppliers', label: 'Suppliers', icon: Truck, role: 'ADMIN' },
    { id: 'customers', label: 'Customers & Credit', icon: Users, role: 'ALL' },
    { id: 'quotations', label: 'Estimates / Quotations', icon: FileCheck, role: 'ALL' },
    { id: 'sales', label: 'Sales & Invoices', icon: Receipt, role: 'ALL' },
    { id: 'expenses', label: 'Expenses', icon: Wallet, role: 'ADMIN' },
    { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp, role: 'ADMIN' },
    { id: 'reports', label: 'Business Reports', icon: FileText, role: 'ADMIN' },
    { id: 'bestsellers', label: 'Best Sellers', icon: Flame, role: 'ADMIN' },
    { id: 'zakat', label: 'Zakat Calculator', icon: Calculator, role: 'ADMIN' },
    { id: 'users', label: 'User Roles', icon: UserCheck, role: 'ADMIN' },
    { id: 'audit-logs', label: 'Audit Logs', icon: ShieldAlert, role: 'ADMIN' },
    { id: 'settings', label: 'Store Settings', icon: SettingsIcon, role: 'ADMIN' },
  ];

  const visibleItems = navItems.filter((item) => item.role === 'ALL' || (item.role === 'ADMIN' && isAdmin));

  return (
    <>
      {/* Backdrop overlay when sidebar is open in unpinned mode */}
      {isOpen && !isPinned && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-stone-950/60 backdrop-blur-2xs z-40 transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`bg-stone-900 text-stone-300 flex flex-col h-screen shrink-0 border-r border-stone-800 transition-all duration-300 ease-in-out ${
          isPinned
            ? 'w-64 relative z-20'
            : `fixed top-0 left-0 bottom-0 z-50 w-72 shadow-2xl ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
              }`
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-stone-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
                HS
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-stone-100 tracking-tight truncate">
                  HARDWARE POS
                </span>
                <span className="text-[11px] text-amber-400 font-medium truncate">
                  Sanitary & Building Materials
                </span>
              </div>
            </div>

            {/* Header Actions: Pin & Close */}
            <div className="flex items-center space-x-1 shrink-0">
              {onTogglePin && (
                <button
                  type="button"
                  onClick={onTogglePin}
                  className={`p-1.5 rounded-lg text-xs transition-colors hidden lg:flex items-center justify-center ${
                    isPinned
                      ? 'text-amber-400 bg-stone-800'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                  }`}
                  title={isPinned ? 'Unpin Sidebar (Auto-hide on click)' : 'Pin Sidebar (Keep open)'}
                >
                  <Pin className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
                title="Hide / Close Sidebar (Esc)"
                aria-label="Hide Sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {onViewWebsite && (
            <button
              type="button"
              onClick={() => {
                if (!isPinned) onClose();
                onViewWebsite();
              }}
              className="w-full flex items-center justify-center space-x-2 py-1.5 px-3 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/60 rounded-lg text-xs text-emerald-300 font-bold transition-all shadow-xs"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>🌐 View Customer Website</span>
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin scrollbar-thumb-stone-700">
          <div className="px-3 pb-2 text-[10px] font-semibold text-stone-400 uppercase tracking-wider flex items-center justify-between">
            <span>{isAdmin ? 'Store Operations' : 'Cashier Terminal'}</span>
            {!isPinned && (
              <span className="text-[9px] text-stone-500 font-normal">Auto-hides on click</span>
            )}
          </div>

          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectView(item.id);
                  if (!isPinned) {
                    onClose();
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-600 text-white font-semibold shadow-xs'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-stone-800 bg-stone-950/50 text-[11px] text-stone-400 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-stone-200 text-xs flex items-center space-x-1 underline"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
              <span>Hide Sidebar</span>
            </button>
          </div>
          <span className="text-amber-500 font-mono text-[10px]">v1.0-RC</span>
        </div>
      </aside>
    </>
  );
};
