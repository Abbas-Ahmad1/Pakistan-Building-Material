import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Clock,
  User,
  Filter,
  Activity,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { apiRequest } from '../services/api';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let url = `/api/audit-logs?search=${encodeURIComponent(search)}`;
      if (selectedModule !== 'all') url += `&module=${encodeURIComponent(selectedModule)}`;
      const res = await apiRequest<any[]>(url);
      if (res.success && res.data) {
        setLogs(res.data);
        if (res.total !== undefined) setTotal(res.total);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedModule]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="flex-1 p-6 lg:p-8 bg-stone-50 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-stone-900 tracking-tight flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-stone-700" />
            <span>Security & Operational Audit Trail</span>
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Tamper-evident logs of all system events: Sales checkout, credit transactions, expenses, stock adjustments & security.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-bold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search audit trail by keyword, staff user, action or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
          />
        </form>

        <div className="flex items-center space-x-2">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="all">All Modules</option>
            <option value="Sales">Sales & Invoicing</option>
            <option value="Expenses">Expenses</option>
            <option value="Inventory">Inventory & Products</option>
            <option value="Purchases">Purchases & Suppliers</option>
            <option value="Customers">Customer Khata</option>
            <option value="Zakat">Zakat Assessments</option>
            <option value="Database">System & DB</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-600 font-bold uppercase border-b border-stone-200 text-[10px] tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Staff User</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Operational Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-stone-500" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    No audit records matching your criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 text-stone-500 whitespace-nowrap font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString('en-PK', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-stone-900">{log.user_name || 'System'}</div>
                      {log.username && (
                        <span className="text-[10px] text-stone-400">@{log.username}</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700">
                        {log.module}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] font-bold text-stone-800">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-stone-700">
                      <div>{log.details}</div>
                      {log.record_id && (
                        <span className="text-[10px] text-stone-400 font-mono">
                          Record ID: #{log.record_id}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
