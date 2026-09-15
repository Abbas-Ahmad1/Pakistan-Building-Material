<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class BranchesController
{
    /**
     * GET /api/branches
     */
    public function index(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $pdo = Database::getConnection();

        $stmt = $pdo->query("
            SELECT 
                b.*,
                (SELECT COUNT(*) FROM branch_stocks WHERE branch_id = b.id AND current_stock > 0) as active_sku_count,
                (SELECT COALESCE(SUM(current_stock), 0) FROM branch_stocks WHERE branch_id = b.id) as total_units_in_stock
            FROM branches b
            ORDER BY b.id ASC
        ");
        $branches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($branches);
    }

    /**
     * GET /api/branches/{id}
     */
    public function show(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM branches WHERE id = ?");
        $stmt->execute([$id]);
        $branch = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$branch) {
            Response::error('Branch not found.', 404);
            return;
        }

        Response::success($branch);
    }

    /**
     * POST /api/branches (ADMIN only)
     */
    public function store(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $name = trim((string)$request->body('name', ''));
        $code = strtoupper(trim((string)$request->body('code', '')));
        $phone = trim((string)$request->body('phone', '')) ?: null;
        $address = trim((string)$request->body('address', '')) ?: null;
        $status = $request->body('status', 'ACTIVE');

        if ($name === '' || $code === '') {
            Response::error('Branch name and code are required.', 400);
            return;
        }

        $pdo = Database::getConnection();

        // Check code uniqueness
        $check = $pdo->prepare("SELECT id FROM branches WHERE code = ?");
        $check->execute([$code]);
        if ($check->fetch()) {
            Response::error('A branch with this code already exists.', 400);
            return;
        }

        Database::beginTransaction();

        try {
            $stmt = $pdo->prepare("
                INSERT INTO branches (name, code, phone, address, status)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$name, $code, $phone, $address, $status]);
            $branchId = (int)$pdo->lastInsertId();

            // Populate branch_stocks for all existing products with 0 stock
            $products = $pdo->query("SELECT id, minimum_stock FROM products")->fetchAll(PDO::FETCH_ASSOC);
            $bsInsert = $pdo->prepare("
                INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock)
                VALUES (?, ?, 0.00, ?)
            ");
            foreach ($products as $p) {
                $bsInsert->execute([$branchId, $p['id'], $p['minimum_stock'] ?: 5.00]);
            }

            Auth::logAudit($session['userId'], 'CREATE_BRANCH', 'Branches', $branchId, "Created branch: {$name} ({$code})", $request->getClientIp());

            Database::commit();

            Response::success(['id' => $branchId, 'name' => $name, 'code' => $code], 'Branch created successfully', 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            error_log("Failed to create branch: " . $e->getMessage());
            Response::error('Unable to create branch. Please check input and try again.', 400);
        }
    }

    /**
     * PUT /api/branches/{id} (ADMIN only)
     */
    public function update(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM branches WHERE id = ?");
        $stmt->execute([$id]);
        $branch = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$branch) {
            Response::error('Branch not found.', 404);
            return;
        }

        $name = trim((string)$request->body('name', $branch['name']));
        $code = strtoupper(trim((string)$request->body('code', $branch['code'])));
        $phone = trim((string)$request->body('phone', (string)$branch['phone'])) ?: null;
        $address = trim((string)$request->body('address', (string)$branch['address'])) ?: null;
        $status = $request->body('status', $branch['status']);

        // Check code uniqueness
        $check = $pdo->prepare("SELECT id FROM branches WHERE code = ? AND id != ?");
        $check->execute([$code, $id]);
        if ($check->fetch()) {
            Response::error('Another branch with this code already exists.', 400);
            return;
        }

        $upd = $pdo->prepare("
            UPDATE branches SET name = ?, code = ?, phone = ?, address = ?, status = ? WHERE id = ?
        ");
        $upd->execute([$name, $code, $phone, $address, $status, $id]);

        Auth::logAudit($session['userId'], 'UPDATE_BRANCH', 'Branches', $id, "Updated branch: {$name} ({$code})", $request->getClientIp());

        Response::success(null, 'Branch updated successfully');
    }

    /**
     * DELETE /api/branches/{id} (ADMIN only)
     */
    public function destroy(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        if ($id === 1) {
            Response::error('Main Branch cannot be deleted.', 400);
            return;
        }

        $pdo = Database::getConnection();

        $saleCheck = $pdo->prepare("SELECT COUNT(*) FROM sales WHERE branch_id = ?");
        $saleCheck->execute([$id]);
        if ((int)$saleCheck->fetchColumn() > 0) {
            Response::error('Cannot delete branch with historical sales. You can change its status to INACTIVE.', 400);
            return;
        }

        $pdo->prepare("DELETE FROM branch_stocks WHERE branch_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM branches WHERE id = ?")->execute([$id]);

        Auth::logAudit($session['userId'], 'DELETE_BRANCH', 'Branches', $id, "Deleted branch ID: {$id}", $request->getClientIp());

        Response::success(null, 'Branch deleted successfully');
    }

    /**
     * GET /api/branches/matrix/stock (Multi-Branch Inventory Matrix)
     */
    public function stockMatrix(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $pdo = Database::getConnection();

        // Fetch all active branches
        $branches = $pdo->query("SELECT id, name, code FROM branches WHERE status = 'ACTIVE' ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);

        // Fetch all active products
        $products = $pdo->query("
            SELECT p.id, p.sku, p.name, p.unit, p.selling_price, p.current_stock as global_stock, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.status = 'active'
            ORDER BY p.name ASC
        ")->fetchAll(PDO::FETCH_ASSOC);

        // Fetch all branch stocks
        $bsData = $pdo->query("SELECT branch_id, product_id, current_stock, minimum_stock FROM branch_stocks")->fetchAll(PDO::FETCH_ASSOC);

        $stockMap = [];
        foreach ($bsData as $bs) {
            $stockMap[$bs['product_id']][$bs['branch_id']] = [
                'current_stock' => (float)$bs['current_stock'],
                'minimum_stock' => (float)$bs['minimum_stock'],
            ];
        }

        foreach ($products as &$p) {
            $p['branch_stocks'] = [];
            foreach ($branches as $b) {
                $p['branch_stocks'][$b['id']] = $stockMap[$p['id']][$b['id']]['current_stock'] ?? 0.00;
            }
        }

        Response::success([
            'branches' => $branches,
            'products' => $products,
        ]);
    }

    /**
     * GET /api/branches/analytics/comparison (Sales & Revenue Comparison)
     */
    public function analyticsComparison(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $dateFrom = $request->query('date_from', date('Y-m-01'));
        $dateTo = $request->query('date_to', date('Y-m-d'));

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("
            SELECT 
                b.id,
                b.name,
                b.code,
                COUNT(s.id) as total_invoices,
                COALESCE(SUM(s.grand_total), 0) as total_revenue,
                COALESCE(SUM(s.gross_profit), 0) as total_gross_profit,
                COALESCE(SUM(s.paid_amount), 0) as total_cash_collected,
                COALESCE(SUM(s.due_amount), 0) as total_credit_due,
                COALESCE(SUM(s.returned_amount), 0) as total_returns
            FROM branches b
            LEFT JOIN sales s ON b.id = s.branch_id AND DATE(s.sale_date) >= :d_from AND DATE(s.sale_date) <= :d_to
            WHERE b.status = 'ACTIVE'
            GROUP BY b.id, b.name, b.code
            ORDER BY total_revenue DESC
        ");

        $stmt->execute([':d_from' => $dateFrom, ':d_to' => $dateTo]);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($data);
    }

    /**
     * POST /api/branches/transfers (ATOMIC Inter-Branch Stock Transfer)
     */
    public function transfer(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $fromBranchId = (int)$request->body('from_branch_id', 0);
        $toBranchId = (int)$request->body('to_branch_id', 0);
        $items = $request->body('items', []); // [{ product_id, quantity }]
        $notes = trim((string)$request->body('notes', ''));

        if ($fromBranchId <= 0 || $toBranchId <= 0 || $fromBranchId === $toBranchId) {
            Response::error('Valid source and target branches must be specified (cannot be identical).', 400);
            return;
        }

        if (empty($items) || !is_array($items)) {
            Response::error('At least one item must be transferred.', 400);
            return;
        }

        $pdo = Database::getConnection();

        Database::beginTransaction();

        try {
            $transferNumber = 'TRF-' . date('Ymd') . '-' . sprintf('%04d', rand(100, 9999));

            $insTrf = $pdo->prepare("
                INSERT INTO stock_transfers (
                    transfer_number, from_branch_id, to_branch_id, transfer_date,
                    status, notes, created_by
                ) VALUES (?, ?, ?, NOW(), 'COMPLETED', ?, ?)
            ");
            $insTrf->execute([$transferNumber, $fromBranchId, $toBranchId, $notes ?: null, $session['userId']]);
            $transferId = (int)$pdo->lastInsertId();

            $insTrfItem = $pdo->prepare("
                INSERT INTO stock_transfer_items (transfer_id, product_id, quantity)
                VALUES (?, ?, ?)
            ");

            $deductFrom = $pdo->prepare("
                UPDATE branch_stocks SET current_stock = current_stock - ?
                WHERE branch_id = ? AND product_id = ?
            ");

            $addTo = $pdo->prepare("
                INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock)
                VALUES (?, ?, ?, 5.00)
                ON DUPLICATE KEY UPDATE current_stock = current_stock + VALUES(current_stock)
            ");

            $invTx = $pdo->prepare("
                INSERT INTO inventory_transactions (
                    product_id, transaction_type, reference_type, reference_id,
                    quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
                ) VALUES (?, ?, 'TRANSFER', ?, ?, ?, 0.00, 0.00, ?, ?, ?)
            ");

            $prodQuery = $pdo->prepare("SELECT name, purchase_price FROM products WHERE id = ?");

            foreach ($items as $it) {
                $pId = (int)$it['product_id'];
                $qty = (float)$it['quantity'];

                if ($qty <= 0) continue;

                $prodQuery->execute([$pId]);
                $prod = $prodQuery->fetch(PDO::FETCH_ASSOC);
                $unitCost = (float)($prod['purchase_price'] ?? 0);

                // Insert transfer line
                $insTrfItem->execute([$transferId, $pId, $qty]);

                // Deduct from source branch
                $deductFrom->execute([$qty, $fromBranchId, $pId]);

                // Add to target branch
                $addTo->execute([$toBranchId, $pId, $qty]);

                // Log inventory audits for both branches
                $invTx->execute([
                    $pId, 'ADJUSTMENT_OUT', $transferId, -$qty, $unitCost,
                    "Transferred to Branch #{$toBranchId} (Transfer #{$transferNumber})",
                    $session['userId'], $fromBranchId
                ]);

                $invTx->execute([
                    $pId, 'ADJUSTMENT_IN', $transferId, $qty, $unitCost,
                    "Received from Branch #{$fromBranchId} (Transfer #{$transferNumber})",
                    $session['userId'], $toBranchId
                ]);
            }

            Auth::logAudit(
                $session['userId'],
                'BRANCH_TRANSFER',
                'Branches',
                $transferId,
                "Transferred stock from Branch #{$fromBranchId} to Branch #{$toBranchId} (Transfer #{$transferNumber})",
                $request->getClientIp()
            );

            Database::commit();

            Response::success([
                'transfer_id'     => $transferId,
                'transfer_number' => $transferNumber,
            ], "Stock transfer #{$transferNumber} completed successfully!");
        } catch (\Throwable $e) {
            Database::rollBack();
            error_log("Failed to complete stock transfer: " . $e->getMessage());
            Response::error('Unable to complete stock transfer. Please verify stock quantities and try again.', 400);
        }
    }

    /**
     * GET /api/branches/transfers
     */
    public function transfersList(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $pdo = Database::getConnection();

        $stmt = $pdo->query("
            SELECT 
                st.*,
                b1.name as from_branch_name,
                b2.name as to_branch_name,
                u.name as created_by_name,
                (SELECT COUNT(*) FROM stock_transfer_items WHERE transfer_id = st.id) as items_count,
                (SELECT COALESCE(SUM(quantity), 0) FROM stock_transfer_items WHERE transfer_id = st.id) as total_units
            FROM stock_transfers st
            LEFT JOIN branches b1 ON st.from_branch_id = b1.id
            LEFT JOIN branches b2 ON st.to_branch_id = b2.id
            LEFT JOIN users u ON st.created_by = u.id
            ORDER BY st.transfer_date DESC, st.id DESC
            LIMIT 100
        ");
        $transfers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $itemStmt = $pdo->prepare("
            SELECT 
                sti.*,
                p.name as product_name,
                p.sku,
                p.unit
            FROM stock_transfer_items sti
            LEFT JOIN products p ON sti.product_id = p.id
            WHERE sti.transfer_id = ?
        ");

        foreach ($transfers as &$t) {
            $itemStmt->execute([$t['id']]);
            $t['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        Response::success($transfers);
    }
}
