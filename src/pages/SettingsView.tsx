import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { User } from '../types';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User as UserIcon,
  Lock,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';

interface SettingsViewProps {
  onBack: () => void;
}

interface UserEditState {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  newPassword: string;
  confirmPassword: string;
  showPassword: boolean;
  isSaving: boolean;
  feedback: { type: 'success' | 'error'; text: string } | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const { settings, refreshSettings } = useSettings();
  const { user: currentAuthUser } = useAuth();
  const [formData, setFormData] = useState({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // User credentials management
  const [userStates, setUserStates] = useState<{ [id: number]: UserEditState }>({});
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const res = await apiRequest<User[]>('/api/auth/users');
    if (res.success && res.data) {
      const initialStates: { [id: number]: UserEditState } = {};
      res.data.forEach((u) => {
        initialStates[u.id] = {
          id: u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          role: u.role,
          newPassword: '',
          confirmPassword: '',
          showPassword: false,
          isSaving: false,
          feedback: null,
        };
      });
      setUserStates(initialStates);
    }
    setLoadingUsers(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUserInputChange = (userId: number, field: keyof UserEditState, value: any) => {
    setUserStates((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
        feedback: null, // Clear feedback on input change
      },
    }));
  };

  const handleUpdateUserCredentials = async (userId: number) => {
    const uState = userStates[userId];
    if (!uState) return;

    if (!uState.username.trim()) {
      setUserStates((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], feedback: { type: 'error', text: 'Username cannot be empty.' } },
      }));
      return;
    }

    if (uState.newPassword) {
      if (uState.newPassword.length < 4) {
        setUserStates((prev) => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            feedback: { type: 'error', text: 'New password must be at least 4 characters long.' },
          },
        }));
        return;
      }
      if (uState.newPassword !== uState.confirmPassword) {
        setUserStates((prev) => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            feedback: { type: 'error', text: 'Passwords do not match. Please verify both fields.' },
          },
        }));
        return;
      }
    }

    // Set saving
    setUserStates((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], isSaving: true, feedback: null },
    }));

    const res = await apiRequest<{ id: number; username: string; passwordUpdated: boolean }>(
      '/api/auth/update-credentials',
      {
        method: 'POST',
        body: JSON.stringify({
          userId: uState.id,
          name: uState.name,
          username: uState.username,
          email: uState.email,
          password: uState.newPassword || undefined,
        }),
      }
    );

    if (res.success) {
      setUserStates((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          isSaving: false,
          newPassword: '',
          confirmPassword: '',
          feedback: {
            type: 'success',
            text: `Credentials for ${uState.role} (${uState.username}) saved successfully! ${
              uState.newPassword ? 'New password is now active.' : 'Details updated.'
            }`,
          },
        },
      }));
    } else {
      setUserStates((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          isSaving: false,
          feedback: { type: 'error', text: res.message || 'Failed to update credentials.' },
        },
      }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const res = await apiRequest('/api/settings', {
      method: 'POST',
      body: JSON.stringify(formData),
    });

    if (res.success) {
      await refreshSettings();
      setMessage({ type: 'success', text: 'Store settings updated successfully in the database.' });
    } else {
      setMessage({ type: 'error', text: res.message || 'Failed to update settings.' });
    }
    setIsSaving(false);
  };

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center space-x-1 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Store Profile & Global Settings</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              General business configuration, invoice defaults, and user passwords/credentials
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`p-3.5 rounded-lg text-xs flex items-center space-x-2.5 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* SECTION 1: Store Business Configuration */}
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-stone-100 pb-3">
            <h2 className="text-sm font-bold text-stone-800">Shop Profile & Printing Details</h2>
            <p className="text-xs text-stone-500">Information printed on invoices and sales receipts</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Store Business Name
              </label>
              <input
                type="text"
                name="store_name"
                value={formData.store_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Owner / Proprietor Name
              </label>
              <input
                type="text"
                name="owner_name"
                value={formData.owner_name || ''}
                onChange={handleChange}
                placeholder="e.g. Imtiaz Ali"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none font-bold text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Store Tagline / Subtitle
              </label>
              <input
                type="text"
                name="tagline"
                value={formData.tagline || ''}
                onChange={handleChange}
                placeholder="e.g. Wholesale & Retail Hardware, Sanitary, Building Materials & Paints"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Shop Address (Printed on Invoices)
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Contact Phone(s)
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Official Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Invoice Number Prefix
              </label>
              <input
                type="text"
                name="invoice_prefix"
                value={formData.invoice_prefix}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Default Low-Stock Safety Threshold
              </label>
              <input
                type="number"
                name="low_stock_threshold"
                value={formData.low_stock_threshold}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Annual Business Zakat Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                name="zakat_rate"
                value={formData.zakat_rate}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Invoice Footer Notice
              </label>
              <textarea
                name="invoice_footer"
                rows={3}
                value={formData.invoice_footer}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-stone-200">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-2 px-5 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Profile...' : 'Save Store Profile'}</span>
            </button>
          </div>
        </form>

        {/* SECTION 2: User Passwords & Credentials Management (Admin & Cashier) */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-amber-800" />
                <h2 className="text-sm font-bold text-stone-900">
                  Password & Security Settings (Admin & Cashier)
                </h2>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Admin aur Cashier dono ke username aur password yahan se tabdeel (change) karein
              </p>
            </div>
            <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200">
              Admin Protected
            </span>
          </div>

          {loadingUsers ? (
            <div className="py-6 text-center text-xs text-stone-400">Loading user accounts...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(Object.values(userStates) as UserEditState[]).map((u) => {
                const isAdmin = u.role === 'ADMIN';
                return (
                  <div
                    key={u.id}
                    className={`rounded-xl border p-5 flex flex-col justify-between ${
                      isAdmin
                        ? 'border-amber-200 bg-amber-50/20 shadow-xs'
                        : 'border-blue-200 bg-blue-50/20 shadow-xs'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                              isAdmin ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                            }`}
                          >
                            {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-stone-900">{u.name}</div>
                            <span
                              className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide ${
                                isAdmin ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                              }`}
                            >
                              {u.role === 'ADMIN' ? 'Owner / Full Admin' : 'Cashier / POS Terminal'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Feedback Message */}
                      {u.feedback && (
                        <div
                          className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                            u.feedback.type === 'success'
                              ? 'bg-emerald-100/90 text-emerald-900 border border-emerald-300'
                              : 'bg-red-100/90 text-red-900 border border-red-300'
                          }`}
                        >
                          {u.feedback.type === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-red-700 shrink-0" />
                          )}
                          <span className="font-medium text-[11px]">{u.feedback.text}</span>
                        </div>
                      )}

                      {/* Inputs */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                            Full Name / Title
                          </label>
                          <input
                            type="text"
                            value={u.name}
                            onChange={(e) => handleUserInputChange(u.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-600 focus:outline-none font-medium"
                            placeholder="Full Name"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                            Username (Login ID)
                          </label>
                          <input
                            type="text"
                            value={u.username}
                            onChange={(e) => handleUserInputChange(u.id, 'username', e.target.value)}
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white font-mono focus:ring-2 focus:ring-amber-600 focus:outline-none"
                            placeholder="Username"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={u.email}
                            onChange={(e) => handleUserInputChange(u.id, 'email', e.target.value)}
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-600 focus:outline-none"
                            placeholder="Email address"
                          />
                        </div>

                        <div className="pt-2 border-t border-stone-200">
                          <label className="block text-[11px] font-bold text-stone-800 uppercase tracking-wider mb-1">
                            New Password (نیا پاس ورڈ)
                          </label>
                          <div className="relative">
                            <input
                              type={u.showPassword ? 'text' : 'password'}
                              value={u.newPassword}
                              onChange={(e) => handleUserInputChange(u.id, 'newPassword', e.target.value)}
                              placeholder="Leave blank if not changing"
                              className="w-full px-3 py-2 pr-9 border border-stone-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-600 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUserInputChange(u.id, 'showPassword', !u.showPassword)}
                              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-600"
                              title={u.showPassword ? 'Hide password' : 'Show password'}
                            >
                              {u.showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {u.newPassword && (
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                              Confirm New Password (تصدیق کریں)
                            </label>
                            <input
                              type={u.showPassword ? 'text' : 'password'}
                              value={u.confirmPassword}
                              onChange={(e) => handleUserInputChange(u.id, 'confirmPassword', e.target.value)}
                              placeholder="Re-enter new password"
                              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-600 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="mt-5 pt-3 border-t border-stone-200">
                      <button
                        type="button"
                        onClick={() => handleUpdateUserCredentials(u.id)}
                        disabled={u.isSaving}
                        className={`w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50 text-white shadow-xs ${
                          isAdmin
                            ? 'bg-amber-800 hover:bg-amber-900 focus:ring-2 focus:ring-amber-700'
                            : 'bg-blue-700 hover:bg-blue-800 focus:ring-2 focus:ring-blue-600'
                        }`}
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>
                          {u.isSaving
                            ? 'Updating...'
                            : `Update ${isAdmin ? 'Admin' : 'Cashier'} Credentials`}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
