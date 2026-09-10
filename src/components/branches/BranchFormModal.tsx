import React, { useState } from 'react';
import { X, Building2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Branch } from '../../types';
import { apiRequest } from '../../services/api';

interface BranchFormModalProps {
  branch?: Branch | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const BranchFormModal: React.FC<BranchFormModalProps> = ({ branch, onClose, onSuccess }) => {
  const isEditing = !!branch;
  const [name, setName] = useState(branch?.name || '');
  const [code, setCode] = useState(branch?.code || '');
  const [address, setAddress] = useState(branch?.address || '');
  const [phone, setPhone] = useState(branch?.phone || '');
  const [managerName, setManagerName] = useState(branch?.manager_name || '');
  const [isMain, setIsMain] = useState<boolean>(Boolean(branch?.is_main));
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(branch?.status || 'ACTIVE');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !code.trim()) {
      setErrorMessage('Branch Name and Branch Code are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = isEditing ? `/api/branches/${branch.id}` : '/api/branches';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await apiRequest(endpoint, {
        method,
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          address: address.trim(),
          phone: phone.trim(),
          manager_name: managerName.trim(),
          is_main: isMain ? 1 : 0,
          status,
        }),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.message || 'Failed to save branch.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col border border-stone-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-stone-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm tracking-wide">
              {isEditing ? `Edit Branch: ${branch.name}` : 'Add New Store Branch'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Branch Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Branch 2 - Gulberg Commercial"
                className="w-full py-2 px-3 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Branch Code *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. BR-02"
                className="w-full py-2 px-3 border border-stone-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Store Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Main Commercial Boulevard, Gulberg III, Lahore"
              className="w-full py-2 px-3 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Phone / Contact
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 042-35789012 / 0300-1234567"
                className="w-full py-2 px-3 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Branch Manager
              </label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="e.g. Tariq Mehmood"
                className="w-full py-2 px-3 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="is_main_checkbox"
                checked={isMain}
                onChange={(e) => setIsMain(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-stone-300 focus:ring-amber-500"
              />
              <label htmlFor="is_main_checkbox" className="font-semibold text-stone-800 text-xs cursor-pointer">
                Main Central Store / Primary Hub
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full py-1.5 px-3 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none font-semibold"
              >
                <option value="ACTIVE">ACTIVE (Open)</option>
                <option value="INACTIVE">INACTIVE (Temporarily Closed)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm flex items-center space-x-1.5 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEditing ? 'Update Branch' : 'Create Branch'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
