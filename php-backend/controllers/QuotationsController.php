<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\InvoiceHelper;
use PDO;

class QuotationsController
{
    /**
     * GET /api/quotations
     */
    public function index(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);

        $search = trim((string)$request->query('search', ''));
        $status = $request->query('status');

        $pdo = Database::getConnection();

        $query = "
            SELECT 
                q.*,
                c.name as customer_name,
                c.phone as customer_phone,
                u.name as creator_name,
                (SELECT COUNT(*) FROM quotation_items WHERE quotation_id = q.id) as items_count
            FROM quotations q
            LEFT JOIN customers c ON q.customer_id = c.id
            LEFT JOIN users u ON q.created_by = u.id
            WHERE 1=1
        ";

        $bindings = [];

        if ($search !== '') {
            $query .= " AND (q.quotation_number LIKE :search OR c.name LIKE :search OR c.phone LIKE :search)";
            $bindings[':search'] = "%{$search}%";
        }

        if ($status && $status !== 'all') {
            $query .= " AND q.status = :status";
            $bindings[':status'] = $status;
        }

        $query .= " ORDER BY q.quotation_date DESC, q.id DESC LIMIT 100";

        $stmt = $pdo->prepare($query);
        $stmt->execute($bindings);
        $quotes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($quotes as &$q) {
            $q['id'] = (int)$q['id'];
            $q['grand_total'] = (float)$q['grand_total'];
            $q['items_count'] = (int)$q['items_count'];
        }

