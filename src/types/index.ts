export type Role = 'ADMIN' | 'CASHIER';

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: Role;
  status: 'active' | 'inactive';
  branch_id?: number;
  branch_name?: string;
  branch_code?: string;
  created_at?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export type ProductUnit =
  | 'Piece'
  | 'Box'
  | 'Bag'
  | 'Meter'
  | 'Feet'
  | 'Kg'
  | 'Ton'
  | 'Liter'
  | 'Set'
  | 'Roll';

export interface Category {
  id: number;
  name: string;
  code: string;
  description?: string;
  created_at?: string;
  products_count?: number;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  created_at?: string;
  products_count?: number;
}

export interface InventorySummary {
  total_items: number;
  total_units: number;
  total_cost_value: number;
  total_retail_value: number;
  potential_profit: number;
  out_of_stock_count: number;
  low_stock_count: number;
}

export interface InventoryTransaction {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  unit: string;
  transaction_type: 'OPENING_STOCK' | 'PURCHASE' | 'SALE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  reference_type: string;
  reference_id?: number | null;
  quantity: number;
  unit_cost: number;
  stock_before: number;
  stock_after: number;
  notes?: string;
  user_name?: string;
  created_at: string;
}

export interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  category_id: number;
  category_name?: string;
  subcategory_id?: number | null;
  subcategory_name?: string | null;
  brand: string;
  description: string;
  unit: ProductUnit;
  purchase_price: number;
  selling_price: number;
  wholesale_price: number;
  current_stock: number;
  minimum_stock: number;
  supplier_id?: number | null;
  supplier_name?: string | null;
  image_url?: string;
  status: 'active' | 'inactive' | 'discontinued';
  created_at: string;
  updated_at?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  credit_limit: number;
  total_purchases: number;
  total_paid: number;
  outstanding_balance: number;
  is_walk_in: boolean;
  created_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  total_purchases: number;
  paid_amount: number;
  payable_balance: number;
  status?: string;
  purchases_count?: number;
  created_at: string;
}

export interface DashboardMetrics {
  todaySales: number;
  todayProfit: number;
  todayExpenses: number;
  todayOrdersCount: number;
  totalProducts: number;
  totalInventoryCostValue: number;
  totalInventoryRetailValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalCustomers: number;
  totalSuppliers: number;
  customerOutstandingBalance: number;
  supplierPayableBalance: number;
  chartData: {
    label: string;
    sales: number;
    profit: number;
    expenses: number;
  }[];
  recentSales: {
    id: number;
    invoice_number: string;
    customer_name: string;
    grand_total: number;
    paid_amount: number;
    due_amount: number;
    payment_method: string;
    payment_status: string;
    created_at: string;
    cashier_name: string;
  }[];
  lowStockProducts: {
    id: number;
    sku: string;
    name: string;
    category_name: string;
    unit: string;
    current_stock: number;
    minimum_stock: number;
    purchase_price: number;
    selling_price: number;
  }[];
}

export interface StoreSettings {
  store_name: string;
  owner_name?: string;
  tagline?: string;
  store_logo?: string;
  address: string;
  phone: string;
  phone_primary?: string;
  phone_secondary?: string;
  email: string;
  currency: string;
  invoice_prefix: string;
  tax_rate: number;
  default_discount: number;
  low_stock_threshold: number;
  zakat_rate: number;
  invoice_footer: string;
}

export interface SaleItem {
  id?: number;
  sale_id?: number;
  product_id: number;
  product_name?: string;
  sku?: string;
  unit?: string;
  quantity: number; // Total Purchased Quantity
  delivered_quantity?: number; // Delivered / Picked Up quantity
  remaining_delivery?: number; // Remaining Balance = quantity - delivered_quantity
  unit_cost?: number;
  unit_price: number;
  discount: number;
  line_total: number;
  line_profit?: number;
  returned_quantity?: number;
  remaining_quantity?: number;
}

export interface SaleDeliveryLog {
  id: number;
  sale_id: number;
  sale_item_id: number;
  product_name?: string;
  delivered_quantity: number;
  total_delivered_after: number;
  remaining_after: number;
  notes?: string;
  delivered_by?: number;
  delivered_by_name?: string;
  created_at: string;
}

export interface SalesReturnItem {
  id?: number;
  return_id?: number;
  sale_item_id: number;
  product_id: number;
  product_name?: string;
  returned_quantity: number;
  unit_price: number;
  refund_line_total: number;
}

export interface SalesReturn {
  id: number;
  return_number: string;
  sale_id: number;
  customer_id: number;
  total_refund_amount: number;
  refund_type: 'CASH_REFUND' | 'LEDGER_ADJUSTMENT' | 'MIXED';
  cash_refund_amount: number;
  ledger_credit_amount: number;
  reason?: string;
  processed_by?: number;
  processed_by_name?: string;
  created_at: string;
  items?: SalesReturnItem[];
}

