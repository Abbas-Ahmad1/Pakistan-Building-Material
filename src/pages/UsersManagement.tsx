import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { User } from '../types';
import { UserCheck, ShieldCheck, User as UserIcon, Plus, CheckCircle, ArrowLeft } from 'lucide-react';

interface UsersManagementProps {
  onBack: () => void;
}

export const UsersManagement: React.FC<UsersManagementProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
              Role-Based Access Control (RBAC): Administrator vs. Cashier
            </p>
          </div>
        </div>

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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

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
