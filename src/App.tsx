import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { UsersManagement } from './pages/UsersManagement';
import { SettingsView } from './pages/SettingsView';
import { Products } from './pages/Products';
import { Categories } from './pages/Categories';
import { Inventory } from './pages/Inventory';
import { PosTerminal } from './pages/PosTerminal';
import { SalesRegister } from './pages/SalesRegister';
import { CustomersView } from './pages/CustomersView';
import { SuppliersView } from './pages/SuppliersView';
import { PurchasesView } from './pages/PurchasesView';
import { ExpensesView } from './pages/ExpensesView';
import { ProfitLossView } from './pages/ProfitLossView';
import { BusinessReportsView } from './pages/BusinessReportsView';
import { BestSellersView } from './pages/BestSellersView';
import { ZakatCalculatorView } from './pages/ZakatCalculatorView';
import { AuditLogsView } from './pages/AuditLogsView';
import { QuotationsView } from './pages/QuotationsView';
import { BarcodeGeneratorView } from './pages/BarcodeGeneratorView';
import { MultiBranchView } from './pages/MultiBranchView';
import { PublicStorefront } from './pages/PublicStorefront';
import { PhasePlaceholder } from './pages/PhasePlaceholder';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { RefreshCw } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [showStaffLogin, setShowStaffLogin] = useState<boolean>(false);
  const [isViewingPublicWebsite, setIsViewingPublicWebsite] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-800" />
          <span className="text-xs font-semibold text-stone-600 tracking-wide uppercase">
            Loading Pakistan Building Materials & Paint Store...
          </span>
        </div>
      </div>
    );
  }

  // 1. Not Authenticated: Default to Public Customer-Facing Website (with Staff Login option)
  if (!isAuthenticated) {
    if (showStaffLogin) {
      return <Login onBackToWebsite={() => setShowStaffLogin(false)} />;
    }
    return (
      <PublicStorefront
        onOpenLogin={() => setShowStaffLogin(true)}
        onGoToDashboard={() => {}}
      />
    );
  }

  // 2. Authenticated, but user clicked "View Public Website": Show public website with return bar
  if (isViewingPublicWebsite) {
    return (
      <div className="relative">
        <div className="bg-amber-900 text-amber-100 text-xs px-4 py-2 flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Previewing Customer Website as <strong>{user?.name}</strong> ({user?.role})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsViewingPublicWebsite(false)}
            className="px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded font-bold text-xs shadow-xs transition-colors"
          >
            ← Return to Store POS & Management
          </button>
        </div>
        <PublicStorefront
          onOpenLogin={() => {}}
          onGoToDashboard={() => setIsViewingPublicWebsite(false)}
        />
      </div>
    );
  }

  // View Switcher
  const renderCurrentView = () => {
    // Admin Only Gated Views
    if (user?.role === 'CASHIER') {
      const allowedCashierViews = ['dashboard', 'pos', 'products', 'sales', 'customers', 'quotations'];
      if (!allowedCashierViews.includes(currentView)) {
        return <Dashboard onNavigate={setCurrentView} />;
      }
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentView} />;
      case 'pos':
        return <PosTerminal />;
      case 'products':
        return <Products onNavigate={setCurrentView} />;
      case 'categories':
        return <Categories onBack={() => setCurrentView('products')} />;
      case 'inventory':
        return <Inventory onNavigate={setCurrentView} />;
      case 'branches':
        return <MultiBranchView />;
      case 'barcodes':
        return <BarcodeGeneratorView />;
      case 'purchases':
        return <PurchasesView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'customers':
        return <CustomersView />;
      case 'quotations':
        return <QuotationsView />;
      case 'sales':
        return <SalesRegister />;
      case 'expenses':
        return <ExpensesView />;
      case 'profit-loss':
        return <ProfitLossView />;
      case 'reports':
        return <BusinessReportsView />;
      case 'bestsellers':
        return <BestSellersView />;
      case 'zakat':
        return <ZakatCalculatorView />;
      case 'audit-logs':
        return <AuditLogsView />;
      case 'users':
        return <UsersManagement onBack={() => setCurrentView('dashboard')} />;
      case 'settings':
        return <SettingsView onBack={() => setCurrentView('dashboard')} />;
      default:
        return (
          <PhasePlaceholder
            viewId={currentView}
            onBackToDashboard={() => setCurrentView('dashboard')}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-stone-100 text-stone-900 font-sans overflow-hidden relative">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={(view) => {
          setCurrentView(view);
          if (!isSidebarPinned) {
            setIsSidebarOpen(false);
          }
        }}
        onViewWebsite={() => setIsViewingPublicWebsite(true)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isPinned={isSidebarPinned}
        onTogglePin={() => setIsSidebarPinned(!isSidebarPinned)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          activeView={currentView}
          onViewWebsite={() => setIsViewingPublicWebsite(true)}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <MainLayout />
      </SettingsProvider>
    </AuthProvider>
  );
}
