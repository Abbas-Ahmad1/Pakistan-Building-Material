<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\InvoiceHelper;
use App\Core\InventoryBatchHelper;
use App\Core\Request;
use App\Core\Response;
use PDO;

class PurchasesController
{
    /**
     * GET /api/purchases
     */
    public function index(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);

        $search = trim((string)$request->query('search', ''));
        $supplierId = $request->query('supplier_id');
        $paymentStatus = $request->query('payment_status');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $limit = (int)($request->query('limit', 100));
        $offset = (int)($request->query('offset', 0));

        $pdo = Database::getConnection();

        $query = "
            SELECT 
                p.id,
                p.purchase_number,
                p.supplier_id,
                s.company as supplier_company,
                s.name as supplier_contact,
                p.purchase_date,
                p.subtotal,
                p.tax_amount,
                p.discount_amount,
                p.grand_total,
                p.paid_amount,
                p.due_amount,
                p.payment_status,
                p.notes,
                p.created_by,
                u.name as creator_name,
                p.created_at,
                (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as items_count
            FROM purchases p
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            LEFT JOIN users u ON p.created_by = u.id
            WHERE 1=1
        ";

        $bindings = [];

        if ($search !== '') {
            $query .= " AND (p.purchase_number LIKE :search OR s.company LIKE :search OR p.notes LIKE :search)";
            $bindings[':search'] = "%{$search}%";
        }

        if ($supplierId && $supplierId !== 'all') {
            $query .= " AND p.supplier_id = :sup_id";
            $bindings[':sup_id'] = (int)$supplierId;
        }

        if ($paymentStatus && $paymentStatus !== 'all') {
            $query .= " AND p.payment_status = :p_status";
            $bindings[':p_status'] = $paymentStatus;
        }

        if ($dateFrom) {
            $query .= " AND DATE(p.purchase_date) >= :date_from";
            $bindings[':date_from'] = $dateFrom;
        }

        if ($dateTo) {
            $query .= " AND DATE(p.purchase_date) <= :date_to";
            $bindings[':date_to'] = $dateTo;
        }

        $query .= " ORDER BY p.purchase_date DESC, p.id DESC LIMIT :limit OFFSET :offset";

        $stmt = $pdo->prepare($query);
        foreach ($bindings as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $purchases = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($purchases as &$po) {
            $po['id'] = (int)$po['id'];
            $po['supplier_id'] = (int)$po['supplier_id'];
            $po['subtotal'] = (float)$po['subtotal'];
            $po['tax_amount'] = (float)$po['tax_amount'];
            $po['discount_amount'] = (float)$po['discount_amount'];
            $po['grand_total'] = (float)$po['grand_total'];
            $po['paid_amount'] = (float)$po['paid_amount'];
            $po['due_amount'] = (float)$po['due_amount'];
            $po['items_count'] = (int)$po['items_count'];
        }

        // Aggregate summaries
        $sumStmt = $pdo->query("
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(grand_total), 0) as total_inward_value,
                COALESCE(SUM(paid_amount), 0) as total_paid,
                COALESCE(SUM(due_amount), 0) as total_due
            FROM purchases
        ");
        $summary = $sumStmt->fetch(PDO::FETCH_ASSOC);

        Response::success($purchases, '', 200, ['summary' => $summary]);
    }

    /**
     * GET /api/purchases/{id}
     */
    public function show(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            SELECT 
                p.*,
                s.company as supplier_company,
                s.name as supplier_contact,
                s.phone as supplier_phone,
                s.address as supplier_address,
                u.name as creator_name
            FROM purchases p
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.id = ?
        ");
        $stmt->execute([$id]);
        $purchase = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$purchase) {
            Response::error('Purchase order not found.', 404);
            return;
        }

        // Line items
        $itemsStmt = $pdo->prepare("
            SELECT pi.*, p.name as product_name, p.sku, p.unit
            FROM purchase_items pi
            LEFT JOIN products p ON pi.product_id = p.id
            WHERE pi.purchase_id = ?
            ORDER BY pi.id ASC
        ");
        $itemsStmt->execute([$id]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as &$it) {
            $it['id'] = (int)$it['id'];
            $it['product_id'] = (int)$it['product_id'];
            $it['quantity'] = (float)$it['quantity'];
            $it['unit_cost'] = (float)$it['unit_cost'];
            $it['line_total'] = (float)$it['line_total'];
        }
        $purchase['items'] = $items;

        // Payment logs
        $payStmt = $pdo->prepare("
            SELECT sp.*, u.name as paid_by_name
            FROM supplier_payments sp
            LEFT JOIN users u ON sp.paid_by = u.id
            WHERE sp.purchase_id = ?
            ORDER BY sp.payment_date DESC, sp.id DESC
        ");
        $payStmt->execute([$id]);
        $purchase['payments'] = $payStmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($purchase);
    }

    /**
     * POST /api/purchases (ATOMIC STOCK INWARD TRANSACTION)
     */
    public function store(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $supplierId = (int)$request->body('supplier_id', 0);
        $items = $request->body('items', []);
        $subtotal = (float)$request->body('subtotal', 0);
        $taxAmount = (float)$request->body('tax_amount', 0);
        $discountAmount = (float)$request->body('discount_amount', 0);
        $paidAmount = (float)$request->body('paid_amount', 0);
        $paymentMethod = trim((string)$request->body('payment_method', 'Bank Transfer'));
        $notes = trim((string)$request->body('notes', ''));
        $branchId = (int)($request->body('branch_id') ?: $session['branchId']);

        if ($supplierId <= 0) {
            Response::error('Supplier is required.', 400);
            return;
        }

        if (empty($items) || !is_array($items)) {
            Response::error('Purchase order must contain at least one item.', 400);
            return;
        }

        $calculatedSubtotal = 0.0;
        foreach ($items as $item) {
            $qty = (float)($item['quantity'] ?? 0);
            $cost = (float)($item['unit_cost'] ?? 0);
            $calculatedSubtotal += ($qty * $cost);
        }
        if ($subtotal <= 0) {
            $subtotal = $calculatedSubtotal;
        }

        $rawGrand = $request->body('grand_total');
        $grandTotal = $rawGrand !== null ? round((float)$rawGrand, 2) : round($subtotal + $taxAmount - $discountAmount, 2);
        $dueAmount = round(max(0.00, $grandTotal - $paidAmount), 2);

        $paymentStatus = 'PAID';
        if ($dueAmount > 0 && $paidAmount > 0) {
            $paymentStatus = 'PARTIAL';
        } elseif ($dueAmount > 0 && $paidAmount <= 0) {
            $paymentStatus = 'DUE';
        }

        $pdo = Database::getConnection();

        // Check supplier exists
        $supCheck = $pdo->prepare("SELECT id, company FROM suppliers WHERE id = ?");
        $supCheck->execute([$supplierId]);
        $supplier = $supCheck->fetch(PDO::FETCH_ASSOC);

        if (!$supplier) {
            Response::error('Supplier not found.', 404);
            return;
        }

        Database::beginTransaction();

        try {
            // 1. Generate Unique PO Number: PO-YYYYMMDD-XXXX
            $poNumber = InvoiceHelper::generatePurchaseNumber($pdo);

            // 2. Insert Purchases Master
            $insPO = $pdo->prepare("
                INSERT INTO purchases (
                    purchase_number, supplier_id, purchase_date, subtotal, tax_amount,
                    discount_amount, grand_total, paid_amount, due_amount, payment_status,
                    notes, created_by
                ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $insPO->execute([
                $poNumber, $supplierId, $subtotal, $taxAmount, $discountAmount,
                $grandTotal, $paidAmount, $dueAmount, $paymentStatus, $notes ?: null,
                $session['userId']
            ]);
            $purchaseId = (int)$pdo->lastInsertId();

            // 3. Process Items & Update Stock
            $insItem = $pdo->prepare("
                INSERT INTO purchase_items (
                    purchase_id, product_id, quantity, unit_cost, line_total
                ) VALUES (?, ?, ?, ?, ?)
            ");

            $updateProductStock = $pdo->prepare("
                UPDATE products SET 
                    current_stock = current_stock + ?,
                    purchase_price = ?,
                    updated_at = NOW()
                WHERE id = ?
            ");

            $updateBranchStock = $pdo->prepare("
                INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock)
                VALUES (?, ?, ?, 5.00)
                ON DUPLICATE KEY UPDATE current_stock = current_stock + VALUES(current_stock)
            ");

            $invTxStmt = $pdo->prepare("
                INSERT INTO inventory_transactions (
                    product_id, transaction_type, reference_type, reference_id,
                    quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
                ) VALUES (?, 'PURCHASE', 'PURCHASE_ORDER', ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $prodQuery = $pdo->prepare("SELECT id, name, purchase_price, current_stock FROM products WHERE id = ?");

            foreach ($items as $it) {
                $pId = (int)$it['product_id'];
                $qty = (float)$it['quantity'];
                $unitCost = (float)$it['unit_cost'];
                $lineTotal = round($qty * $unitCost, 2);

                if ($qty <= 0) continue;

                $prodQuery->execute([$pId]);
                $prod = $prodQuery->fetch(PDO::FETCH_ASSOC);

                if (!$prod) {
                    throw new \Exception("Product ID #{$pId} not found in catalog.");
                }

                $stockBefore = (float)$prod['current_stock'];
                $stockAfter = $stockBefore + $qty;

                // Insert item
                $insItem->execute([$purchaseId, $pId, $qty, $unitCost, $lineTotal]);

                // Update product current_stock
                $pdo->prepare("UPDATE products SET current_stock = current_stock + ?, updated_at = NOW() WHERE id = ?")->execute([$qty, $pId]);
                $updateBranchStock->execute([$branchId, $pId, $qty]);

                // Process dynamic batch tracking, cost history, and automatic price updates
                $batchResult = InventoryBatchHelper::processStockInward(
                    $pdo,
                    $pId,
                    $branchId,
                    $qty,
                    $unitCost,
                    $purchaseId,
                    $supplierId,
                    $it['batch_number'] ?? null,
                    $session['userId'],
                    'PURCHASE_ORDER'
                );

                // Inventory transaction audit
                $invTxStmt->execute([
                    $pId, $purchaseId, $qty, $unitCost, $stockBefore, $stockAfter,
                    "Stock inward from PO #{$poNumber} (Batch: {$batchResult['batch_number']})", $session['userId'], $branchId
                ]);
            }

            // 4. Update Supplier Payable Balance & Totals
            $pdo->prepare("
                UPDATE suppliers SET 
                    total_purchases = total_purchases + ?,
                    paid_amount = paid_amount + ?,
                    payable_balance = payable_balance + ?
                WHERE id = ?
            ")->execute([$grandTotal, $paidAmount, $dueAmount, $supplierId]);

            // 5. If immediate payment made, record in supplier_payments
            if ($paidAmount > 0) {
                $pdo->prepare("
                    INSERT INTO supplier_payments (
                        supplier_id, purchase_id, amount, payment_method, reference_no, notes, paid_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ")->execute([
                    $supplierId, $purchaseId, $paidAmount, $paymentMethod, $poNumber,
                    "Initial payment for PO #{$poNumber}", $session['userId']
                ]);
            }

            Auth::logAudit(
                $session['userId'],
                'CREATE_PURCHASE',
                'Purchases',
                $purchaseId,
                "Created PO #{$poNumber} for {$supplier['company']} - Rs. " . number_format($grandTotal, 2),
                $request->getClientIp()
            );

            Database::commit();

            Response::success([
                'purchase_id'     => $purchaseId,
                'purchase_number' => $poNumber,
                'grand_total'     => $grandTotal,
                'paid_amount'     => $paidAmount,
                'due_amount'      => $dueAmount,
                'payment_status'  => $paymentStatus,
            ], "Purchase order #{$poNumber} created and stock updated successfully!", 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            error_log("Failed to record purchase order: " . $e->getMessage());
            $userMsg = str_contains($e->getMessage(), 'not found in catalog')
                ? $e->getMessage()
                : 'Unable to process purchase order. Please verify items and try again.';
            Response::error($userMsg, 400);
        }
    }
}
