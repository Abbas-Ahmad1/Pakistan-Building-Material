<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class InventoryController
{
    /**
     * GET /api/inventory/summary (Valuation & Health KPIs)
     */
    public function summary(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $isAdmin = ($session['role'] ?? '') === 'ADMIN';
        $branchId = (int)($request->query('branch_id') ?: $session['branchId']);

        $pdo = Database::getConnection();

        // Calculate valuation using branch stock
        $stmt = $pdo->prepare("
            SELECT 
                COUNT(DISTINCT p.id) as total_products,
                COALESCE(SUM(COALESCE(bs.current_stock, p.current_stock)), 0) as total_units,
                " . ($isAdmin ? "COALESCE(SUM(COALESCE(bs.current_stock, p.current_stock) * p.purchase_price), 0) as total_cost_value," : "0 as total_cost_value,") . "
                COALESCE(SUM(COALESCE(bs.current_stock, p.current_stock) * p.selling_price), 0) as total_retail_value,
                SUM(CASE WHEN COALESCE(bs.current_stock, p.current_stock) <= 0 THEN 1 ELSE 0 END) as out_of_stock_count,
                SUM(CASE WHEN COALESCE(bs.current_stock, p.current_stock) > 0 AND COALESCE(bs.current_stock, p.current_stock) <= COALESCE(bs.minimum_stock, p.minimum_stock) THEN 1 ELSE 0 END) as low_stock_count
            FROM products p
            LEFT JOIN branch_stocks bs ON p.id = bs.product_id AND bs.branch_id = ?
            WHERE p.status = 'active'
        ");
        $stmt->execute([$branchId]);
        $summary = $stmt->fetch(PDO::FETCH_ASSOC);

        $costVal = (float)$summary['total_cost_value'];
        $retailVal = (float)$summary['total_retail_value'];
        $potentialProfit = round($retailVal - $costVal, 2);
        $marginPct = ($retailVal > 0) ? round(($potentialProfit / $retailVal) * 100, 2) : 0.00;

        Response::success([
            'total_products'     => (int)$summary['total_products'],
            'total_units'        => (float)$summary['total_units'],
            'total_cost_value'   => $costVal,
            'total_retail_value' => $retailVal,
            'potential_profit'   => $potentialProfit,
            'profit_margin_pct'  => $marginPct,
            'out_of_stock_count' => (int)$summary['out_of_stock_count'],
            'low_stock_count'    => (int)$summary['low_stock_count'],
        ]);
    }

    /**
     * GET /api/inventory/transactions (Stock Movement Audit Trail)
     */
    public function transactions(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);

        $productId = $request->query('product_id');
        $type = $request->query('transaction_type');
        $branchId = $request->query('branch_id');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $limit = (int)($request->query('limit', 100));
        $offset = (int)($request->query('offset', 0));

        $pdo = Database::getConnection();

        $query = "
            SELECT 
                it.*,
                p.name as product_name,
                p.sku,
                p.unit,
                u.name as creator_name,
                b.name as branch_name
            FROM inventory_transactions it
            LEFT JOIN products p ON it.product_id = p.id
            LEFT JOIN users u ON it.created_by = u.id
            LEFT JOIN branches b ON it.branch_id = b.id
            WHERE 1=1
        ";

        $bindings = [];

        if ($productId) {
            $query .= " AND it.product_id = :p_id";
            $bindings[':p_id'] = (int)$productId;
        }

        if ($type && $type !== 'all') {
            $query .= " AND it.transaction_type = :tx_type";
            $bindings[':tx_type'] = $type;
        }

        if ($branchId && $branchId !== 'all') {
            $query .= " AND it.branch_id = :b_id";
            $bindings[':b_id'] = (int)$branchId;
        }

        if ($dateFrom) {
            $query .= " AND DATE(it.created_at) >= :d_from";
            $bindings[':d_from'] = $dateFrom;
        }

        if ($dateTo) {
            $query .= " AND DATE(it.created_at) <= :d_to";
            $bindings[':d_to'] = $dateTo;
        }

        $query .= " ORDER BY it.created_at DESC, it.id DESC LIMIT :limit OFFSET :offset";

        $stmt = $pdo->prepare($query);
        foreach ($bindings as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($transactions);
    }

    /**
     * POST /api/inventory/adjust (Manual Physical Stock Count Adjustment)
     */
    public function adjust(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $productId = (int)$request->body('product_id', 0);
        $newStock = (float)$request->body('new_stock', 0);
        $reason = trim((string)$request->body('reason', 'Physical stock audit'));
        $branchId = (int)($request->body('branch_id') ?: $session['branchId']);

        if ($productId <= 0 || $newStock < 0) {
            Response::error('Valid product ID and non-negative stock quantity are required.', 400);
            return;
        }

        $pdo = Database::getConnection();

        $prodStmt = $pdo->prepare("SELECT id, name, sku, purchase_price, current_stock FROM products WHERE id = ?");
        $prodStmt->execute([$productId]);
        $product = $prodStmt->fetch(PDO::FETCH_ASSOC);

        if (!$product) {
            Response::error('Product not found.', 404);
            return;
        }

        // Fetch current branch stock
        $bsStmt = $pdo->prepare("SELECT current_stock FROM branch_stocks WHERE branch_id = ? AND product_id = ?");
        $bsStmt->execute([$branchId, $productId]);
        $currentBranchStock = (float)($bsStmt->fetchColumn() ?: 0.00);

        $difference = $newStock - $currentBranchStock;
        if (abs($difference) < 0.001) {
            Response::success(null, 'Stock is already at the specified quantity. No adjustment necessary.');
            return;
        }

        $txType = ($difference > 0) ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

        Database::beginTransaction();

        try {
            // Update branch stock
            $pdo->prepare("
                INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock)
                VALUES (?, ?, ?, 5.00)
                ON DUPLICATE KEY UPDATE current_stock = VALUES(current_stock)
            ")->execute([$branchId, $productId, $newStock]);

            // Update product global stock
            $pdo->prepare("UPDATE products SET current_stock = current_stock + ? WHERE id = ?")
                ->execute([$difference, $productId]);

            // Log inventory transaction
            $pdo->prepare("
                INSERT INTO inventory_transactions (
                    product_id, transaction_type, reference_type, reference_id,
                    quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
                ) VALUES (?, ?, 'STOCK_ADJUSTMENT', NULL, ?, ?, ?, ?, ?, ?, ?)
            ")->execute([
                $productId, $txType, $difference, $product['purchase_price'],
                $currentBranchStock, $newStock, $reason, $session['userId'], $branchId
            ]);

            Auth::logAudit(
                $session['userId'],
                'ADJUST_STOCK',
                'Inventory',
                $productId,
                "Adjusted {$product['name']} stock from {$currentBranchStock} to {$newStock} ({$reason})",
                $request->getClientIp()
            );

            Database::commit();

            Response::success([
                'product_id'   => $productId,
                'stock_before' => $currentBranchStock,
                'stock_after'  => $newStock,
                'difference'   => $difference,
            ], 'Inventory stock adjusted successfully!');
        } catch (\Throwable $e) {
            Database::rollBack();
            error_log("Failed to adjust stock: " . $e->getMessage());
            Response::error('Unable to adjust stock. Please check inputs and try again.', 400);
        }
    }
}