export interface Sale {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  customer_current_balance?: number;
  is_walk_in?: boolean;
  sale_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  original_grand_total?: number;
  net_total?: number;
  cogs_total?: number;
  gross_profit?: number;
  paid_amount: number;
  due_amount: number;
  returned_amount?: number;
  payment_method: string;
  payment_status: 'PAID' | 'PARTIAL' | 'DUE';
  delivery_status?: 'DELIVERED' | 'PARTIAL' | 'PENDING';
  total_purchased_qty?: number;
  total_delivered_qty?: number;
  total_remaining_qty?: number;
  cashier_id: number;
  cashier_name?: string;
  branch_id?: number;
  branch_name?: string;
  branch_code?: string;
  branch_address?: string;
  branch_phone?: string;
  items_count?: number;
  items?: SaleItem[];
  returns?: SalesReturn[];
  delivery_logs?: SaleDeliveryLog[];
  settings?: Record<string, string>;
}

export interface Branch {
  id: number;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  manager_name?: string;
  is_main: number | boolean;
  status: 'ACTIVE' | 'INACTIVE';
  total_products?: number;
  total_units?: number;
  sales_count?: number;
  total_revenue?: number;
  created_at?: string;
}

export interface BranchStockBreakdown {
  branch_id: number;
  branch_name: string;
  branch_code: string;
  current_stock: number;
  minimum_stock: number;
}

export interface ProductBranchStockMatrix {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  brand: string;
  unit: string;
  category_name?: string;
  purchase_price: number;
  selling_price: number;
  total_stock: number;
  minimum_stock: number;
  branches: BranchStockBreakdown[];
}

export interface StockTransferItem {
  id?: number;
  transfer_id?: number;
  product_id: number;
  product_name?: string;
  sku?: string;
  unit?: string;
  quantity: number;
}

export interface StockTransfer {
  id: number;
  transfer_number: string;
  transfer_date: string;
  from_branch_id: number;
  from_branch_name: string;
  from_branch_code: string;
  to_branch_id: number;
  to_branch_name: string;
  to_branch_code: string;
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
  notes?: string;
  created_by_name?: string;
  items_count?: number;
  total_quantity?: number;
  items?: StockTransferItem[];
  created_at: string;
}

export interface BranchPerformanceSummary {
  branch_id: number;
  branch_name: string;
  branch_code: string;
  is_main: boolean;
  address?: string;
  today: { orders: number; revenue: number; paid: number; due: number };
  weekly: { orders: number; revenue: number };
  monthly: { orders: number; revenue: number };
  all_time: { orders: number; revenue: number; paid: number; due: number };
  inventory: {
    total_products: number;
    total_units: number;
    total_cost_value: number;
    total_retail_value: number;
    out_of_stock: number;
    low_stock: number;
  };
}

export interface CashierCollectionRow {
  cashier_id: number;
  cashier_name: string;
  branch_id: number;
  branch_name: string;
  branch_code: string;
  invoices_count: number;
  total_billed: number;
  cash_collected: number;
  bank_card_collected: number;
  total_collected: number;
  total_due: number;
  returns_count: number;
  total_refund: number;
  cash_refund: number;
  net_cash_in_hand: number;
}

export interface BranchAnalyticsData {
  date: string;
  branch_performance: BranchPerformanceSummary[];
  cashier_collections: CashierCollectionRow[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  delivered_quantity: number;
  unitPrice: number;
  priceTier: 'retail' | 'wholesale';
  discount: number;
  lineTotal: number;
}

export interface CustomerPayment {
  id: number;
  customer_id: number;
  sale_id?: number | null;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference_no?: string;
  notes?: string;
  received_by?: number;
}

export interface CustomerLedgerEntry {
  id: number;
  reference: string;
  date: string;
  debit: number;
  credit: number;
  due_amount?: number;
  running_balance: number;
  payment_status?: string;
  payment_method?: string;
  notes?: string;
  type: 'INVOICE' | 'PAYMENT';
}

export interface DrawerExpense {
  id: number;
  shift_id: number;
  branch_id: number;
  cashier_id: number;
  cashier_name: string;
  category: string;
  amount: number;
  note: string;
  paid_to?: string;
  created_at: string;
  recorded_by_name?: string;
}

export interface ShiftRunningMetrics {
  opening_balance: number;
  cash_sales: number;
  other_sales: number;
  total_revenue: number;
  cash_refunds: number;
  total_expenses: number;
  expected_closing_cash: number;
  sales_count: number;
  credit_issued?: number;
}

export interface CashDrawerShift {
  id: number;
  shift_code: string;
  branch_id: number;
  branch_name?: string;
  branch_code?: string;
  branch_address?: string;
  branch_phone?: string;
  cashier_id: number;
  cashier_name: string;
  cashier_full_name?: string;
  opened_at: string;
  closed_at?: string | null;
  status: 'OPEN' | 'CLOSED';
  opening_balance: number;
  cash_sales_amount: number;
  other_sales_amount: number;
  total_sales_amount: number;
  cash_refunds_amount: number;
  drawer_expenses_amount: number;
  expected_closing_cash: number;
  actual_closing_cash?: number | null;
  cash_difference?: number | null;
  closing_notes?: string | null;
  created_at?: string;
  runningMetrics?: ShiftRunningMetrics;
  expenses?: DrawerExpense[];
  sales_count?: number;
  credit_issued?: number;
}

