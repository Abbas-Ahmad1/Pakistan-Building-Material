<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class DashboardController
{
    /**
     * GET /api/dashboard/metrics
     */
    public function metrics(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $isCashier = ($session['role'] === 'CASHIER');
        $range = (string)$request->query('range', '7days');

        $pdo = Database::getConnection();

        // 1. Today's Core KPIs
        $todaySalesQuery = "
            SELECT 
                COALESCE(SUM(grand_total), 0) as todaySales,
                COALESCE(SUM(gross_profit), 0) as todayProfit,
                COUNT(*) as todayOrdersCount
            FROM sales
            WHERE DATE(sale_date) = CURDATE()
        ";
        $salesBindings = [];
        if ($isCashier) {
            $todaySalesQuery .= " AND cashier_id = :cashier_id";
            $salesBindings[':cashier_id'] = $session['userId'];
        }
        $todayStmt = $pdo->prepare($todaySalesQuery);
        $todayStmt->execute($salesBindings);
        $todaySalesRow = $todayStmt->fetch(PDO::FETCH_ASSOC);

        $todayExpStmt = $pdo->query("
            SELECT COALESCE(SUM(amount), 0) as todayExpenses
            FROM expenses
            WHERE DATE(expense_date) = CURDATE()
        ");
        $todayExpenseRow = $todayExpStmt->fetch(PDO::FETCH_ASSOC);

        // 2. Inventory Metrics
        $invStmt = $pdo->query("
            SELECT 
                COUNT(*) as totalProducts,
                COALESCE(SUM(current_stock * purchase_price), 0) as totalInventoryCostValue,
                COALESCE(SUM(current_stock * selling_price), 0) as totalInventoryRetailValue,
                SUM(CASE WHEN current_stock <= minimum_stock AND current_stock > 0 THEN 1 ELSE 0 END) as lowStockCount,
                SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) as outOfStockCount
            FROM products
            WHERE status = 'active'
        ");
        $inventoryRow = $invStmt->fetch(PDO::FETCH_ASSOC);

        // 3. Customers & Suppliers Ledgers
        $custStmt = $pdo->query("
            SELECT 
                COUNT(*) as totalCustomers,
                COALESCE(SUM(outstanding_balance), 0) as customerOutstandingBalance
            FROM customers
        ");
        $customerRow = $custStmt->fetch(PDO::FETCH_ASSOC);

        $supStmt = $pdo->query("
            SELECT 
                COUNT(*) as totalSuppliers,
                COALESCE(SUM(payable_balance), 0) as supplierPayableBalance
            FROM suppliers
        ");
        $supplierRow = $supStmt->fetch(PDO::FETCH_ASSOC);

        // 4. Sales Trends (Daily / Weekly / Monthly)
        $daysCount = 7;
        if ($range === '30days') $daysCount = 30;
        elseif ($range === 'year') $daysCount = 365;
        elseif ($range === 'today') $daysCount = 1;

        $rawSalesQuery = "
            SELECT 
                DATE(sale_date) as day,
                COALESCE(SUM(grand_total), 0) as sales,
                COALESCE(SUM(gross_profit), 0) as profit
            FROM sales
            WHERE sale_date >= DATE_SUB(NOW(), INTERVAL :days DAY)
        ";
        $trendBindings = [':days' => $daysCount];
        if ($isCashier) {
            $rawSalesQuery .= " AND cashier_id = :cashier_id";
            $trendBindings[':cashier_id'] = $session['userId'];
        }
        $rawSalesQuery .= " GROUP BY DATE(sale_date) ORDER BY DATE(sale_date) ASC";

        $salesTrendStmt = $pdo->prepare($rawSalesQuery);
        $salesTrendStmt->execute($trendBindings);
        $rawSales = $salesTrendStmt->fetchAll(PDO::FETCH_ASSOC);

        $rawExpensesStmt = $pdo->prepare("
            SELECT 
                DATE(expense_date) as day,
                COALESCE(SUM(amount), 0) as expenses
            FROM expenses
            WHERE expense_date >= DATE_SUB(NOW(), INTERVAL :days DAY)
            GROUP BY DATE(expense_date)
        ");
        $rawExpensesStmt->execute([':days' => $daysCount]);
        $rawExpenses = $rawExpensesStmt->fetchAll(PDO::FETCH_ASSOC);

        $expenseMap = [];
        foreach ($rawExpenses as $exp) {
            $expenseMap[$exp['day']] = (float)$exp['expenses'];
        }

        $chartData = [];
        foreach ($rawSales as $s) {
            $day = (string)$s['day'];
            $chartData[] = [
                'label'    => $day,
                'sales'    => round((float)$s['sales']),
                'profit'   => $isCashier ? 0 : round((float)$s['profit']),
                'expenses' => $isCashier ? 0 : round($expenseMap[$day] ?? 0.0),
            ];
        }

        if (empty($chartData)) {
            $chartData[] = [
                'label'    => date('Y-m-d'),
                'sales'    => round((float)($todaySalesRow['todaySales'] ?? 0)),
                'profit'   => $isCashier ? 0 : round((float)($todaySalesRow['todayProfit'] ?? 0)),
                'expenses' => $isCashier ? 0 : round((float)($todayExpenseRow['todayExpenses'] ?? 0)),
            ];
        }

        // 5. Recent Sales
        $recentSalesQuery = "
            SELECT 
                s.id,
                s.invoice_number,
                c.name as customer_name,
                s.grand_total,
                s.paid_amount,
                s.due_amount,
                s.payment_method,
                s.payment_status,
                s.sale_date as created_at,
                u.name as cashier_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN users u ON s.cashier_id = u.id
        ";
        $recBindings = [];
        if ($isCashier) {
            $recentSalesQuery .= " WHERE s.cashier_id = :cashier_id";
            $recBindings[':cashier_id'] = $session['userId'];
        }
        $recentSalesQuery .= " ORDER BY s.sale_date DESC LIMIT 6";
        $recentStmt = $pdo->prepare($recentSalesQuery);
        $recentStmt->execute($recBindings);
        $recentSales = $recentStmt->fetchAll(PDO::FETCH_ASSOC);

        // 6. Low Stock Products
        $lowStockStmt = $pdo->query("
            SELECT 
                p.id,
                p.sku,
                p.name,
                c.name as category_name,
                p.unit,
                p.current_stock,
                p.minimum_stock,
                " . ($isCashier ? "0 as purchase_price," : "p.purchase_price,") . "
                p.selling_price
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.status = 'active' AND p.current_stock <= p.minimum_stock
            ORDER BY p.current_stock ASC
            LIMIT 10
        ");
        $lowStockProducts = $lowStockStmt->fetchAll(PDO::FETCH_ASSOC);

        $metrics = [
            'todaySales'                 => (float)($todaySalesRow['todaySales'] ?? 0),
            'todayProfit'                => $isCashier ? 0 : (float)($todaySalesRow['todayProfit'] ?? 0),
            'todayExpenses'              => $isCashier ? 0 : (float)($todayExpenseRow['todayExpenses'] ?? 0),
            'todayOrdersCount'           => (int)($todaySalesRow['todayOrdersCount'] ?? 0),
            'totalProducts'              => (int)($inventoryRow['totalProducts'] ?? 0),
            'totalInventoryCostValue'    => $isCashier ? 0 : (float)($inventoryRow['totalInventoryCostValue'] ?? 0),
            'totalInventoryRetailValue'  => (float)($inventoryRow['totalInventoryRetailValue'] ?? 0),
            'lowStockCount'              => (int)($inventoryRow['lowStockCount'] ?? 0),
            'outOfStockCount'            => (int)($inventoryRow['outOfStockCount'] ?? 0),
            'totalCustomers'             => (int)($customerRow['totalCustomers'] ?? 0),
            'totalSuppliers'             => $isCashier ? 0 : (int)($supplierRow['totalSuppliers'] ?? 0),
            'customerOutstandingBalance' => (float)($customerRow['customerOutstandingBalance'] ?? 0),
            'supplierPayableBalance'     => $isCashier ? 0 : (float)($supplierRow['supplierPayableBalance'] ?? 0),
            'chartData'                  => $chartData,
            'recentSales'                => $recentSales,
            'lowStockProducts'           => $lowStockProducts,
        ];

        Response::success($metrics);
    }
}
