export type Role = 'ADMIN' | 'CASHIER';

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: Role;
  status: 'active' | 'inactive';
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
  quantity: number;
  unit_cost?: number;
  unit_price: number;
  discount: number;
  line_total: number;
  line_profit?: number;
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
  cogs_total?: number;
  gross_profit?: number;
  paid_amount: number;
  due_amount: number;
  payment_method: string;
  payment_status: 'PAID' | 'PARTIAL' | 'DUE';
  cashier_id: number;
  cashier_name?: string;
  items_count?: number;
  items?: SaleItem[];
  settings?: Record<string, string>;
}

export interface CartItem {
  product: Product;
  quantity: number;
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

