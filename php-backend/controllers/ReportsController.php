<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class ReportsController
{
    /**
     * GET /api/reports/profit-loss (P&L Financial Analysis)
     */
    public function profitLoss(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $dateFrom = $request->query('date_from', date('Y-m-01'));
        $dateTo = $request->query('date_to', date('Y-m-d'));
        $branchId = $request->query('branch_id');

        $pdo = Database::getConnection();

        // 1. Sales & Gross Profit
        $salesQuery = "
            SELECT 
                COUNT(*) as total_sales_count,
                COALESCE(SUM(grand_total), 0) as total_revenue,
                COALESCE(SUM(subtotal), 0) as gross_sales,
                COALESCE(SUM(discount_amount), 0) as total_discounts,
                COALESCE(SUM(returned_amount), 0) as total_sales_returns,
                COALESCE(SUM(cogs_total), 0) as total_cogs,
                COALESCE(SUM(gross_profit), 0) as gross_profit
            FROM sales
            WHERE DATE(sale_date) >= :d_from AND DATE(sale_date) <= :d_to
        ";

        $bindings = [':d_from' => $dateFrom, ':d_to' => $dateTo];
        if ($branchId && $branchId !== 'all') {
            $salesQuery .= " AND branch_id = :b_id";
            $bindings[':b_id'] = (int)$branchId;
        }

        $sStmt = $pdo->prepare($salesQuery);
        $sStmt->execute($bindings);
        $salesData = $sStmt->fetch(PDO::FETCH_ASSOC);

        // 2. Expenses
        $expStmt = $pdo->prepare("
            SELECT 
                category,
                COALESCE(SUM(amount), 0) as category_total
            FROM expenses
            WHERE DATE(expense_date) >= :d_from AND DATE(expense_date) <= :d_to
            GROUP BY category
            ORDER BY category_total DESC
        ");
        $expStmt->execute([':d_from' => $dateFrom, ':d_to' => $dateTo]);
        $expenseCategories = $expStmt->fetchAll(PDO::FETCH_ASSOC);

        $totalExpenses = 0.00;
        foreach ($expenseCategories as $ec) {
            $totalExpenses += (float)$ec['category_total'];
        }

        $grossProfit = (float)$salesData['gross_profit'];
        $netProfit = round($grossProfit - $totalExpenses, 2);
        $netMargin = ((float)$salesData['total_revenue'] > 0)
            ? round(($netProfit / (float)$salesData['total_revenue']) * 100, 2)
            : 0.00;

        Response::success([
            'date_from'           => $dateFrom,
            'date_to'             => $dateTo,
            'total_sales_count'   => (int)$salesData['total_sales_count'],
            'total_revenue'       => (float)$salesData['total_revenue'],
            'gross_sales'         => (float)$salesData['gross_sales'],
            'total_discounts'     => (float)$salesData['total_discounts'],
            'total_sales_returns' => (float)$salesData['total_sales_returns'],
            'total_cogs'          => (float)$salesData['total_cogs'],
            'gross_profit'        => $grossProfit,
            'total_expenses'      => $totalExpenses,
            'net_profit'          => $netProfit,
            'net_profit_margin'   => $netMargin,
            'expenses_breakdown'  => $expenseCategories,
        ]);
    }

    /**
     * GET /api/reports/bestsellers (Top Moving Fast Products)
     */
    public function bestsellers(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $limit = (int)($request->query('limit', 10));
        $dateFrom = $request->query('date_from', date('Y-m-01'));
        $dateTo = $request->query('date_to', date('Y-m-d'));

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("
            SELECT 
                p.id,
                p.name,
                p.sku,
                p.unit,
                c.name as category_name,
                COALESCE(SUM(si.quantity), 0) as units_sold,
                COALESCE(SUM(si.line_total), 0) as total_revenue,
                COALESCE(SUM(si.line_profit), 0) as total_profit
            FROM sale_items si
            INNER JOIN sales s ON si.sale_id = s.id
            INNER JOIN products p ON si.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE DATE(s.sale_date) >= :d_from AND DATE(s.sale_date) <= :d_to
            GROUP BY p.id, p.name, p.sku, p.unit, c.name
            ORDER BY units_sold DESC
            LIMIT :limit
        ");

        $stmt->bindValue(':d_from', $dateFrom);
        $stmt->bindValue(':d_to', $dateTo);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $bestsellers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($bestsellers);
    }

    /**
     * GET /api/reports/summary (Store Real-Time KPI Dashboard Overview)
     */
    public function summary(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $isAdmin = ($session['role'] ?? '') === 'ADMIN';

        $pdo = Database::getConnection();

        $today = date('Y-m-d');
        $thisMonth = date('Y-m-01');

        // Today sales
        $todayStmt = $pdo->prepare("
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(grand_total), 0) as revenue,
                COALESCE(SUM(paid_amount), 0) as paid,
                " . ($isAdmin ? "COALESCE(SUM(gross_profit), 0) as profit" : "0 as profit") . "
            FROM sales WHERE DATE(sale_date) = ?
        ");
        $todayStmt->execute([$today]);
        $todayData = $todayStmt->fetch(PDO::FETCH_ASSOC);

        // Monthly sales
        $monthStmt = $pdo->prepare("
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(grand_total), 0) as revenue,
                COALESCE(SUM(paid_amount), 0) as paid,
                " . ($isAdmin ? "COALESCE(SUM(gross_profit), 0) as profit" : "0 as profit") . "
            FROM sales WHERE DATE(sale_date) >= ?
        ");
        $monthStmt->execute([$thisMonth]);
        $monthData = $monthStmt->fetch(PDO::FETCH_ASSOC);

        // Outstanding Receivables & Payables
        $custDue = (float)$pdo->query("SELECT COALESCE(SUM(outstanding_balance), 0) FROM customers")->fetchColumn();
        $supDue = (float)$pdo->query("SELECT COALESCE(SUM(payable_balance), 0) FROM suppliers")->fetchColumn();

        // Stock alerts
        $alerts = $pdo->query("
            SELECT 
                SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) as out_of_stock,
                SUM(CASE WHEN current_stock > 0 AND current_stock <= minimum_stock THEN 1 ELSE 0 END) as low_stock,
                COUNT(*) as total_items
            FROM products WHERE status = 'active'
        ")->fetch(PDO::FETCH_ASSOC);

        Response::success([
            'today' => [
                'invoices_count' => (int)$todayData['count'],
                'revenue'        => (float)$todayData['revenue'],
                'paid'           => (float)$todayData['paid'],
                'gross_profit'   => (float)$todayData['profit'],
            ],
            'this_month' => [
                'invoices_count' => (int)$monthData['count'],
                'revenue'        => (float)$monthData['revenue'],
                'paid'           => (float)$monthData['paid'],
                'gross_profit'   => (float)$monthData['profit'],
            ],
            'financials' => [
                'total_receivables' => $custDue,
                'total_payables'    => $supDue,
            ],
            'inventory' => [
                'out_of_stock' => (int)$alerts['out_of_stock'],
                'low_stock'    => (int)$alerts['low_stock'],
                'total_items'  => (int)$alerts['total_items'],
            ],
        ]);
    }

    /**
     * GET /api/reports/dead-stock (Slow/Non-Moving Stock)
     */
    public function deadStock(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $days = (int)($request->query('days', 60));
        $cutoffDate = date('Y-m-d', strtotime("-{$days} days"));

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("
            SELECT 
                p.id,
                p.sku,
                p.name,
                p.unit,
                p.purchase_price,
                p.selling_price,
                p.current_stock,
                (p.current_stock * p.purchase_price) as tied_capital,
                c.name as category_name,
                MAX(s.sale_date) as last_sold_date
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN sale_items si ON p.id = si.product_id
            LEFT JOIN sales s ON si.sale_id = s.id
            WHERE p.status = 'active' AND p.current_stock > 0
            GROUP BY p.id, p.sku, p.name, p.unit, p.purchase_price, p.selling_price, p.current_stock, c.name
            HAVING last_sold_date IS NULL OR DATE(last_sold_date) < :cutoff
            ORDER BY tied_capital DESC
            LIMIT 100
        ");

        $stmt->execute([':cutoff' => $cutoffDate]);
        $deadStock = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalTiedCapital = 0.00;
        foreach ($deadStock as &$ds) {
            $ds['tied_capital'] = (float)$ds['tied_capital'];
            $totalTiedCapital += $ds['tied_capital'];
        }

        Response::success([
            'days_threshold'     => $days,
            'total_items_count'  => count($deadStock),
            'total_tied_capital' => $totalTiedCapital,
            'items'              => $deadStock,
        ]);
    }

    /**
     * GET /api/reports/price-change-alerts
     * Highlights products with significant cost changes, margin compressions, or pending price reviews
     */
    public function priceChangeAlerts(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $threshold = (float)($request->query('threshold', 5.0));
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("
            SELECT 
                p.id,
                p.name,
                p.sku,
                p.unit,
                c.name as category_name,
                p.purchase_price as current_cost,
                p.previous_cost,
                p.cost_change_percent,
                p.selling_price,
                p.pricing_mode,
                p.markup_percentage,
                p.margin_percentage,
                p.auto_price_update,
                p.last_cost_update,
                CASE 
                    WHEN p.selling_price > 0 THEN ROUND(((p.selling_price - p.purchase_price) / p.selling_price) * 100, 2)
                    ELSE 0.00
                END as current_margin_percent,
                p.current_stock
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.status = 'active'
              AND (ABS(p.cost_change_percent) >= :threshold OR (p.previous_cost > 0 AND p.purchase_price != p.previous_cost))
            ORDER BY ABS(p.cost_change_percent) DESC, p.last_cost_update DESC
        ");
        $stmt->execute([':threshold' => $threshold]);
        $alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($alerts as &$a) {
            $a['id'] = (int)$a['id'];
            $a['current_cost'] = (float)$a['current_cost'];
            $a['previous_cost'] = (float)$a['previous_cost'];
            $a['cost_change_percent'] = (float)$a['cost_change_percent'];
            $a['selling_price'] = (float)$a['selling_price'];
            $a['current_margin_percent'] = (float)$a['current_margin_percent'];
            $a['auto_price_update'] = (bool)$a['auto_price_update'];
            $a['current_stock'] = (float)$a['current_stock'];
        }

        Response::success($alerts);
    }
}
