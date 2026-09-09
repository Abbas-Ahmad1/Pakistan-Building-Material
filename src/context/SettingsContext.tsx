import React, { createContext, useContext, useState, useEffect } from 'react';
import { StoreSettings } from '../types';
import { apiRequest } from '../services/api';

const defaultSettings: StoreSettings = {
  store_name: 'Pakistan Building Materials & paint store',
  owner_name: 'Imtiaz Ali',
  tagline: 'Wholesale & Retail Hardware, Sanitary, Building Materials & Paints',
  address: 'Kumber Bazar Lower Dir Maidan',
  phone: '+92 300 5936652 / +92 305 9632244',
  phone_primary: '+92 300 5936652',
  phone_secondary: '+92 305 9632244',
  email: 'sales@pakistanmaterials.pk',
  currency: 'Rs.',
  invoice_prefix: 'INV-',
  tax_rate: 0,
  default_discount: 0,
  low_stock_threshold: 10,
  zakat_rate: 2.5,
  invoice_footer: 'Thank you for your business! Goods once sold can be exchanged within 7 days with original invoice.',
};

interface SettingsContextType {
  settings: StoreSettings;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
  formatCurrency: (amount: number) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSettings = async () => {
    const res = await apiRequest('/api/settings');
    if (res.success && res.data) {
      setSettings((prev) => ({ ...prev, ...res.data }));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const formatCurrency = (amount: number = 0): string => {
    return `${settings.currency} ${Number(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        refreshSettings,
        formatCurrency,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
