import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { apiRequest } from '../services/api';
import { ArrowLeft, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const { settings, refreshSettings } = useSettings();
  const [formData, setFormData] = useState({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
              General business configuration, invoice defaults, and alert thresholds
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

        <form onSubmit={handleSave} className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs space-y-6">
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
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
