import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Store, ShieldCheck, User as UserIcon, Lock, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';

interface LoginProps {
  onBackToWebsite?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onBackToWebsite }) => {
  const { login } = useAuth();
  const { settings } = useSettings();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await login(username, password);
    if (!res.success) {
      setError(res.message || 'Authentication failed. Please verify credentials.');
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = (userType: 'admin' | 'cashier') => {
    if (userType === 'admin') {
      setUsername('admin');
      setPassword('admin123');
    } else {
      setUsername('cashier');
      setPassword('cashier123');
    }
    setError(null);
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      {onBackToWebsite && (
        <div className="absolute top-6 left-6">
          <button
            type="button"
            onClick={onBackToWebsite}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg text-xs font-bold text-stone-700 shadow-xs transition-colors"
          >
            <span>← Back to Customer Website</span>
          </button>
        </div>
      )}

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Icon & Heading */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-800 text-white flex items-center justify-center shadow-md border-2 border-amber-600">
            <Store className="w-8 h-8 text-amber-100" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-stone-900">
          {settings.store_name}
        </h2>
        <p className="mt-1 text-center text-xs text-stone-600">
          Hardware, Sanitary & Building Materials Store System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-stone-200 sm:rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 p-3.5 border border-red-200 flex items-start space-x-3">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 font-medium">{error}</div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or cashier"
                  className="block w-full pl-10 pr-3 py-2 border border-stone-300 rounded-lg text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2 border border-stone-300 rounded-lg text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-amber-800 hover:bg-amber-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <span>Verifying credentials...</span>
              ) : (
                <span className="flex items-center space-x-2">
                  <span>Sign In to Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Panel */}
          <div className="mt-6 pt-6 border-t border-stone-200">
            <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider text-center mb-3">
              1-Click Demo Accounts (Phase 1)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFillDemo('admin')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  username === 'admin'
                    ? 'border-amber-600 bg-amber-50/70 text-amber-950'
                    : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Admin</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                </div>
                <p className="text-[10px] text-stone-500 mt-0.5">admin / admin123</p>
                <span className="text-[9px] font-medium text-amber-800">Full Business Access</span>
              </button>

              <button
                type="button"
                onClick={() => handleFillDemo('cashier')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  username === 'cashier'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950'
                    : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Cashier</span>
                  <UserIcon className="w-3.5 h-3.5 text-blue-700" />
                </div>
                <p className="text-[10px] text-stone-500 mt-0.5">cashier / cashier123</p>
                <span className="text-[9px] font-medium text-blue-800">POS & Billing Only</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-stone-500">
          Database-backed authentication • Role-Based Access Control
        </div>
      </div>
    </div>
  );
};
