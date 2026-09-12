import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useSettings } from '../../context/SettingsContext';

interface SalesChartProps {
  data: {
    label: string;
    sales: number;
    profit: number;
    expenses: number;
  }[];
  range: string;
  onRangeChange: (range: string) => void;
  isAdmin: boolean;
}

export const SalesChart: React.FC<SalesChartProps> = ({
  data,
  range,
  onRangeChange,
  isAdmin,
}) => {
  const { settings } = useSettings();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-stone-200 rounded-lg shadow-md text-xs">
          <p className="font-semibold text-stone-900 mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between space-x-4 py-0.5">
              <span className="flex items-center space-x-1.5" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                <span className="text-stone-600">{entry.name}:</span>
              </span>
              <span className="font-medium text-stone-900">
                {settings.currency} {Number(entry.value).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="font-bold text-stone-900 text-sm">Revenue & Financial Trends</h3>
          <p className="text-xs text-stone-500">
            {isAdmin ? 'Real-time sales, gross profit & operating expenses' : 'Your shift sales trajectory'}
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center space-x-1 bg-stone-100 p-1 rounded-lg self-start sm:self-auto">
          {[
            { id: 'today', label: 'Today' },
            { id: '7days', label: '7 Days' },
            { id: '30days', label: '30 Days' },
            { id: 'year', label: 'Yearly' },
          ].map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onRangeChange(r.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                range === r.id
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d97706" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e11d48" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tick={{ fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
              iconType="circle"
            />
            <Area
              type="monotone"
              dataKey="sales"
              name="Sales Revenue"
              stroke="#d97706"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSales)"
            />
            {isAdmin && (
              <>
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Gross Profit"
                  stroke="#059669"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorProfit)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#e11d48"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorExpenses)"
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
