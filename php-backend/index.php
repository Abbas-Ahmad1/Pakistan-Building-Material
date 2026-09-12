<?php
declare(strict_types=1);

/**
 * POS & ERP - Hardware Store Management System
 * Production PHP 8.2+ REST API Entry Point
 */

// Error handling & reporting
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Load .env file if present in backend directory
$envFile = __DIR__ . '/.env';
if (file_exists($envFile) && is_readable($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (str_contains($line, '=')) {
            [$k, $v] = explode('=', $line, 2);
            $k = trim($k);
            $v = trim($v, " \t\n\r\0\x0B\"'");
            if (getenv($k) === false) {
                putenv("{$k}={$v}");
                $_ENV[$k] = $v;
                $_SERVER[$k] = $v;
            }
        }
    }
}

// Autoloader for App\ namespace
spl_autoload_register(function (string $class): void {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    // Convert e.g. Core\Database to core/Database.php, Controllers\SalesController to controllers/SalesController.php
    $parts = explode('\\', $relativeClass);
    if (count($parts) >= 2) {
        $parts[0] = strtolower($parts[0]);
    }
    $file = $baseDir . implode('/', $parts) . '.php';

    if (file_exists($file)) {
        require_once $file;
    }
});

use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Controllers\AuthController;
use App\Controllers\ProductsController;
use App\Controllers\SalesController;
use App\Controllers\CustomersController;
use App\Controllers\SuppliersController;
use App\Controllers\PurchasesController;
use App\Controllers\CashDrawerController;
use App\Controllers\BranchesController;
use App\Controllers\CategoriesController;
use App\Controllers\QuotationsController;
use App\Controllers\InventoryController;
use App\Controllers\ExpensesController;
use App\Controllers\ReportsController;
use App\Controllers\ZakatController;
use App\Controllers\AuditLogsController;
use App\Controllers\SettingsController;
use App\Controllers\UploadController;
use App\Controllers\UsersController;
use App\Controllers\DashboardController;

// Handle CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: {$origin}");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin");

// Respond to OPTIONS preflight immediately
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$request = new Request();
$router = new Router();

// ==========================================
// API ROUTE DEFINITIONS
// ==========================================

// Health Check
$router->get('/api/health', function () {
    Response::success(['status' => 'healthy', 'engine' => 'PHP ' . PHP_VERSION, 'database' => 'MySQL 8+']);
});

// Dashboard Metrics Route
$router->get('/api/dashboard/metrics', [DashboardController::class, 'metrics']);

// Authentication Routes
$router->post('/api/auth/login', [AuthController::class, 'login']);
$router->get('/api/auth/me', [AuthController::class, 'me']);
$router->post('/api/auth/logout', [AuthController::class, 'logout']);
$router->post('/api/auth/switch-branch', [AuthController::class, 'switchBranch']);

// Products Catalog Routes
$router->get('/api/products/search', [ProductsController::class, 'search']);
$router->get('/api/products', [ProductsController::class, 'index']);
$router->get('/api/products/{id}', [ProductsController::class, 'show']);
$router->post('/api/products', [ProductsController::class, 'store']);
$router->put('/api/products/{id}', [ProductsController::class, 'update']);
$router->delete('/api/products/{id}', [ProductsController::class, 'destroy']);

// POS & Sales Financial Transaction Routes
$router->get('/api/sales', [SalesController::class, 'index']);
$router->get('/api/sales/{id}', [SalesController::class, 'show']);
$router->post('/api/sales', [SalesController::class, 'store']);
$router->post('/api/sales/{id}/returns', [SalesController::class, 'returns']);
$router->post('/api/sales/{id}/payments', [SalesController::class, 'payments']);
$router->post('/api/sales/{id}/delivery', [SalesController::class, 'delivery']);
$router->patch('/api/sales/{id}/loading-fee', [SalesController::class, 'updateLoadingFee']);

// Customers & Khata Ledger Routes
$router->get('/api/customers', [CustomersController::class, 'index']);
$router->get('/api/customers/{id}', [CustomersController::class, 'show']);
$router->post('/api/customers', [CustomersController::class, 'store']);
$router->put('/api/customers/{id}', [CustomersController::class, 'update']);
$router->delete('/api/customers/{id}', [CustomersController::class, 'destroy']);
$router->post('/api/customers/{id}/payments', [CustomersController::class, 'recordPayment']);

// Suppliers & Inward Purchasing Routes
$router->get('/api/suppliers', [SuppliersController::class, 'index']);
$router->get('/api/suppliers/{id}', [SuppliersController::class, 'show']);
$router->post('/api/suppliers', [SuppliersController::class, 'store']);
$router->put('/api/suppliers/{id}', [SuppliersController::class, 'update']);
$router->delete('/api/suppliers/{id}', [SuppliersController::class, 'destroy']);
$router->post('/api/suppliers/{id}/payments', [SuppliersController::class, 'recordPayment']);

