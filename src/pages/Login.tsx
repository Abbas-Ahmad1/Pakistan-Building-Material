import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Store, ShieldCheck, User as UserIcon, Lock, ArrowRight, AlertCircle, CheckCircle, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react';

interface LoginProps {
  onBackToWebsite?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onBackToWebsite }) => {
  const { login } = useAuth();
  const { settings } = useSettings();

  // Selected active slot: 'admin' or 'cashier'
  const [selectedRole, setSelectedRole] = useState<'admin' | 'cashier'>('admin');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Switch slot when user clicks on Admin or Cashier card
  const handleSelectSlot = (role: 'admin' | 'cashier') => {
    setSelectedRole(role);
    setError(null);
    if (role === 'admin') {
      setUsername('admin');
      setPassword('');
    } else {
      setUsername('cashier');
      setPassword('');
    }
  };

  // Quick fill default password for the active slot
  const handleQuickFillDefaults = () => {
    if (selectedRole === 'admin') {
      setUsername('admin');
      setPassword('admin123');
    } else {
      setUsername('cashier');
      setPassword('cashier123');
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await login(username, password);
    if (!res.success) {
      setError({
        title: 'Incorrect Username or Password',
        detail:
          res.message ||
          'The username or password you entered is incorrect. Please check your credentials and try again.',
      });
      // Clear password field on error so user can re-enter cleanly
      setPassword('');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative">
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
        <h2 className="mt-3 text-center text-2xl font-bold tracking-tight text-stone-900">
          {settings.store_name}
        </h2>
        <p className="mt-1 text-center text-xs text-stone-600">
          POS & Store Management System • Choose Account Slot
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-6 shadow-sm border border-stone-200 sm:rounded-2xl sm:px-9">
          {/* 1. ROLE SLOTS (Admin Slot vs. Cashier Slot) */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5">
              Select Login Slot (اکاؤنٹ منتخب کریں):
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Admin Slot */}
              <button
                type="button"
                onClick={() => handleSelectSlot('admin')}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  selectedRole === 'admin'
                    ? 'border-amber-600 bg-amber-50/70 shadow-xs ring-2 ring-amber-600/30 text-amber-950'
                    : 'border-stone-200 hover:border-stone-300 bg-stone-50/40 text-stone-700'
                }`}
              >
                {selectedRole === 'admin' && (
                  <span className="absolute top-2 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
                  </span>
                )}
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                      selectedRole === 'admin'
                        ? 'bg-amber-800 text-white'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">Admin Slot</div>
                    <div className="text-[10px] text-stone-500 font-medium">Imtiaz Ali (Owner)</div>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-stone-200/60 pt-2">
                  <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wide">
                    Full Control
                  </span>
                  {selectedRole === 'admin' ? (
                    <span className="text-[10px] font-bold text-amber-700">● Selected</span>
                  ) : (
                    <span className="text-[10px] text-stone-400">Click to Select</span>
                  )}
                </div>
              </button>

              {/* Cashier Slot */}
              <button
                type="button"
                onClick={() => handleSelectSlot('cashier')}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  selectedRole === 'cashier'
                    ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-600/30 text-blue-950'
                    : 'border-stone-200 hover:border-stone-300 bg-stone-50/40 text-stone-700'
                }`}
              >
                {selectedRole === 'cashier' && (
                  <span className="absolute top-2 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                  </span>
                )}
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                      selectedRole === 'cashier'
                        ? 'bg-blue-700 text-white'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">Cashier Slot</div>
                    <div className="text-[10px] text-stone-500 font-medium">Majid Mashwani</div>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-stone-200/60 pt-2">
                  <span className="text-[9px] font-bold text-blue-800 uppercase tracking-wide">
                    POS Terminal
                  </span>
                  {selectedRole === 'cashier' ? (
                    <span className="text-[10px] font-bold text-blue-700">● Selected</span>
                  ) : (
                    <span className="text-[10px] text-stone-400">Click to Select</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* 2. PROMINENT ERROR ALERT (Wrong Username / Password) */}
          {error && (
            <div className="mb-5 rounded-xl bg-red-50 p-4 border-2 border-red-300 shadow-xs animate-shake">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-bold text-red-900">{error.title}</div>
                  <div className="text-xs text-red-700 leading-relaxed font-medium">
                    {error.detail}
                  </div>
                  <div className="text-[11px] text-red-600 pt-1 font-semibold flex items-center space-x-1">
                    <span>⚠️ Please check your username and password, then try again.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. CREDENTIALS FORM */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Username (یوزر نیم)
                </label>
                <span className="text-[10px] text-stone-400 font-mono">
                  Slot: {selectedRole === 'admin' ? 'admin' : 'cashier'}
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={selectedRole === 'admin' ? 'e.g. admin' : 'e.g. cashier'}
                  autoComplete="username"
                  className={`block w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 ${
                    error
                      ? 'border-red-400 bg-red-50/20 text-red-900 focus:ring-red-500'
                      : 'border-stone-300 placeholder-stone-400 focus:ring-amber-600 focus:border-transparent'
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Password (پاس ورڈ)
                </label>
                <button
                  type="button"
                  onClick={handleQuickFillDefaults}
                  className="text-[10px] font-bold text-amber-800 hover:underline flex items-center space-x-1"
                  title="Click to fill default password for this slot"
                >
                  <KeyRound className="w-3 h-3 text-amber-700" />
                  <span>Fill Default ({selectedRole === 'admin' ? 'admin123' : 'cashier123'})</span>
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`block w-full pl-10 pr-10 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 ${
                    error
                      ? 'border-red-400 bg-red-50/20 text-red-900 focus:ring-red-500'
                      : 'border-stone-300 placeholder-stone-400 focus:ring-amber-600 focus:border-transparent'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600"
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full mt-3 flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors ${
                selectedRole === 'admin'
                  ? 'bg-amber-800 hover:bg-amber-900 focus:ring-amber-700'
                  : 'bg-blue-700 hover:bg-blue-800 focus:ring-blue-600'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying credentials...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2">
                  <span>
                    Sign In to {selectedRole === 'admin' ? 'Admin Dashboard' : 'POS Terminal'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          {/* Helper info */}
          <div className="mt-5 pt-4 border-t border-stone-200 text-center">
            <p className="text-[11px] text-stone-500">
              Passwords can be customized anytime in <strong>Store Settings</strong> &gt; <strong>Password & Security</strong>
            </p>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-stone-500">
          Pakistan Materials Hardware POS • Secured Role Authentication
        </div>
      </div>
    </div>
  );
};

