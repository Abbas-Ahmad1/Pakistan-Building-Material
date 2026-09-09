import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { User } from '../types';
import {
  UserCheck,
  ShieldCheck,
  User as UserIcon,
  Plus,
  CheckCircle,
  ArrowLeft,
  Key,
  Edit2,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  Save,
} from 'lucide-react';

interface UsersManagementProps {
  onBack: () => void;
}

export const UsersManagement: React.FC<UsersManagementProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit User / Change Password Modal State
  const [editModalUser, setEditModalUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    const res = await apiRequest<User[]>('/api/auth/users');
    if (res.success && res.data) {
      setUsers(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openEditModal = (u: User) => {
    setEditModalUser(u);
    setEditName(u.name);
    setEditUsername(u.username);
    setEditEmail(u.email || '');
    setEditPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setModalError(null);
  };

  const closeEditModal = () => {
    setEditModalUser(null);
    setModalError(null);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalUser) return;

    if (!editUsername.trim()) {
      setModalError('Username is required.');
      return;
    }

    if (editPassword) {
      if (editPassword.length < 4) {
        setModalError('Password must be at least 4 characters long.');
        return;
      }
      if (editPassword !== confirmPassword) {
        setModalError('Passwords do not match. Please re-enter.');
        return;
      }
    }

    setIsSaving(true);
    setModalError(null);

    const res = await apiRequest<{ id: number; username: string }>('/api/auth/update-credentials', {
      method: 'POST',
      body: JSON.stringify({
        userId: editModalUser.id,
        name: editName,
        username: editUsername,
        email: editEmail,
        password: editPassword || undefined,
      }),
    });

    if (res.success) {
      setSuccessToast(`Credentials and password for ${editUsername} updated successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
      closeEditModal();
      await fetchUsers();
    } else {
      setModalError(res.message || 'Failed to update user credentials.');
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
            <h1 className="text-xl font-bold text-stone-900">User Accounts & Roles</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Role-Based Access Control (RBAC): Administrator vs. Cashier (Credentials & Passwords)
            </p>
          </div>
        </div>

        {successToast && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successToast}</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Configured System Users ({users.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] bg-stone-50/30">
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Username</th>
                  <th className="py-3 px-4 font-semibold">Email</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Permissions</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.map((u) => {
                  const isAdmin = u.role === 'ADMIN';
                  return (
                    <tr key={u.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-stone-900 flex items-center space-x-2">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                            isAdmin ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                          }`}
                        >
                          {u.name.charAt(0)}
                        </div>
                        <span>{u.name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-600">{u.username}</td>
                      <td className="py-3 px-4 text-stone-500">{u.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isAdmin
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-blue-100 text-blue-900 border border-blue-200'
                          }`}
                        >
                          {isAdmin ? <ShieldCheck className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                          <span>{u.role}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-600 text-[11px]">
                        {isAdmin
                          ? 'Full Store Access, Inventory, P&L, Settings, Audits'
                          : 'POS Terminal, Invoices, Barcode Lookup, Shift Sales'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-700 transition-colors"
                        >
                          <Key className="w-3 h-3 text-amber-700" />
                          <span>Change Password</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit User Modal */}
        {editModalUser && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Key className="w-5 h-5 text-amber-800" />
                  <h3 className="font-bold text-stone-900 text-sm">
                    Change Password & Info ({editModalUser.role})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleSaveCredentials} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 uppercase mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 uppercase mb-1">
                    Username (Login ID)
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  />
                </div>

                <div className="pt-2 border-t border-stone-100">
                  <label className="block text-[11px] font-bold text-stone-800 uppercase mb-1">
                    New Password (نیا پاس ورڈ)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Leave blank if keeping same password"
                      className="w-full px-3 py-2 pr-9 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {editPassword && (
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-3.5 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving...' : 'Save Password & Details'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Role Matrix Explanation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
            <div className="flex items-center space-x-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <h3 className="font-bold text-stone-900 text-sm">ADMINISTRATOR (Owner)</h3>
            </div>
            <ul className="text-xs text-stone-600 space-y-1.5 list-disc list-inside">
              <li>Full access to Product Catalog & Purchase Pricing</li>
              <li>Inventory Stock Valuation & Physical Adjustments</li>
              <li>Supplier and Customer Credit/Due Ledgers</li>
              <li>Store Operating Expenses & Dynamic Profit & Loss</li>
              <li>Zakat Calculation Engine & Nisab Thresholds</li>
              <li>Store Settings & Security Audit Logs</li>
            </ul>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
            <div className="flex items-center space-x-2 mb-2">
              <UserIcon className="w-4 h-4 text-blue-700" />
              <h3 className="font-bold text-stone-900 text-sm">CASHIER (Counter Staff)</h3>
            </div>
            <ul className="text-xs text-stone-600 space-y-1.5 list-disc list-inside">
              <li>High-speed Point of Sale (POS) checkout</li>
              <li>Product search & Barcode scanning</li>
              <li>Thermal & A4 Invoice printing</li>
              <li>Today&apos;s shift sales summary</li>
              <li>Blocked from: Store Profit, Expenses, Supplier Costs, Settings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
