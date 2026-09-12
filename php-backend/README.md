# Hardware Store POS & ERP - PHP 8.2+ REST API Backend

Production-ready PHP backend for the Hardware Store POS & ERP system, designed for standard shared hosting / cPanel environments (Hostinger, GoDaddy, Namecheap, Bluehost, etc.).

## Directory Layout
```
php-backend/
├── config/
│   ├── config.php          # Application settings & session lifetime
│   └── database.php        # MySQL PDO connection credentials
├── controllers/
│   ├── AuthController.php          # Session tokens, login, role RBAC
│   ├── ProductsController.php      # Products catalog & branch stock
│   ├── SalesController.php         # Atomic sales, returns, payments & delivery
│   ├── CustomersController.php      # Khata ledger, receivables & payments
│   ├── SuppliersController.php      # Supplier ledger, payables & payments
│   ├── PurchasesController.php      # Atomic purchase orders & stock inward
│   ├── CashDrawerController.php     # Shifts, petty cash expenses & Z-Report
│   ├── BranchesController.php       # Multi-branch stock matrix & transfers
│   ├── CategoriesController.php     # Categories & subcategories
│   ├── QuotationsController.php     # Quotations & auto-conversion to sales
│   ├── InventoryController.php      # Stock valuation, adjustments & audit trail
│   ├── ExpensesController.php       # Operating expenses & categories
│   ├── ReportsController.php        # P&L financial analysis, bestsellers, dead-stock
│   ├── ZakatController.php          # Shariah wealth & nisab calculation
│   ├── AuditLogsController.php      # System activity audit logs
│   ├── SettingsController.php       # Store settings & receipt preferences
│   ├── UploadController.php         # Product image upload handler
│   └── UsersController.php          # User accounts management
├── core/
│   ├── Database.php        # Singleton PDO wrapper with transaction methods
│   ├── Request.php         # Input parsing, headers & token extractor
│   ├── Response.php        # Standard JSON API responses
│   ├── Router.php          # URL routing & dynamic parameters
│   └── Auth.php            # Security & session authentication
├── uploads/                # Permanent storage for uploaded product images
├── .htaccess               # Apache URL rewrite rules & security headers
├── database.sql            # MySQL 8+ table definitions & foreign keys
├── seed.sql                # Default initial data (users, roles, categories)
├── migrate.php             # Automated SQLite to MySQL migration script
└── index.php               # Single entry point for all API requests
```

## Setup Instructions
1. Import `database.sql` into your MySQL 8+ database.
2. Import `seed.sql` for initial configuration and sample data.
3. Configure `config/database.php` with your database credentials.
4. If migrating from SQLite, run `php migrate.php` via command line.
5. See `DEPLOYMENT_CPANEL.md` in the project root for full deployment details.
