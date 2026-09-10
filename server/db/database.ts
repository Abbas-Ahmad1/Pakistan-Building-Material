import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.resolve(process.cwd(), 'hardware_store.db');
export const db = new DatabaseSync(dbPath);

// Enable Foreign Keys and WAL mode for high concurrency
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  // Create Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      total_purchases REAL DEFAULT 0.00,
      paid_amount REAL DEFAULT 0.00,
      payable_balance REAL DEFAULT 0.00,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      subcategory_id INTEGER,
      brand TEXT,
      description TEXT,
      unit TEXT NOT NULL,
      purchase_price REAL NOT NULL DEFAULT 0.00,
      selling_price REAL NOT NULL DEFAULT 0.00,
      wholesale_price REAL NOT NULL DEFAULT 0.00,
      current_stock REAL NOT NULL DEFAULT 0.00,
      minimum_stock REAL NOT NULL DEFAULT 5.00,
      supplier_id INTEGER,
      image_url TEXT,
      status TEXT CHECK(status IN ('active', 'inactive', 'discontinued')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (subcategory_id) REFERENCES subcategories(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      transaction_type TEXT CHECK(transaction_type IN ('PURCHASE', 'SALE', 'PURCHASE_RETURN', 'SALE_RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT')) NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id INTEGER,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      stock_before REAL NOT NULL,
      stock_after REAL NOT NULL,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      credit_limit REAL DEFAULT 0.00,
      total_purchases REAL DEFAULT 0.00,
      total_paid REAL DEFAULT 0.00,
      outstanding_balance REAL DEFAULT 0.00,
      is_walk_in INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customer_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      sale_id INTEGER,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      reference_no TEXT,
      notes TEXT,
      received_by INTEGER,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (received_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      purchase_id INTEGER,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      reference_no TEXT,
      notes TEXT,
      paid_by INTEGER,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (paid_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL,
      purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      subtotal REAL NOT NULL,
      tax_amount REAL DEFAULT 0.00,
      discount_amount REAL DEFAULT 0.00,
      grand_total REAL NOT NULL,
      paid_amount REAL NOT NULL,
      due_amount REAL NOT NULL,
      payment_status TEXT CHECK(payment_status IN ('PAID', 'PARTIAL', 'DUE')) NOT NULL,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      line_total REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      subtotal REAL NOT NULL,
      tax_amount REAL DEFAULT 0.00,
      discount_amount REAL DEFAULT 0.00,
      grand_total REAL NOT NULL,
      cogs_total REAL NOT NULL,
      gross_profit REAL NOT NULL,
      paid_amount REAL NOT NULL,
      due_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT CHECK(payment_status IN ('PAID', 'PARTIAL', 'DUE')) NOT NULL,
      cashier_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (cashier_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL DEFAULT 0.00,
      line_total REAL NOT NULL,
      line_profit REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      payment_method TEXT NOT NULL,
      description TEXT,
      recorded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recorded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS zakat_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fiscal_year TEXT NOT NULL,
      cash_balance REAL NOT NULL,
      bank_balance REAL NOT NULL,
      inventory_value REAL NOT NULL,
      receivables_value REAL NOT NULL,
      liabilities_value REAL NOT NULL,
      net_zakatable_amount REAL NOT NULL,
      zakat_rate REAL DEFAULT 2.5,
      calculated_zakat REAL NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      project_title TEXT,
      valid_until DATE,
      subtotal REAL NOT NULL,
      discount_amount REAL DEFAULT 0.00,
      grand_total REAL NOT NULL,
      status TEXT CHECK(status IN ('DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED', 'EXPIRED')) DEFAULT 'SENT',
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS sales_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT UNIQUE NOT NULL,
      sale_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      total_refund_amount REAL NOT NULL,
      refund_type TEXT CHECK(refund_type IN ('CASH_REFUND', 'LEDGER_ADJUSTMENT', 'MIXED')) NOT NULL,
      cash_refund_amount REAL DEFAULT 0.00,
      ledger_credit_amount REAL DEFAULT 0.00,
      reason TEXT,
      processed_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (processed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sales_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      sale_item_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      returned_quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      refund_line_total REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      address TEXT,
      phone TEXT,
      manager_name TEXT,
      is_main INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS branch_stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0.00,
      minimum_stock REAL NOT NULL DEFAULT 5.00,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(branch_id, product_id),
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stock_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_number TEXT UNIQUE NOT NULL,
      from_branch_id INTEGER NOT NULL,
      to_branch_id INTEGER NOT NULL,
      transfer_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT CHECK(status IN ('COMPLETED', 'PENDING', 'CANCELLED')) DEFAULT 'COMPLETED',
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_branch_id) REFERENCES branches(id),
      FOREIGN KEY (to_branch_id) REFERENCES branches(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS stock_transfer_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS cash_drawer_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_code TEXT UNIQUE NOT NULL,
      branch_id INTEGER NOT NULL,
      cashier_id INTEGER NOT NULL,
      cashier_name TEXT NOT NULL,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      status TEXT CHECK(status IN ('OPEN', 'CLOSED')) DEFAULT 'OPEN',
      opening_balance REAL NOT NULL DEFAULT 0.00,
      cash_sales_amount REAL NOT NULL DEFAULT 0.00,
      other_sales_amount REAL NOT NULL DEFAULT 0.00,
      total_sales_amount REAL NOT NULL DEFAULT 0.00,
      cash_refunds_amount REAL NOT NULL DEFAULT 0.00,
      drawer_expenses_amount REAL NOT NULL DEFAULT 0.00,
      expected_closing_cash REAL DEFAULT 0.00,
      actual_closing_cash REAL,
      cash_difference REAL DEFAULT 0.00,
      closing_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (branch_id) REFERENCES branches(id),
      FOREIGN KEY (cashier_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS drawer_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      branch_id INTEGER NOT NULL,
      cashier_id INTEGER NOT NULL,
      cashier_name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT NOT NULL,
      paid_to TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES cash_drawer_shifts(id) ON DELETE CASCADE,
      FOREIGN KEY (branch_id) REFERENCES branches(id),
      FOREIGN KEY (cashier_id) REFERENCES users(id)
    );
  `);

  // Column migrations for branches, item returns, shifts & suppliers
  try {
    db.exec('ALTER TABLE users ADD COLUMN branch_id INTEGER REFERENCES branches(id);');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE sales ADD COLUMN branch_id INTEGER REFERENCES branches(id);');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE sales ADD COLUMN cashier_name TEXT;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE sales ADD COLUMN shift_id INTEGER REFERENCES cash_drawer_shifts(id);');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE inventory_transactions ADD COLUMN branch_id INTEGER REFERENCES branches(id);');
  } catch (_) {}
  try {
    db.exec("ALTER TABLE suppliers ADD COLUMN status TEXT DEFAULT 'ACTIVE';");
  } catch (_) {}
  try {
    db.exec('ALTER TABLE sale_items ADD COLUMN returned_quantity REAL DEFAULT 0.00;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE sale_items ADD COLUMN remaining_quantity REAL;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE sales ADD COLUMN returned_amount REAL DEFAULT 0.00;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE sales ADD COLUMN original_grand_total REAL;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE sales ADD COLUMN net_total REAL;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE sale_items ADD COLUMN delivered_quantity REAL;');
  } catch (_) {}
  try {
    db.exec("ALTER TABLE sales ADD COLUMN delivery_status TEXT DEFAULT 'DELIVERED';");
  } catch (_) {}
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sale_delivery_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        sale_item_id INTEGER NOT NULL,
        delivered_quantity REAL NOT NULL,
        total_delivered_after REAL NOT NULL,
        remaining_after REAL NOT NULL,
        notes TEXT,
        recorded_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE
      );
    `);
  } catch (_) {}

  // Backfill existing rows
  try {
    db.exec('UPDATE sale_items SET delivered_quantity = quantity WHERE delivered_quantity IS NULL;');
  } catch (_) {}
  try {
    db.exec("UPDATE sales SET delivery_status = 'DELIVERED' WHERE delivery_status IS NULL;");
  } catch (_) {}
  try {
    db.exec('UPDATE sale_items SET remaining_quantity = MAX(0, quantity - COALESCE(returned_quantity, 0)) WHERE remaining_quantity IS NULL;');
  } catch (_) {}
  try {
    // If original_grand_total is not set:
    // If returned_amount was logged previously, grand_total was still original total in prior versions
    db.exec('UPDATE sales SET original_grand_total = grand_total WHERE original_grand_total IS NULL;');
  } catch (_) {}
  try {
    // Set net_total = original_grand_total - COALESCE(returned_amount, 0)
    db.exec('UPDATE sales SET net_total = ROUND(original_grand_total - COALESCE(returned_amount, 0), 2) WHERE net_total IS NULL;');
    // Set grand_total to net_total for any past returned sales
    db.exec('UPDATE sales SET grand_total = net_total WHERE COALESCE(returned_amount, 0) > 0;');
  } catch (_) {}

  // High-performance relational database indexes
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

      CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
      CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
      CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
      CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(shift_id);
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
      CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);

      CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

      CREATE INDEX IF NOT EXISTS idx_inv_tx_product ON inventory_transactions(product_id);
      CREATE INDEX IF NOT EXISTS idx_inv_tx_branch ON inventory_transactions(branch_id);
      CREATE INDEX IF NOT EXISTS idx_inv_tx_type ON inventory_transactions(transaction_type);

      CREATE INDEX IF NOT EXISTS idx_branch_stocks_branch ON branch_stocks(branch_id);
      CREATE INDEX IF NOT EXISTS idx_branch_stocks_product ON branch_stocks(product_id);

      CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);

      CREATE INDEX IF NOT EXISTS idx_cust_payments_customer ON customer_payments(customer_id);
      CREATE INDEX IF NOT EXISTS idx_supp_payments_supplier ON supplier_payments(supplier_id);

      CREATE INDEX IF NOT EXISTS idx_sales_returns_sale ON sales_returns(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sales_returns_customer ON sales_returns(customer_id);
      CREATE INDEX IF NOT EXISTS idx_sales_return_items_return ON sales_return_items(return_id);

      CREATE INDEX IF NOT EXISTS idx_shifts_branch_status ON cash_drawer_shifts(branch_id, status);
      CREATE INDEX IF NOT EXISTS idx_drawer_expenses_shift ON drawer_expenses(shift_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_module ON audit_logs(user_id, module);
    `);
  } catch (_) {}

  seedInitialData();

  // Ensure current store branding and owner match latest configuration
  try {
    db.prepare(`UPDATE settings SET value = 'Pakistan Building Materials & paint store' WHERE key = 'store_name'`).run();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('email', 'imtayazautos@gmail.com')`).run();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('owner_name', 'Imtiaz Ali')`).run();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('address', 'Kumber Bazar Lower Dir Maidan')`).run();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('phone', '+92 300 5936652 / +92 300 1801818')`).run();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('phone_primary', '+92 300 5936652')`).run();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('phone_secondary', '+92 300 1801818')`).run();
    db.prepare(`UPDATE users SET name = 'Imtiaz Ali (Owner)', email = 'imtayazautos@gmail.com' WHERE username = 'admin'`).run();
    db.prepare(`UPDATE users SET name = 'Majid Mashwani (Cashier)' WHERE username = 'cashier'`).run();
    try {
      db.prepare(`UPDATE branches SET phone = '+92 300 1801818' WHERE phone = '+92 305 9632244'`).run();
    } catch (_) {}
    try {
      db.prepare(`UPDATE sales SET cashier_name = 'Majid Mashwani' WHERE cashier_name LIKE '%Ali Raza%'`).run();
    } catch (_) {}

    // Check if Paints category exists, if not add it
    const paintCat = db.prepare(`SELECT id FROM categories WHERE code = 'CAT-PNT' OR name LIKE '%Paint%'`).get() as any;
    let paintCatId = paintCat?.id;
    if (!paintCatId) {
      const insCat = db.prepare(`INSERT INTO categories (name, code, description) VALUES (?, ?, ?)`).run(
        'Paints & Wall Finishes',
        'CAT-PNT',
        'Interior & exterior emulsions, weathercoat, enamel, primers and rollers'
      );
      paintCatId = Number(insCat.lastInsertRowid);
      db.prepare(`INSERT INTO subcategories (category_id, name) VALUES (?, ?)`).run(paintCatId, 'WeatherCoat & Exterior');
      db.prepare(`INSERT INTO subcategories (category_id, name) VALUES (?, ?)`).run(paintCatId, 'Interior Emulsions');
      db.prepare(`INSERT INTO subcategories (category_id, name) VALUES (?, ?)`).run(paintCatId, 'Enamel & Gloss Paint');
      db.prepare(`INSERT INTO subcategories (category_id, name) VALUES (?, ?)`).run(paintCatId, 'Wall Putty & Primers');
      db.prepare(`INSERT INTO subcategories (category_id, name) VALUES (?, ?)`).run(paintCatId, 'Paint Brushes & Rollers');
    }

    // Add Paint Products if not already added
    const paintProdCheck = db.prepare(`SELECT COUNT(*) as count FROM products WHERE sku = 'PNT-BRG-01'`).get() as any;
    if (paintProdCheck.count === 0) {
      const insProd = db.prepare(`
        INSERT INTO products (
          sku, barcode, name, category_id, subcategory_id, brand, description,
          unit, purchase_price, selling_price, wholesale_price, current_stock, minimum_stock,
          status
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `);
      insProd.run('PNT-BRG-01', '8964007001', 'Berger WeatherCoat Exterior 1 Gallon (White)', paintCatId, 'Berger Paints', 'High durability UV-resistant exterior weather protection paint', 'Liter', 4400, 5600, 5200, 24, 6);
      insProd.run('PNT-BRT-02', '8964007002', 'Brighto Super Emulsion 4L (Off-White)', paintCatId, 'Brighto Paints', 'Washable smooth silk finish interior emulsion paint', 'Liter', 3100, 3950, 3650, 30, 8);
      insProd.run('PNT-DMD-03', '8964007003', 'Diamond Super Gloss Enamel 1 Gallon', paintCatId, 'Diamond Paints', 'High-gloss oil enamel paint for wood, metal and trim', 'Liter', 3700, 4700, 4350, 18, 5);
      insProd.run('PNT-PUT-20', '8964007004', 'Master Acrylic Wall Putty 20kg Bag', paintCatId, 'Master Paints', 'Ready to use smooth leveling skim coat putty for interior plaster', 'Bag', 820, 1150, 1020, 45, 10);
      insProd.run('PNT-ROL-09', '8964007005', 'Royal Heavy Duty Paint Roller 9" with Frame', paintCatId, 'Royal Tools', 'Non-shed micro-fiber roller sleeve with ergonomic cage frame', 'Piece', 420, 650, 550, 40, 10);
      insProd.run('PNT-BRS-04', '8964007006', 'Bristle Pro Paint Brush 4 inch Fine Finish', paintCatId, 'Bristle Pro', 'Pure synthetic flagged bristles for smooth paint application', 'Piece', 180, 290, 240, 55, 12);
    }

    // Synchronize Cement & Aggregates Brands & Subcategories
    const cementCat = db.prepare(`SELECT id FROM categories WHERE code = 'CAT-CEM' OR name LIKE '%Cement%'`).get() as any;
    const cementCatId = cementCat?.id || 4;

    const cementBrands = [
      {
        name: 'Cherat Cement',
        sku: 'CEM-CHT-50',
        barcode: '8964001002',
        productName: 'Cherat Cement OPC 50kg Bag',
        purchasePrice: 1310,
        sellingPrice: 1440,
        wholesalePrice: 1390,
        currentStock: 150,
        minStock: 40,
        desc: 'Cherat Ordinary Portland Cement (OPC) 50kg bag for residential and commercial construction',
      },
      {
        name: 'Fauji Cement (FCCL)',
        sku: 'CEM-FC-50',
        barcode: '8964001003',
        productName: 'Fauji Cement (FCCL) OPC 50kg Bag',
        purchasePrice: 1330,
        sellingPrice: 1460,
        wholesalePrice: 1410,
        currentStock: 200,
        minStock: 50,
        desc: 'Fauji Cement (FCCL) high-grade 50kg Portland cement bag',
      },
      {
        name: 'Lucky Cement',
        sku: 'CEM-LCK-50',
        barcode: '8964001001',
        productName: 'Lucky Cement OPC 50kg Bag',
        purchasePrice: 1320,
        sellingPrice: 1450,
        wholesalePrice: 1400,
        currentStock: 320,
        minStock: 50,
        desc: 'Lucky Cement premium high-strength Portland Grey Cement 50kg bag',
      },
      {
        name: 'Bestway Cement',
        sku: 'CEM-BST-50',
        barcode: '8964001004',
        productName: 'Bestway Cement OPC 50kg Bag',
        purchasePrice: 1325,
        sellingPrice: 1450,
        wholesalePrice: 1400,
        currentStock: 180,
        minStock: 40,
        desc: 'Bestway all-weather high-strength Portland Cement 50kg bag',
      },
      {
        name: 'D.G. Khan Cement (DGKC)',
        sku: 'CEM-DGK-50',
        barcode: '8964001005',
        productName: 'D.G. Khan Cement (DGKC) OPC 50kg Bag',
        purchasePrice: 1315,
        sellingPrice: 1440,
        wholesalePrice: 1395,
        currentStock: 160,
        minStock: 40,
        desc: 'D.G. Khan Cement (DGKC) premium grade 50kg grey Portland cement bag',
      },
      {
        name: 'Maple Leaf Cement',
        sku: 'CEM-MLC-50',
        barcode: '8964001006',
        productName: 'Maple Leaf Cement OPC 50kg Bag',
        purchasePrice: 1335,
        sellingPrice: 1465,
        wholesalePrice: 1415,
        currentStock: 190,
        minStock: 50,
        desc: 'Maple Leaf high-early-strength Portland cement 50kg bag',
      },
      {
        name: 'Falcon Cement',
        sku: 'CEM-FLC-50',
        barcode: '8964001007',
        productName: 'Falcon Cement OPC 50kg Bag',
        purchasePrice: 1300,
        sellingPrice: 1430,
        wholesalePrice: 1380,
        currentStock: 120,
        minStock: 30,
        desc: 'Falcon Cement durable construction grade 50kg Portland cement bag',
      },
      {
        name: 'Kohat Cement',
        sku: 'CEM-KHT-50',
        barcode: '8964001008',
        productName: 'Kohat Cement OPC 50kg Bag',
        purchasePrice: 1310,
        sellingPrice: 1435,
        wholesalePrice: 1385,
        currentStock: 140,
        minStock: 35,
        desc: 'Kohat Cement high-fineness grey Portland cement 50kg bag',
      },
      {
        name: 'Pioneer Cement',
        sku: 'CEM-PNR-50',
        barcode: '8964001009',
        productName: 'Pioneer Cement OPC 50kg Bag',
        purchasePrice: 1305,
        sellingPrice: 1430,
        wholesalePrice: 1380,
        currentStock: 130,
        minStock: 35,
        desc: 'Pioneer Cement rapid-setting structural 50kg grey cement bag',
      },
      {
        name: 'Power Cement',
        sku: 'CEM-PWR-50',
        barcode: '8964001010',
        productName: 'Power Cement OPC 50kg Bag',
        purchasePrice: 1295,
        sellingPrice: 1420,
        wholesalePrice: 1370,
        currentStock: 110,
        minStock: 30,
        desc: 'Power Cement high-grade construction 50kg Portland cement bag',
      },
    ];

    try {
      db.prepare("DELETE FROM subcategories WHERE category_id = ? AND name = 'Portland Cement 50kg'").run(cementCatId);
    } catch (_) {}

    // For each cement brand, ensure subcategory and product exist
    for (const b of cementBrands) {
      let sub = db.prepare('SELECT id FROM subcategories WHERE category_id = ? AND name = ?').get(cementCatId, b.name) as any;
      let subId = sub?.id;
      if (!subId) {
        const ins = db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)').run(cementCatId, b.name);
        subId = Number(ins.lastInsertRowid);
      }

      // Check if product exists
      const prod = db.prepare('SELECT id FROM products WHERE sku = ? OR name = ?').get(b.sku, b.productName) as any;
      if (!prod) {
        db.prepare(`
          INSERT INTO products (
            sku, barcode, name, category_id, subcategory_id, brand, description,
            unit, purchase_price, selling_price, wholesale_price, current_stock, minimum_stock,
            status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Bag', ?, ?, ?, ?, ?, 'active')
        `).run(
          b.sku,
          b.barcode,
          b.productName,
          cementCatId,
          subId,
          b.name,
          b.desc,
          b.purchasePrice,
          b.sellingPrice,
          b.wholesalePrice,
          b.currentStock,
          b.minStock
        );
      } else {
        // Update subcategory_id and brand if needed
        db.prepare(`
          UPDATE products 
          SET subcategory_id = COALESCE(subcategory_id, ?), brand = COALESCE(brand, ?)
          WHERE id = ?
        `).run(subId, b.name, prod.id);
      }
    }
  } catch (err) {
    console.error('Error synchronizing store branding and catalog:', err);
  }

  // Multi-branch initial setup and stock distribution
  seedAndSyncBranches();
}

function seedAndSyncBranches() {
  try {
    // 1. Ensure 3 default branches exist
    const defaultBranches = [
      {
        id: 1,
        name: 'Branch 1 - Main Store & Central Warehouse',
        code: 'BR-01',
        address: 'Kumber Bazar Lower Dir Maidan',
        phone: '+92 300 5936652',
        manager_name: 'Imtiaz Ali (Owner)',
        is_main: 1,
      },
      {
        id: 2,
        name: 'Branch 2 - City Commercial Center',
        code: 'BR-02',
        address: 'Shop #12-14, Main Commercial Market, Timergara',
        phone: '+92 300 1801818',
        manager_name: 'Majid Mashwani',
        is_main: 0,
      },
      {
        id: 3,
        name: 'Branch 3 - Highway Industrial Depot',
        code: 'BR-03',
        address: 'Plot 28, Bypass Road, Chakdara Zone',
        phone: '+92 300 1234567',
        manager_name: 'Tariq Khan',
        is_main: 0,
      },
    ];

    for (const b of defaultBranches) {
      const existing = db.prepare('SELECT id FROM branches WHERE id = ? OR code = ?').get(b.id, b.code) as any;
      if (!existing) {
        db.prepare(`
          INSERT INTO branches (id, name, code, address, phone, manager_name, is_main, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `).run(b.id, b.name, b.code, b.address, b.phone, b.manager_name, b.is_main);
      }
    }

    // 2. Assign default branch_id = 1 to existing users if NULL
    db.prepare('UPDATE users SET branch_id = 1 WHERE branch_id IS NULL').run();

    // 3. Assign default branch_id = 1 and cashier_name to past sales if NULL
    db.prepare('UPDATE sales SET branch_id = 1 WHERE branch_id IS NULL').run();
    db.prepare(`
      UPDATE sales 
      SET cashier_name = (
        SELECT name FROM users WHERE users.id = sales.cashier_id
      )
      WHERE cashier_name IS NULL OR cashier_name = ''
    `).run();

    // 4. Populate / Sync branch_stocks for all products
    const products = db.prepare('SELECT id, sku, name, current_stock, minimum_stock FROM products').all() as any[];

    for (const p of products) {
      const existingStocks = db.prepare('SELECT branch_id, current_stock FROM branch_stocks WHERE product_id = ?').all(p.id) as any[];

      // Check Falcon Cement specifically
      const isFalconCement = p.sku === 'CEM-FLC-50' || (p.name && p.name.includes('Falcon Cement'));

      if (existingStocks.length === 0) {
        if (isFalconCement) {
          // Exactly as requested: 50 bags in Branch 1, 20 bags in Branch 2, and 0 in Branch 3
          db.prepare('INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock) VALUES (?, ?, ?, ?)').run(1, p.id, 50, 10);
          db.prepare('INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock) VALUES (?, ?, ?, ?)').run(2, p.id, 20, 5);
          db.prepare('INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock) VALUES (?, ?, ?, ?)').run(3, p.id, 0, 5);
          db.prepare('UPDATE products SET current_stock = 70 WHERE id = ?').run(p.id);
        } else {
          const total = Math.max(0, Number(p.current_stock) || 0);
          const b1Stock = Math.floor(total * 0.6);
          const b2Stock = Math.floor(total * 0.25);
          const b3Stock = Math.max(0, total - b1Stock - b2Stock);

          db.prepare('INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock) VALUES (?, ?, ?, ?)').run(1, p.id, b1Stock, p.minimum_stock || 5);
          db.prepare('INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock) VALUES (?, ?, ?, ?)').run(2, p.id, b2Stock, Math.max(2, Math.floor((p.minimum_stock || 5) * 0.5)));
          db.prepare('INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock) VALUES (?, ?, ?, ?)').run(3, p.id, b3Stock, Math.max(2, Math.floor((p.minimum_stock || 5) * 0.5)));
        }
      } else {
        if (isFalconCement) {
          db.prepare('INSERT OR REPLACE INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock) VALUES (1, ?, 50, 10)').run(p.id);
          db.prepare('INSERT OR REPLACE INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock) VALUES (2, ?, 20, 5)').run(p.id);
          db.prepare('INSERT OR REPLACE INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock) VALUES (3, ?, 0, 5)').run(p.id);
          db.prepare('UPDATE products SET current_stock = 70 WHERE id = ?').run(p.id);
        }
      }
    }

    // Ensure all products have current_stock equal to sum of their branch stocks
    db.prepare(`
      UPDATE products 
      SET current_stock = COALESCE((
        SELECT SUM(current_stock) FROM branch_stocks WHERE branch_stocks.product_id = products.id
      ), current_stock)
      WHERE id IN (SELECT DISTINCT product_id FROM branch_stocks)
    `).run();

    // 5. Seed initial cash drawer shift if empty
    const shiftCount = db.prepare('SELECT COUNT(*) as count FROM cash_drawer_shifts').get() as any;
    if (shiftCount.count === 0) {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const shiftCode = `SFT-${todayStr}-001`;
      const insShift = db.prepare(`
        INSERT INTO cash_drawer_shifts (
          shift_code, branch_id, cashier_id, cashier_name, opened_at, status,
          opening_balance, expected_closing_cash, closing_notes
        ) VALUES (?, 1, 2, 'Majid Mashwani (Cashier)', datetime('now', '-4 hours'), 'OPEN', 10000, 10000, 'Morning opening shift float')
      `).run(shiftCode);

      const shiftId = Number(insShift.lastInsertRowid);

      // Add demo petty drawer expenses
      db.prepare(`
        INSERT INTO drawer_expenses (shift_id, branch_id, cashier_id, cashier_name, category, amount, note, paid_to, created_at)
        VALUES (?, 1, 2, 'Majid Mashwani (Cashier)', 'Loading & Unloading Labor (Mazdoori)', 600, 'Mazdoori for unloading 20 bags cement', 'Gul Khan (Labor)', datetime('now', '-2 hours'))
      `).run(shiftId);

      db.prepare(`
        INSERT INTO drawer_expenses (shift_id, branch_id, cashier_id, cashier_name, category, amount, note, paid_to, created_at)
        VALUES (?, 1, 2, 'Majid Mashwani (Cashier)', 'Tea & Refreshments (Chaye Kharcha)', 250, 'Shop tea and biscuits for customer meeting', 'Kumber Hotel', datetime('now', '-1 hour'))
      `).run(shiftId);

      // Link today's sales to this shift
      db.prepare(`
        UPDATE sales SET shift_id = ? WHERE branch_id = 1 AND DATE(sale_date) = DATE('now')
      `).run(shiftId);

      // Update shift totals
      const expSum = db.prepare('SELECT SUM(amount) as sum FROM drawer_expenses WHERE shift_id = ?').get(shiftId) as any;
      db.prepare('UPDATE cash_drawer_shifts SET drawer_expenses_amount = ? WHERE id = ?').run(expSum?.sum || 850, shiftId);
    }

    console.log('Multi-branch setup, stock distribution, and audit synchronization completed.');
  } catch (error) {
    console.error('Error synchronizing branches and branch stock:', error);
  }
}

function seedInitialData() {
  const roleCheck = db.prepare('SELECT COUNT(*) as count FROM roles').get() as { count: number };
  if (roleCheck && roleCheck.count > 0) {
    return; // Already seeded
  }

  console.log('Seeding initial Hardware & Sanitary store database...');

  // 1. Roles
  const insertRole = db.prepare('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)');
  insertRole.run(1, 'ADMIN', 'Store Owner / General Administrator with full access');
  insertRole.run(2, 'CASHIER', 'Point of Sale Cashier with sales and billing access');

  // 2. Users (admin / admin123, cashier / cashier123)
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('admin123', salt);
  const cashierHash = bcrypt.hashSync('cashier123', salt);

  const insertUser = db.prepare('INSERT INTO users (name, username, email, password_hash, role_id, status) VALUES (?, ?, ?, ?, ?, ?)');
  insertUser.run('Imtiaz Ali (Owner)', 'admin', 'imtayazautos@gmail.com', adminHash, 1, 'active');
  insertUser.run('Majid Mashwani (Cashier)', 'cashier', 'majid@pakistanmaterials.pk', cashierHash, 2, 'active');

  // 3. Settings
  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('store_name', 'Pakistan Building Materials & paint store');
  insertSetting.run('owner_name', 'Imtiaz Ali');
  insertSetting.run('address', 'Kumber Bazar Lower Dir Maidan');
  insertSetting.run('phone', '+92 300 5936652 / +92 300 1801818');
  insertSetting.run('phone_primary', '+92 300 5936652');
  insertSetting.run('phone_secondary', '+92 300 1801818');
  insertSetting.run('email', 'imtayazautos@gmail.com');
  insertSetting.run('currency', 'Rs.');
  insertSetting.run('invoice_prefix', 'INV-');
  insertSetting.run('tax_rate', '0');
  insertSetting.run('default_discount', '0');
  insertSetting.run('low_stock_threshold', '10');
  insertSetting.run('zakat_rate', '2.5');
  insertSetting.run('invoice_footer', 'Thank you for your business! Goods once sold can be exchanged within 7 days with original invoice.');

  // 4. Categories & Subcategories
  const insertCategory = db.prepare('INSERT INTO categories (id, name, code, description) VALUES (?, ?, ?, ?)');
  insertCategory.run(1, 'Pipes & Fittings', 'CAT-PIPE', 'PVC, PPR, UPVC pipes and plumbing fittings');
  insertCategory.run(2, 'Sanitary Ware & Ceramics', 'CAT-SANI', 'Basins, toilets, urinals and ceramic fixtures');
  insertCategory.run(3, 'Bath & Kitchen Fittings', 'CAT-BATH', 'Taps, mixers, showers and luxury accessories');
  insertCategory.run(4, 'Cement & Aggregates', 'CAT-CEM', 'Grey cement, white cement, and binding materials');
  insertCategory.run(5, 'Water Storage & Pumps', 'CAT-TANK', 'Polyethylene water tanks, pressure pumps');
  insertCategory.run(6, 'Hardware & Tools', 'CAT-TOOL', 'Valves, masonry tools, fasteners and ironmongery');

  const insertSub = db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)');
  insertSub.run(1, 'PVC Pressure Pipes');
  insertSub.run(1, 'PPR Hot/Cold Pipes');
  insertSub.run(1, 'Pipe Elbows & Sockets');
  insertSub.run(2, 'Wash Basins');
  insertSub.run(2, 'Commode & WC Sets');
  insertSub.run(3, 'Bathroom Taps & Mixers');
  insertSub.run(3, 'Shower Heads & Columns');
  insertSub.run(4, 'Cherat Cement');
  insertSub.run(4, 'Fauji Cement (FCCL)');
  insertSub.run(4, 'Lucky Cement');
  insertSub.run(4, 'Bestway Cement');
  insertSub.run(4, 'D.G. Khan Cement (DGKC)');
  insertSub.run(4, 'Maple Leaf Cement');
  insertSub.run(4, 'Falcon Cement');
  insertSub.run(4, 'Kohat Cement');
  insertSub.run(4, 'Pioneer Cement');
  insertSub.run(4, 'Power Cement');
  insertSub.run(5, 'Overhead Water Tanks');
  insertSub.run(6, 'Brass Gate & Ball Valves');
  insertSub.run(6, 'Hand Tools & Trowels');

  // 5. Suppliers
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (name, company, phone, email, address, total_purchases, paid_amount, payable_balance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertSupplier.run('Tariq Mehmood', 'Popular Pipes & Sanitary Ltd', '0321-4567890', 'sales@popularpipes.com', 'Plot 45, Industrial Estate', 850000, 650000, 200000);
  insertSupplier.run('Sheikh Nadeem', 'Lucky Cement Regional Depot', '0300-9876543', 'orders@luckycement.com', 'Silo #4, Railway Yard', 1250000, 1100000, 150000);
  insertSupplier.run('Master Ceramics Corp', 'Master Sanitary Industries', '042-3789456', 'info@masterceramics.com', 'G.T. Road, Gujranwala', 980000, 980000, 0);
  insertSupplier.run('Faisal Iron & Hardware', 'Crown Valves & Tool Importers', '0333-1122334', 'crownvalves@gmail.com', 'Circular Road Hardware Plaza', 420000, 350000, 70000);

  // 6. Customers
  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, phone, email, address, credit_limit, total_purchases, total_paid, outstanding_balance, is_walk_in)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCustomer.run('Walk-in Customer (General Counter)', '0000-0000000', '', 'Over the counter', 0, 185000, 185000, 0, 1);
  insertCustomer.run('Malik Rizwan (Plumbing Contractor)', '0301-7788990', 'rizwan.plumbing@gmail.com', 'DHA Phase 6 Site Office', 150000, 320000, 240000, 80000, 0);
  insertCustomer.run('Al-Madina Construction Co.', '0322-5544332', 'contact@almadinabuilders.com', 'Gulberg III Commercial Plaza', 500000, 740000, 600000, 140000, 0);
  insertCustomer.run('Engr. Zafar Iqbal', '0334-9988776', 'zafar.engineer@outlook.com', 'House 112, Johar Town', 50000, 115000, 115000, 0, 0);

  // 7. Products (Hardware, Sanitary & Building Materials items)
  const insertProduct = db.prepare(`
    INSERT INTO products (
      sku, barcode, name, category_id, subcategory_id, brand, description,
      unit, purchase_price, selling_price, wholesale_price, current_stock, minimum_stock,
      supplier_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Products dataset
  const products = [
    ['CEM-LCK-50', '8964001001', 'Lucky Cement OPC 50kg Bag', 4, 8, 'Lucky Cement', 'Premium high-strength Portland Grey Cement bag', 'Bag', 1320, 1450, 1400, 320, 50, 2, 'active'],
    ['PVC-POP-01', '8964002001', 'PVC Pipe 1 inch Class-B (13ft length)', 1, 1, 'Popular Pipes', 'Heavy-duty water supply PVC pipe 1" x 13ft', 'Piece', 480, 620, 570, 85, 20, 1, 'active'],
    ['PVC-POP-02', '8964002002', 'PVC Pipe 2 inch Class-D Heavy', 1, 1, 'Popular Pipes', 'Commercial drainage and pressure pipe 2" x 13ft', 'Piece', 950, 1250, 1150, 45, 15, 1, 'active'],
    ['PPR-POP-25', '8964002003', 'PPR Pipe 25mm Hot & Cold PN20', 1, 2, 'Popular Pipes', 'Standard polypropylene pipe 25mm for hot water', 'Piece', 580, 780, 720, 60, 20, 1, 'active'],
    ['UPVC-POP-04', '8964002004', 'UPVC Soil & Waste Pipe 4 inch', 1, 1, 'Popular Pipes', 'Sanitary drainage UPVC pipe 4" x 10ft', 'Piece', 1650, 2150, 1980, 30, 10, 1, 'active'],
    ['ELB-PVC-01', '8964002005', 'PVC Elbow 90 Degree 1 inch Socket', 1, 3, 'Popular Pipes', 'Injection molded PVC pressure 90 degree elbow 1"', 'Piece', 45, 75, 65, 350, 50, 1, 'active'],
    ['TNK-PLY-500', '8964003001', 'Water Tank 500 Liters (Triple Layer)', 5, 9, 'Falcon Poly', 'FDA approved food-grade anti-bacterial overhead water tank', 'Piece', 8500, 11500, 10500, 8, 3, 4, 'active'],
    ['TNK-PLY-1000', '8964003002', 'Water Tank 1000 Liters (Triple Layer)', 5, 9, 'Falcon Poly', 'Heavy-gauge UV resistant poly water tank 1000L', 'Piece', 14500, 19000, 17500, 4, 2, 4, 'active'],
    ['TAP-BTH-BRS', '8964004001', 'Heavy Brass Bathroom Bibcock Tap 1/2"', 3, 6, 'Master Sanitary', 'Solid brass chrome-plated long-body bibcock tap', 'Piece', 1200, 1750, 1550, 42, 10, 3, 'active'],
    ['SHW-RAIN-08', '8964004002', 'Rain Shower Head 8 inch with Arm', 3, 7, 'Master Sanitary', 'Square stainless steel luxury rain shower spray', 'Set', 2200, 3200, 2850, 18, 5, 3, 'active'],
    ['SAN-BSN-OVAL', '8964005001', 'Master Ceramic Oval Vanity Basin', 2, 4, 'Master Ceramics', 'Glazed porcelain top-mount vanity wash basin', 'Piece', 4200, 6200, 5600, 12, 4, 3, 'active'],
    ['SAN-WC-DUAL', '8964005002', 'Master One-Piece Dual Flush Commode', 2, 5, 'Master Ceramics', 'Siphon jet soft-closing seat cover luxury toilet set', 'Set', 16500, 23500, 21500, 6, 3, 3, 'active'],
    ['VLV-BRS-01', '8964006001', 'Heavy Brass Gate Valve 1 inch PN16', 6, 10, 'Crown Valves', 'Full port brass gate valve for water line isolation', 'Piece', 1100, 1600, 1400, 3, 10, 4, 'active'], // Low stock demo
    ['VLV-BAL-05', '8964006002', 'Brass Ball Valve 1/2 inch Heavy', 6, 10, 'Crown Valves', 'Quarter-turn stainless handle brass ball valve', 'Piece', 550, 850, 750, 0, 15, 4, 'active'], // Out of stock demo
    ['TOL-TRW-STL', '8964006003', 'Heavy Steel Masonry Trowel 8 inch', 6, 11, 'Falcon Tools', 'Drop-forged carbon steel trowel with wooden handle', 'Piece', 320, 520, 460, 40, 10, 4, 'active'],
  ];

  for (const p of products) {
    insertProduct.run(
      p[0], p[1], p[2], p[3], p[4], p[5], p[6],
      p[7], p[8], p[9], p[10], p[11], p[12],
      p[13], p[14]
    );
  }

  // 8. Demo Purchases (Supplier purchases that built current stock)
  const insertPurchase = db.prepare(`
    INSERT INTO purchases (
      purchase_number, supplier_id, purchase_date, subtotal, tax_amount, discount_amount,
      grand_total, paid_amount, due_amount, payment_status, notes, created_by
    ) VALUES (?, ?, datetime('now', '-3 days'), ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPurchase.run('PO-2026-001', 2, 264000, 0, 4000, 260000, 200000, 60000, 'PARTIAL', 'Cement stock batch for project season', 1);

  // 9. Demo Sales (Real transaction records)
  const insertSale = db.prepare(`
    INSERT INTO sales (
      invoice_number, customer_id, sale_date, subtotal, tax_amount, discount_amount,
      grand_total, cogs_total, gross_profit, paid_amount, due_amount,
      payment_method, payment_status, cashier_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (
      sale_id, product_id, quantity, unit_cost, unit_price, discount, line_total, line_profit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Today's Sales
  insertSale.run('INV-2026-1001', 1, new Date().toISOString(), 7400, 0, 200, 7200, 5140, 2060, 7200, 0, 'Cash', 'PAID', 2);
  insertSaleItem.run(1, 1, 2, 1320, 1450, 0, 2900, 260); // 2 Bags Cement
  insertSaleItem.run(1, 2, 4, 480, 620, 0, 2480, 560);  // 4 PVC Pipes
  insertSaleItem.run(1, 6, 8, 45, 75, 0, 600, 240);    // 8 PVC Elbows
  insertSaleItem.run(1, 9, 1, 1200, 1750, 200, 1550, 350); // 1 Brass Tap

  insertSale.run('INV-2026-1002', 2, new Date().toISOString(), 35000, 0, 1000, 34000, 24800, 9200, 25000, 9000, 'Card', 'PARTIAL', 2);
  insertSaleItem.run(2, 12, 1, 16500, 23500, 500, 23000, 6500); // 1 Commode Set
  insertSaleItem.run(2, 11, 1, 4200, 6200, 500, 5700, 1500);    // 1 Vanity Basin
  insertSaleItem.run(2, 10, 1, 2200, 3200, 0, 3200, 1000);     // 1 Rain Shower Set
  insertSaleItem.run(2, 9, 1, 1200, 1750, 0, 1750, 550);       // 1 Brass Tap

  // Past Sales (Yesterday, 3 days ago, 5 days ago) for realistic chart trends
  const pastDates = [
    { date: "datetime('now', '-1 day')", inv: 'INV-2026-0998', cust: 3, total: 46500, cogs: 34200, profit: 12300, paid: 35000, due: 11500, method: 'Bank Transfer' },
    { date: "datetime('now', '-2 days')", inv: 'INV-2026-0995', cust: 1, total: 18200, cogs: 13100, profit: 5100, paid: 18200, due: 0, method: 'Cash' },
    { date: "datetime('now', '-3 days')", inv: 'INV-2026-0991', cust: 4, total: 29800, cogs: 21500, profit: 8300, paid: 29800, due: 0, method: 'Cash' },
    { date: "datetime('now', '-4 days')", inv: 'INV-2026-0985', cust: 2, total: 54000, cogs: 39000, profit: 15000, paid: 40000, due: 14000, method: 'Card' },
    { date: "datetime('now', '-5 days')", inv: 'INV-2026-0980', cust: 1, total: 22400, cogs: 16000, profit: 6400, paid: 22400, due: 0, method: 'Cash' },
    { date: "datetime('now', '-6 days')", inv: 'INV-2026-0975', cust: 3, total: 61000, cogs: 44000, profit: 17000, paid: 50000, due: 11000, method: 'Bank Transfer' },
  ];

  for (let i = 0; i < pastDates.length; i++) {
    const s = pastDates[i];
    db.exec(`
      INSERT INTO sales (
        invoice_number, customer_id, sale_date, subtotal, tax_amount, discount_amount,
        grand_total, cogs_total, gross_profit, paid_amount, due_amount,
        payment_method, payment_status, cashier_id
      ) VALUES (
        '${s.inv}', ${s.cust}, ${s.date}, ${s.total}, 0, 0,
        ${s.total}, ${s.cogs}, ${s.profit}, ${s.paid}, ${s.due},
        '${s.method}', '${s.due > 0 ? 'PARTIAL' : 'PAID'}', 2
      );
    `);
  }

  // 10. Expenses
  const insertExpense = db.prepare(`
    INSERT INTO expenses (title, category, amount, expense_date, payment_method, description, recorded_by)
    VALUES (?, ?, ?, datetime('now', ?), ?, ?, ?)
  `);
  insertExpense.run('Shop Electricity Bill (LESCO)', 'Electricity', 24500, '-1 day', 'Bank Transfer', 'Monthly commercial electricity bill for main display showroom', 1);
  insertExpense.run('Loading & Freight Transportation', 'Transportation', 6500, '-2 days', 'Cash', 'Freight charge for cement truck unloading at warehouse', 1);
  insertExpense.run('Daily Helper Staff Lunch & Refreshments', 'Salaries', 1800, '0 days', 'Cash', 'Daily store tea and lunch allowance for 4 staff helpers', 1);
  insertExpense.run('Warehouse Shutter Lock Maintenance', 'Maintenance', 2200, '-4 days', 'Cash', 'Welding and oiling of rear warehouse storage shutter', 1);

  // 11. Initial Audit Log
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, action, module, record_id, details)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertAudit.run(1, 'SYSTEM_INITIALIZATION', 'Database', 1, 'Initial store setup, product catalog, demo suppliers, and users initialized successfully.');

  console.log('Database initialization and seeding complete.');
}
