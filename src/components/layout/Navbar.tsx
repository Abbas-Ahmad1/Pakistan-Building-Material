import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import {
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Store,
  RefreshCw,
  Bell,
  Clock,
  Globe,
  Menu,
  PanelLeftClose,
} from 'lucide-react';

interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  activeView: string;
  onViewWebsite?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onViewWebsite,
  onToggleSidebar,
  isSidebarOpen,
}) => {
  const { user, logout, switchUserRole } = useAuth();
  const { settings } = useSettings();
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-stone-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Left: Sidebar Toggle, View Title & Store Name */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-2xs ${
              isSidebarOpen
                ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
            }`}
            title={isSidebarOpen ? 'Hide Sidebar Menu' : 'Show Sidebar Menu'}
            aria-label="Toggle Navigation Menu"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4 text-stone-700" />
            ) : (
              <Menu className="w-4 h-4 text-amber-700" />
            )}
            <span className="hidden sm:inline">
              {isSidebarOpen ? 'Hide Menu' : 'Menu'}
            </span>
          </button>
        )}

        <div className="flex items-center space-x-2 text-stone-800">
          <Store className="w-5 h-5 text-amber-700" />
          <span className="font-semibold text-sm tracking-tight text-stone-900 hidden md:inline">
            {settings.store_name}
          </span>
        </div>
        <span className="text-stone-300 hidden sm:inline">|</span>
        <span className="text-xs font-medium uppercase tracking-wider text-stone-500 bg-stone-100 px-2.5 py-1 rounded-md">
          {activeView.replace('-', ' ')}
        </span>
      </div>

      {/* Right: Live Clock, Role Quick Switcher, User Profile & Logout */}
      <div className="flex items-center space-x-4">
        {/* Real-time Clock */}
        <div className="hidden md:flex items-center space-x-1.5 text-stone-500 text-xs font-mono bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
          <Clock className="w-3.5 h-3.5 text-stone-400" />
          <span>{time}</span>
        </div>

        {/* Quick Role Tester (Convenience for evaluating Admin vs Cashier permissions) */}
        <div className="hidden lg:flex items-center space-x-1 bg-stone-100 p-1 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => switchUserRole('ADMIN')}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              user?.role === 'ADMIN'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Admin View
          </button>
          <button
            type="button"
            onClick={() => switchUserRole('CASHIER')}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              user?.role === 'CASHIER'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Cashier View
          </button>
        </div>

        {/* View Public Customer Website Button */}
        {onViewWebsite && (
          <button
            type="button"
            onClick={onViewWebsite}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-all shadow-2xs"
            title="Open Public Customer Website & Catalog"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">View Public Website</span>
          </button>
        )}

        {/* User Card */}
        <div className="flex items-center space-x-3 pl-2 border-l border-stone-200">
          <div className="flex flex-col text-right">
            <span className="text-xs font-semibold text-stone-900">{user?.name}</span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm inline-block self-end ${
                user?.role === 'ADMIN'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-blue-100 text-blue-900'
              }`}
            >
              {user?.role}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className="p-2 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