        Response::success($quotes);
    }

    /**
     * GET /api/quotations/{id}
     */
    public function show(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            SELECT q.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, u.name as creator_name
            FROM quotations q
            LEFT JOIN customers c ON q.customer_id = c.id
            LEFT JOIN users u ON q.created_by = u.id
            WHERE q.id = ?
        ");
        $stmt->execute([$id]);
        $quote = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$quote) {
            Response::error('Quotation not found.', 404);
            return;
        }

        $itemsStmt = $pdo->prepare("
            SELECT qi.*, p.name as product_name, p.sku, p.unit, p.current_stock
            FROM quotation_items qi
            LEFT JOIN products p ON qi.product_id = p.id
            WHERE qi.quotation_id = ?
            ORDER BY qi.id ASC
        ");
        $itemsStmt->execute([$id]);
        $quote['items'] = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($quote);
    }

    /**
     * POST /api/quotations
     */
    public function store(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);

        $customerId = $request->body('customer_id') ? (int)$request->body('customer_id') : null;
        $customerName = trim((string)$request->body('customer_name', ''));
        $customerPhone = trim((string)$request->body('customer_phone', '')) ?: null;
        $projectTitle = trim((string)$request->body('project_title', 'General Construction Estimate')) ?: 'General Construction Estimate';
        $items = $request->body('items', []);
        $subtotal = (float)$request->body('subtotal', 0);
        $discountAmount = (float)$request->body('discount_amount', 0);
        $validUntil = $request->body('valid_until') ?: date('Y-m-d', strtotime('+15 days'));
        $notes = trim((string)$request->body('notes', ''));

        if (empty($items) || !is_array($items)) {
            Response::error('Quotation must contain at least one item.', 400);
            return;
        }

        $pdo = Database::getConnection();

        if ($customerName === '' && $customerId) {
            $custStmt = $pdo->prepare("SELECT name, phone FROM customers WHERE id = ?");
            $custStmt->execute([$customerId]);
            $cRow = $custStmt->fetch(PDO::FETCH_ASSOC);
            if ($cRow) {
                $customerName = $cRow['name'];
                if (!$customerPhone) $customerPhone = $cRow['phone'];
            }
        }

        if ($customerName === '') {
            $customerName = 'Walk-in / Project Estimate';
        }

        if ($subtotal <= 0) {
            foreach ($items as $it) {
                $subtotal += (float)($it['quantity'] ?? 0) * (float)($it['unit_price'] ?? 0);
            }
        }

        $grandTotal = max(0, round($subtotal - $discountAmount, 2));

        Database::beginTransaction();

        try {
            $quoteNumber = InvoiceHelper::generateQuotationNumber($pdo);

            $stmt = $pdo->prepare("
                INSERT INTO quotations (
                    quotation_number, customer_id, customer_name, customer_phone,
                    project_title, valid_until, subtotal, discount_amount, grand_total,
                    status, notes, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SENT', ?, ?)
            ");
            $stmt->execute([
                $quoteNumber, $customerId, $customerName, $customerPhone,
                $projectTitle, $validUntil, $subtotal, $discountAmount, $grandTotal,
                $notes ?: null, $session['userId']
            ]);
            $quoteId = (int)$pdo->lastInsertId();

            $itemStmt = $pdo->prepare("
                INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, line_total)
                VALUES (?, ?, ?, ?, ?)
            ");

            foreach ($items as $it) {
                $pId = (int)$it['product_id'];
                $qty = (float)$it['quantity'];
                $price = (float)$it['unit_price'];
                $total = round($qty * $price, 2);

                if ($qty <= 0) continue;

                $itemStmt->execute([$quoteId, $pId, $qty, $price, $total]);
            }

            Auth::logAudit($session['userId'], 'CREATE_QUOTATION', 'Quotations', $quoteId, "Created quotation #{$quoteNumber}", $request->getClientIp());

            Database::commit();

            Response::success(['id' => $quoteId, 'quotation_number' => $quoteNumber, 'grand_total' => $grandTotal], 'Quotation created successfully', 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to create quotation: ' . $e->getMessage(), 500);
        }
    }

    /**
     * PUT /api/quotations/{id}/status
     */
    public function updateStatus(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);
        $status = strtoupper(trim((string)$request->body('status', '')));

        $validStatuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
        if (!in_array($status, $validStatuses, true)) {
            Response::error('Invalid quotation status.', 400);
            return;
        }

        $pdo = Database::getConnection();
        $pdo->prepare("UPDATE quotations SET status = ? WHERE id = ?")->execute([$status, $id]);

        Response::success(null, "Quotation status updated to {$status}");
    }

    /**
     * POST /api/quotations/{id}/convert-to-sale (ATOMIC CONVERSION TO SALE INVOICE)
     */
    public function convertToSale(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);
        $paymentMethod = trim((string)$request->body('payment_method', 'Cash'));
        $branchId = (int)($request->body('branch_id') ?: $session['branchId'] ?: 1);

        $pdo = Database::getConnection();

        $quoteStmt = $pdo->prepare("SELECT * FROM quotations WHERE id = ?");
        $quoteStmt->execute([$id]);
        $quote = $quoteStmt->fetch(PDO::FETCH_ASSOC);

        if (!$quote) {
            Response::error('Quotation not found.', 404);
            return;
        }

        if ($quote['status'] === 'CONVERTED') {
            Response::error('This quotation has already been converted into a sale.', 400);
            return;
        }

        // Fetch quotation items
        $itemsStmt = $pdo->prepare("
            SELECT qi.*, p.purchase_price, p.current_stock
            FROM quotation_items qi
            JOIN products p ON qi.product_id = p.id
            WHERE qi.quotation_id = ?
        ");
        $itemsStmt->execute([$id]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($items)) {
            Response::error('Quotation has no items to convert.', 400);
            return;
        }

        Database::beginTransaction();

        try {
            // Unified Invoice Number generation via InvoiceHelper
            $invoiceNumber = InvoiceHelper::generateInvoiceNumber($pdo);

            // Check configurable negative stock policy
            $negSettingStmt = $pdo->query("SELECT `value` FROM settings WHERE `key` = 'allow_negative_stock' LIMIT 1");
            $allowNegativeStock = filter_var($negSettingStmt ? $negSettingStmt->fetchColumn() : false, FILTER_VALIDATE_BOOLEAN);

            if (!$allowNegativeStock) {
                $pLockStmt = $pdo->prepare("SELECT name, unit, current_stock FROM products WHERE id = ? FOR UPDATE");
                foreach ($items as $it) {
                    $pLockStmt->execute([(int)$it['product_id']]);
                    $pRow = $pLockStmt->fetch(PDO::FETCH_ASSOC);
                    if ($pRow && (float)$pRow['current_stock'] < (float)$it['quantity']) {
                        throw new \Exception("Insufficient stock available for '{$pRow['name']}'. Requested: {$it['quantity']}, Available: " . max(0, (float)$pRow['current_stock']) . " {$pRow['unit']}.");
                    }
                }
            }

            $totalCogs = 0.0;
            foreach ($items as $it) {
                $totalCogs += round((float)$it['quantity'] * (float)$it['purchase_price'], 2);
            }

            $grandTotal = round((float)$quote['grand_total'], 2);
            $reqPaid = $request->body('paid_amount');
            $actualPaid = $reqPaid !== null ? round((float)$reqPaid, 2) : $grandTotal;
            $dueAmount = max(0, round($grandTotal - $actualPaid, 2));
            $paymentStatus = $dueAmount <= 0.01 ? 'PAID' : ($actualPaid > 0 ? 'PARTIAL' : 'DUE');
            $grossProfit = round($grandTotal - $totalCogs, 2);

            $custId = $quote['customer_id'] ? (int)$quote['customer_id'] : null;
            if (!$custId) {
                $existingCust = $pdo->prepare("SELECT id FROM customers WHERE phone = ? LIMIT 1");
                $existingCust->execute([$quote['customer_phone'] ?: '']);
                $cId = $existingCust->fetchColumn();
                if ($cId) {
                    $custId = (int)$cId;
                } else {
                    $insCust = $pdo->prepare("
                        INSERT INTO customers (name, phone, address, credit_limit, is_walk_in)
                        VALUES (?, ?, 'From Quotation', 50000, 0)
                    ");
                    $insCust->execute([$quote['customer_name'], $quote['customer_phone'] ?: '']);
                    $custId = (int)$pdo->lastInsertId();
                }
            }

            $insSale = $pdo->prepare("
                INSERT INTO sales (
                    invoice_number, customer_id, branch_id, sale_date, subtotal, tax_amount, discount_amount,
                    grand_total, original_grand_total, net_total, returned_amount, cogs_total, gross_profit,
                    paid_amount, due_amount, payment_method, payment_status, cashier_id
                ) VALUES (?, ?, ?, NOW(), ?, 0, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?, ?, ?)
            ");
            $insSale->execute([
                $invoiceNumber,
                $custId,
                $branchId,
                $quote['subtotal'],
                $quote['discount_amount'],
                $grandTotal,
                $grandTotal,
                $grandTotal,
                $totalCogs,
                $grossProfit,
                $actualPaid,
                $dueAmount,
                $paymentMethod,
                $paymentStatus,
                $session['userId']
            ]);
            $saleId = (int)$pdo->lastInsertId();

            $insSaleItem = $pdo->prepare("
                INSERT INTO sale_items (
                    sale_id, product_id, quantity, unit_cost, unit_price, discount, line_total, line_profit,
                    returned_quantity, remaining_quantity
                ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0.00, ?)
            ");

            $updateGlobalStock = $pdo->prepare("
                UPDATE products SET current_stock = current_stock - ? WHERE id = ?
            ");

            $updateBranchStock = $pdo->prepare("
                INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock)
                VALUES (?, ?, -?, 5)
                ON DUPLICATE KEY UPDATE 
                    current_stock = current_stock - VALUES(current_stock)
            ");

            $insertTxStmt = $pdo->prepare("
                INSERT INTO inventory_transactions (
                    product_id, transaction_type, reference_type, reference_id,
                    quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
                ) VALUES (?, 'SALE', 'INVOICE', ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($items as $it) {
                $pId = (int)$it['product_id'];
                $qty = (float)$it['quantity'];
                $cost = (float)$it['purchase_price'];
                $price = (float)$it['unit_price'];
                $lineCost = round($qty * $cost, 2);
                $lineTotal = round((float)$it['line_total'], 2);
                $lineProfit = round($lineTotal - $lineCost, 2);
                $curStock = (float)$it['current_stock'];

                $insSaleItem->execute([$saleId, $pId, $qty, $cost, $price, $lineTotal, $lineProfit, $qty]);
                $updateGlobalStock->execute([$qty, $pId]);
                $updateBranchStock->execute([$branchId, $pId, $qty]);

                $insertTxStmt->execute([
                    $pId,
                    $saleId,
                    -$qty,
                    $cost,
                    $curStock,
                    $curStock - $qty,
                    "Sale from Quotation conversion {$quote['quotation_number']} ({$invoiceNumber})",
                    $session['userId'],
                    $branchId
                ]);
            }

            if ($dueAmount > 0) {
                $pdo->prepare("
                    UPDATE customers 
                    SET total_purchases = total_purchases + ?,
                        total_paid = total_paid + ?,
                        outstanding_balance = outstanding_balance + ?
                    WHERE id = ?
                ")->execute([$grandTotal, $actualPaid, $dueAmount, $custId]);
            } else {
                $pdo->prepare("
                    UPDATE customers 
                    SET total_purchases = total_purchases + ?,
                        total_paid = total_paid + ?
                    WHERE id = ?
                ")->execute([$grandTotal, $actualPaid, $custId]);
            }

            $pdo->prepare("UPDATE quotations SET status = 'CONVERTED' WHERE id = ?")->execute([$id]);

            Auth::logAudit(
                $session['userId'],
                'CONVERT_QUOTATION_TO_SALE',
                'Quotations',
                $saleId,
                "Converted quotation {$quote['quotation_number']} to invoice {$invoiceNumber}",
                $request->getClientIp()
            );

            Database::commit();

            Response::success([
                'sale_id'        => $saleId,
                'invoice_number' => $invoiceNumber,
            ], "Quotation converted to Invoice {$invoiceNumber} successfully!", 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            $msg = $e->getMessage();
            $statusCode = str_contains($msg, 'Insufficient stock') ? 400 : 500;
            Response::error($msg, $statusCode);
        }
    }

    /**
     * DELETE /api/quotations/{id}
     */
    public function destroy(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $pdo->prepare("DELETE FROM quotation_items WHERE quotation_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM quotations WHERE id = ?")->execute([$id]);

        Response::success(null, 'Quotation deleted successfully');
    }
}