// Purchase Orders & Stock Inward Routes
$router->get('/api/purchases', [PurchasesController::class, 'index']);
$router->get('/api/purchases/{id}', [PurchasesController::class, 'show']);
$router->post('/api/purchases', [PurchasesController::class, 'store']);

// Cash Drawer & Shift Management (Z-Report) Routes
$router->get('/api/cash-drawer/status', [CashDrawerController::class, 'status']);
$router->get('/api/cash-drawer/shifts', [CashDrawerController::class, 'shifts']);
$router->post('/api/cash-drawer/open', [CashDrawerController::class, 'open']);
$router->post('/api/cash-drawer/expense', [CashDrawerController::class, 'expense']);
$router->post('/api/cash-drawer/close', [CashDrawerController::class, 'close']);

// Multi-Branch Management Routes
$router->get('/api/branches/matrix/stock', [BranchesController::class, 'stockMatrix']);
$router->get('/api/branches/analytics/comparison', [BranchesController::class, 'analyticsComparison']);
$router->get('/api/branches/transfers/list', [BranchesController::class, 'transfersList']);
$router->get('/api/branches/transfers', [BranchesController::class, 'transfersList']);
$router->post('/api/branches/transfers', [BranchesController::class, 'transfer']);
$router->get('/api/branches', [BranchesController::class, 'index']);
$router->get('/api/branches/{id}', [BranchesController::class, 'show']);
$router->post('/api/branches', [BranchesController::class, 'store']);
$router->put('/api/branches/{id}', [BranchesController::class, 'update']);
$router->delete('/api/branches/{id}', [BranchesController::class, 'destroy']);

// Categories & Subcategories Routes
$router->get('/api/categories', [CategoriesController::class, 'index']);
$router->post('/api/categories', [CategoriesController::class, 'store']);
$router->put('/api/categories/{id}', [CategoriesController::class, 'update']);
$router->delete('/api/categories/{id}', [CategoriesController::class, 'destroy']);
$router->post('/api/categories/{id}/subcategories', [CategoriesController::class, 'storeSubcategory']);
$router->delete('/api/categories/subcategories/{id}', [CategoriesController::class, 'destroySubcategory']);

// Quotations & Estimates Routes
$router->get('/api/quotations', [QuotationsController::class, 'index']);
$router->get('/api/quotations/{id}', [QuotationsController::class, 'show']);
$router->post('/api/quotations', [QuotationsController::class, 'store']);
$router->put('/api/quotations/{id}/status', [QuotationsController::class, 'updateStatus']);
$router->post('/api/quotations/{id}/convert-to-sale', [QuotationsController::class, 'convertToSale']);
$router->delete('/api/quotations/{id}', [QuotationsController::class, 'destroy']);

// Inventory & Valuation Routes
$router->get('/api/inventory/summary', [InventoryController::class, 'summary']);
$router->get('/api/inventory/transactions', [InventoryController::class, 'transactions']);
$router->post('/api/inventory/adjust', [InventoryController::class, 'adjust']);

// Operating Expenses Routes
$router->get('/api/expenses/categories', [ExpensesController::class, 'categories']);
$router->get('/api/expenses', [ExpensesController::class, 'index']);
$router->post('/api/expenses', [ExpensesController::class, 'store']);
$router->delete('/api/expenses/{id}', [ExpensesController::class, 'destroy']);

// Reports & Financial Analytics Routes
$router->get('/api/reports/profit-loss', [ReportsController::class, 'profitLoss']);
$router->get('/api/reports/bestsellers', [ReportsController::class, 'bestsellers']);
$router->get('/api/reports/summary', [ReportsController::class, 'summary']);
$router->get('/api/reports/dead-stock', [ReportsController::class, 'deadStock']);

// Islamic Zakat Assessment Routes
$router->get('/api/zakat/calculate', [ZakatController::class, 'calculate']);
$router->get('/api/zakat/records', [ZakatController::class, 'history']);
$router->get('/api/zakat/history', [ZakatController::class, 'history']);
$router->post('/api/zakat/save', [ZakatController::class, 'save']);
$router->delete('/api/zakat/records/{id}', [ZakatController::class, 'destroy']);

// Audit Trail & Logs
$router->get('/api/audit-logs', [AuditLogsController::class, 'index']);

// Store Settings Routes
$router->get('/api/settings', [SettingsController::class, 'index']);
$router->post('/api/settings', [SettingsController::class, 'update']);

// Image Upload Route
$router->post('/api/upload', [UploadController::class, 'upload']);

// User Management Routes
$router->get('/api/users', [UsersController::class, 'index']);
$router->post('/api/users', [UsersController::class, 'store']);
$router->put('/api/users/{id}', [UsersController::class, 'update']);
$router->delete('/api/users/{id}', [UsersController::class, 'destroy']);

// Dispatch Request
try {
    $router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI'], $request);
} catch (\Throwable $e) {
    Response::error('Internal Server Error: ' . $e->getMessage(), 500);
}
