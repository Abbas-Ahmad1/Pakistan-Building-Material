import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  badge?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  badge,
}) => {
  const variantStyles = {
    default: {
      border: 'border-stone-200',
      iconBg: 'bg-stone-100 text-stone-700',
      badge: 'bg-stone-100 text-stone-700',
    },
    success: {
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-50 text-emerald-800',
      badge: 'bg-emerald-100 text-emerald-800',
    },
    warning: {
      border: 'border-amber-200',
      iconBg: 'bg-amber-50 text-amber-800',
      badge: 'bg-amber-100 text-amber-900',
    },
    danger: {
      border: 'border-rose-200',
      iconBg: 'bg-rose-50 text-rose-800',
      badge: 'bg-rose-100 text-rose-900',
    },
    info: {
      border: 'border-sky-200',
      iconBg: 'bg-sky-50 text-sky-800',
      badge: 'bg-sky-100 text-sky-900',
    },
  };

  const style = variantStyles[variant];

  return (
    <div className={`bg-white rounded-xl border ${style.border} p-5 shadow-xs transition-shadow hover:shadow-sm`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">{title}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-stone-900 tracking-tight">{value}</span>
        {badge && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
            {badge}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-stone-500">{subtitle}</p>}
    </div>
  );
};
