<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\InvoiceHelper;
use App\Core\InventoryBatchHelper;
use PDO;

class SalesController
{
    /**
     * GET /api/sales
     */
    public function index(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $isAdmin = ($session['role'] ?? '') === 'ADMIN';

        $search = trim((string)$request->query('search', ''));
        $paymentStatus = $request->query('payment_status');
        $paymentMethod = $request->query('payment_method');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $customerId = $request->query('customer_id');
        $branchId = $request->query('branch_id');
        $limit = (int)($request->query('limit', 100));
        $offset = (int)($request->query('offset', 0));

        $pdo = Database::getConnection();

        $query = "
            SELECT 
                s.id,
                s.invoice_number,
                s.customer_id,
                c.name as customer_name,
                c.phone as customer_phone,
                s.sale_date,
                s.subtotal,
                s.tax_amount,
                s.discount_amount,
                s.grand_total,
                COALESCE(s.original_grand_total, s.grand_total) as original_grand_total,
                COALESCE(s.net_total, s.grand_total) as net_total,
                COALESCE(s.returned_amount, 0.00) as returned_amount,
                s.paid_amount,
                s.due_amount,
                s.payment_method,
                s.payment_status,
                s.cashier_id,
                u.name as cashier_name,
                s.branch_id,
                b.name as branch_name,
                s.shift_id,
                s.delivery_status,
                s.loading_fee,
                " . ($isAdmin ? "s.cogs_total, s.gross_profit," : "0.00 as cogs_total, 0.00 as gross_profit,") . "
                s.created_at,
                (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN users u ON s.cashier_id = u.id
            LEFT JOIN branches b ON s.branch_id = b.id
            WHERE 1=1
        ";

        $bindings = [];

        if ($search !== '') {
            $query .= " AND (s.invoice_number LIKE :search OR c.name LIKE :search OR c.phone LIKE :search)";
            $bindings[':search'] = "%{$search}%";
        }

        if ($paymentStatus && $paymentStatus !== 'all') {
            $query .= " AND s.payment_status = :status";
            $bindings[':status'] = $paymentStatus;
        }

        if ($paymentMethod && $paymentMethod !== 'all') {
            $query .= " AND s.payment_method = :method";
            $bindings[':method'] = $paymentMethod;
        }

        if ($customerId) {
            $query .= " AND s.customer_id = :cust_id";
            $bindings[':cust_id'] = (int)$customerId;
        }

        if ($branchId && $branchId !== 'all') {
            $query .= " AND s.branch_id = :branch_id";
            $bindings[':branch_id'] = (int)$branchId;
        }

        if ($dateFrom) {
            $query .= " AND DATE(s.sale_date) >= :date_from";
            $bindings[':date_from'] = $dateFrom;
        }

        if ($dateTo) {
            $query .= " AND DATE(s.sale_date) <= :date_to";
            $bindings[':date_to'] = $dateTo;
        }

        $query .= " ORDER BY s.sale_date DESC, s.id DESC LIMIT :limit OFFSET :offset";

        $stmt = $pdo->prepare($query);
        foreach ($bindings as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $sales = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Normalize numeric fields
        foreach ($sales as &$s) {
            $s['id'] = (int)$s['id'];
            $s['customer_id'] = (int)$s['customer_id'];
            $s['cashier_id'] = (int)$s['cashier_id'];
            $s['branch_id'] = (int)$s['branch_id'];
            $s['subtotal'] = (float)$s['subtotal'];
            $s['tax_amount'] = (float)$s['tax_amount'];
            $s['discount_amount'] = (float)$s['discount_amount'];
            $s['grand_total'] = (float)$s['grand_total'];
            $s['original_grand_total'] = (float)$s['original_grand_total'];
            $s['net_total'] = (float)$s['net_total'];
            $s['returned_amount'] = (float)$s['returned_amount'];
            $s['paid_amount'] = (float)$s['paid_amount'];
            $s['due_amount'] = (float)$s['due_amount'];
            $s['loading_fee'] = (float)$s['loading_fee'];
            $s['cogs_total'] = (float)$s['cogs_total'];
            $s['gross_profit'] = (float)$s['gross_profit'];
            $s['items_count'] = (int)$s['items_count'];
        }

        // Calculate summary KPI totals for the filtered set
        $summaryStmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total_invoices,
                COALESCE(SUM(grand_total), 0) as total_sales,
                COALESCE(SUM(paid_amount), 0) as total_paid,
                COALESCE(SUM(due_amount), 0) as total_due,
                COALESCE(SUM(returned_amount), 0) as total_returned,
                " . ($isAdmin ? "COALESCE(SUM(gross_profit), 0) as total_profit" : "0 as total_profit") . "
            FROM sales s
            WHERE 1=1
        ");
        $summaryStmt->execute();
        $summary = $summaryStmt->fetch(PDO::FETCH_ASSOC);

        Response::success($sales, '', 200, ['summary' => $summary]);
    }

    /**
     * GET /api/sales/{id}
     */
    public function show(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $isAdmin = ($session['role'] ?? '') === 'ADMIN';
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("
            SELECT 
                s.*,
                c.name as customer_name,
                c.phone as customer_phone,
                c.address as customer_address,
                u.name as cashier_name,
                b.name as branch_name,
                b.address as branch_address,
                b.phone as branch_phone
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN users u ON s.cashier_id = u.id
            LEFT JOIN branches b ON s.branch_id = b.id
            WHERE s.id = ?
        ");
        $stmt->execute([$id]);
        $sale = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$sale) {
            Response::error('Sale invoice not found.', 404);
            return;
        }

        if (!$isAdmin) {
            $sale['cogs_total'] = 0.00;
            $sale['gross_profit'] = 0.00;
        }

        // Fetch items
        $itemsStmt = $pdo->prepare("
            SELECT 
                si.*,
                p.name as product_name,
                p.sku,
                p.barcode,
                p.unit
            FROM sale_items si
            LEFT JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = ?
            ORDER BY si.id ASC
        ");
        $itemsStmt->execute([$id]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as &$item) {
            $item['id'] = (int)$item['id'];
            $item['product_id'] = (int)$item['product_id'];
            $item['quantity'] = (float)$item['quantity'];
            $item['unit_price'] = (float)$item['unit_price'];
            $item['unit_cost'] = $isAdmin ? (float)$item['unit_cost'] : 0.00;
            $item['discount'] = (float)$item['discount'];
            $item['line_total'] = (float)$item['line_total'];
            $item['line_profit'] = $isAdmin ? (float)$item['line_profit'] : 0.00;
            $item['returned_quantity'] = (float)$item['returned_quantity'];
            $item['remaining_quantity'] = $item['remaining_quantity'] !== null ? (float)$item['remaining_quantity'] : 0.00;
            $item['delivered_quantity'] = $item['delivered_quantity'] !== null ? (float)$item['delivered_quantity'] : 0.00;
        }
        $sale['items'] = $items;

        // Fetch returns history
        $returnsStmt = $pdo->prepare("
            SELECT 
                sr.*,
                u.name as processed_by_name
            FROM sales_returns sr
            LEFT JOIN users u ON sr.processed_by = u.id
            WHERE sr.sale_id = ?
            ORDER BY sr.id DESC
        ");
        $returnsStmt->execute([$id]);
        $returns = $returnsStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($returns as &$ret) {
            $retItemsStmt = $pdo->prepare("
                SELECT sri.*, p.name as product_name, p.unit
                FROM sales_return_items sri
                LEFT JOIN products p ON sri.product_id = p.id
                WHERE sri.return_id = ?
            ");
            $retItemsStmt->execute([$ret['id']]);
            $ret['items'] = $retItemsStmt->fetchAll(PDO::FETCH_ASSOC);
        }
        $sale['returns'] = $returns;

        // Fetch delivery logs
        $delStmt = $pdo->prepare("
            SELECT dl.*, p.name as product_name, u.name as recorder_name
            FROM sale_delivery_logs dl
            LEFT JOIN sale_items si ON dl.sale_item_id = si.id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN users u ON dl.recorded_by = u.id
            WHERE dl.sale_id = ?
            ORDER BY dl.id DESC
        ");
        $delStmt->execute([$id]);
        $sale['delivery_logs'] = $delStmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($sale);
    }

    /**
     * POST /api/sales (COMPLETE ATOMIC FINANCIAL POS TRANSACTION)
     */
    public function store(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $userId = $session['userId'];
        $branchId = (int)($request->body('branch_id') ?: $session['branchId']);

        $items = $request->body('items', []);
        if (empty($items) || !is_array($items)) {
            Response::error('Sale must contain at least one item.', 400);
            return;
        }

        $subtotal = (float)$request->body('subtotal', 0);
        $taxAmount = (float)$request->body('tax_amount', 0);
        $discountAmount = (float)$request->body('discount_amount', 0);
        $loadingFee = (float)$request->body('loading_fee', 0);
        $paidAmount = (float)$request->body('paid_amount', 0);
        $paymentMethod = trim((string)$request->body('payment_method', 'Cash'));
        $deliveryStatus = trim((string)$request->body('delivery_status', 'DELIVERED'));
        $shiftId = $request->body('shift_id') ? (int)$request->body('shift_id') : null;

        $grandTotal = round($subtotal + $taxAmount - $discountAmount + $loadingFee, 2);
        if ($grandTotal < 0) {
            $grandTotal = 0.00;
        }

        $dueAmount = round(max(0.00, $grandTotal - $paidAmount), 2);
        $paymentStatus = 'PAID';
        if ($dueAmount > 0 && $paidAmount > 0) {
            $paymentStatus = 'PARTIAL';
        } elseif ($dueAmount > 0 && $paidAmount <= 0) {
            $paymentStatus = 'DUE';
        }

        $pdo = Database::getConnection();

        Database::beginTransaction();

        try {
            // 1. Resolve Customer
            $customerId = $request->body('customer_id');
            if (!$customerId) {
                $custName = trim((string)$request->body('customer_name', ''));
                $custPhone = trim((string)$request->body('customer_phone', ''));

                if ($custPhone !== '') {
                    $existCust = $pdo->prepare("SELECT id FROM customers WHERE phone = ? LIMIT 1");
                    $existCust->execute([$custPhone]);
                    $foundId = $existCust->fetchColumn();
                    if ($foundId) {
                        $customerId = (int)$foundId;
                    }
                }

                if (!$customerId) {
                    if ($custName === '' && $custPhone === '') {
                        // Default to walk-in customer
                        $walkIn = $pdo->query("SELECT id FROM customers WHERE is_walk_in = 1 LIMIT 1")->fetchColumn();
                        $customerId = $walkIn ? (int)$walkIn : 1;
                    } else {
                        $insCust = $pdo->prepare("
                            INSERT INTO customers (name, phone, is_walk_in)
                            VALUES (?, ?, 0)
                        ");
                        $insCust->execute([$custName ?: 'Cash Customer', $custPhone ?: null]);
                        $customerId = (int)$pdo->lastInsertId();
                    }
                }
            } else {
                $customerId = (int)$customerId;
            }

            // 2. Generate Sequential Unique Invoice Number via unified InvoiceHelper
            $invoiceNumber = InvoiceHelper::generateInvoiceNumber($pdo);

            // Fetch configurable negative stock policy
            $negSettingStmt = $pdo->query("SELECT `value` FROM settings WHERE `key` = 'allow_negative_stock' LIMIT 1");
            $allowNegativeStock = filter_var($negSettingStmt ? $negSettingStmt->fetchColumn() : false, FILTER_VALIDATE_BOOLEAN);

            // 3. Process Items & Calculate COGS / Stock Deductions
            $cogsTotal = 0.00;
            $processedItems = [];

            $prodStmt = $pdo->prepare("
                SELECT id, name, sku, unit, purchase_price, selling_price, current_stock
                FROM products WHERE id = ? FOR UPDATE
            ");

            $bsStmt = $pdo->prepare("
                SELECT current_stock FROM branch_stocks WHERE branch_id = ? AND product_id = ? FOR UPDATE
            ");

            foreach ($items as $item) {
                $pId = (int)$item['product_id'];
                $qty = (float)$item['quantity'];
                $unitPrice = (float)$item['unit_price'];
                $discount = (float)($item['discount'] ?? 0);
                $lineTotal = round(($qty * $unitPrice) - $discount, 2);

                if ($qty <= 0) {
                    continue;
                }

                $prodStmt->execute([$pId]);
                $prod = $prodStmt->fetch(PDO::FETCH_ASSOC);

                if (!$prod) {
                    throw new \Exception("Product ID #{$pId} not found in catalog.");
                }

                $bsStmt->execute([$branchId, $pId]);
                $branchStockBefore = (float)($bsStmt->fetchColumn() ?: 0.00);

                // Enforce stock availability if allow_negative_stock is disabled
                if (!$allowNegativeStock) {
                    if ((float)$prod['current_stock'] < $qty) {
                        throw new \Exception("Insufficient stock available for '{$prod['name']}'. Requested: {$qty}, Available: " . max(0, (float)$prod['current_stock']) . " {$prod['unit']}.");
                    }
                    if ($branchStockBefore < $qty) {
                        throw new \Exception("Insufficient branch stock available for '{$prod['name']}'. Requested: {$qty}, Available: " . max(0, $branchStockBefore) . " {$prod['unit']}.");
                    }
                }

                $unitCost = (float)($item['unit_cost'] ?? $prod['purchase_price']);
                $lineCost = round($qty * $unitCost, 2);
                $lineProfit = round($lineTotal - $lineCost, 2);
                $cogsTotal += $lineCost;

                $processedItems[] = [
                    'product_id'          => $pId,
                    'quantity'            => $qty,
                    'unit_cost'           => $unitCost,
                    'unit_price'          => $unitPrice,
                    'discount'            => $discount,
                    'line_total'          => $lineTotal,
                    'line_profit'         => $lineProfit,
                    'returned_quantity'   => 0.00,
                    'remaining_quantity'  => ($deliveryStatus === 'PENDING_DELIVERY') ? $qty : 0.00,
                    'delivered_quantity'  => ($deliveryStatus === 'DELIVERED') ? $qty : 0.00,
                    'global_stock_before' => (float)$prod['current_stock'],
                    'branch_stock_before' => $branchStockBefore,
                    'product_name'        => $prod['name'],
                ];
            }

            $grossProfit = round($grandTotal - $cogsTotal, 2);

            // 4. Insert Sale Master Record (with placeholder cogs, updated after precise batch consumption)
            $saleInsert = $pdo->prepare("
                INSERT INTO sales (
                    invoice_number, customer_id, sale_date, subtotal, tax_amount, discount_amount,
                    grand_total, original_grand_total, net_total, returned_amount, cogs_total,
                    gross_profit, paid_amount, due_amount, payment_method, payment_status,
                    cashier_id, cashier_name, branch_id, shift_id, delivery_status, loading_fee
                ) VALUES (
                    ?, ?, NOW(), ?, ?, ?,
                    ?, ?, ?, 0.00, 0.00,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?
                )
            ");

            $saleInsert->execute([
                $invoiceNumber, $customerId, $subtotal, $taxAmount, $discountAmount,
                $grandTotal, $grandTotal, $grandTotal,
                $grandTotal, $paidAmount, $dueAmount, $paymentMethod, $paymentStatus,
                $userId, $session['name'], $branchId, $shiftId, $deliveryStatus, $loadingFee
            ]);

            $saleId = (int)$pdo->lastInsertId();

            // 5. Insert Sale Items, Consume Stock from Batches (FIFO / AVCO), Update Stock & Ledger
            $itemInsert = $pdo->prepare("
                INSERT INTO sale_items (
                    sale_id, product_id, quantity, unit_cost, unit_price, discount,
                    line_total, line_profit, returned_quantity, remaining_quantity, delivered_quantity
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stockUpdateGlobal = $pdo->prepare("
                UPDATE products SET current_stock = current_stock - ? WHERE id = ?
            ");

            $stockUpdateBranch = $pdo->prepare("
                INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock)
                VALUES (?, ?, -?, 5.00)
                ON DUPLICATE KEY UPDATE current_stock = current_stock - VALUES(current_stock)
            ");

            $invTxInsert = $pdo->prepare("
                INSERT INTO inventory_transactions (
                    product_id, transaction_type, reference_type, reference_id,
                    quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
                ) VALUES (?, 'SALE', 'INVOICE', ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($processedItems as $pi) {
                // Consume inventory batches using FIFO / AVCO costing
                $consumption = InventoryBatchHelper::consumeStockForSale(
                    $pdo,
                    $pi['product_id'],
                    $branchId,
                    $pi['quantity'],
                    $saleId
                );

                $actualUnitCost = $consumption['effective_unit_cost'] > 0 ? $consumption['effective_unit_cost'] : $pi['unit_cost'];
                $actualLineCost = $consumption['cogs'] > 0 ? $consumption['cogs'] : round($pi['quantity'] * $actualUnitCost, 2);
                $actualLineProfit = round($pi['line_total'] - $actualLineCost, 2);
                $cogsTotal += $actualLineCost;

                $itemInsert->execute([
                    $saleId, $pi['product_id'], $pi['quantity'], $actualUnitCost, $pi['unit_price'],
                    $pi['discount'], $pi['line_total'], $actualLineProfit,
                    $pi['returned_quantity'], $pi['remaining_quantity'], $pi['delivered_quantity']
                ]);

                // Deduct stock from catalog and branch stock
                $stockUpdateGlobal->execute([$pi['quantity'], $pi['product_id']]);
                $stockUpdateBranch->execute([$branchId, $pi['product_id'], $pi['quantity']]);

                // Inventory transaction audit
                $stockAfterGlobal = $pi['global_stock_before'] - $pi['quantity'];
                $invTxInsert->execute([
                    $pi['product_id'], $saleId, -$pi['quantity'], $actualUnitCost,
                    $pi['global_stock_before'], $stockAfterGlobal,
                    "Sale invoice #{$invoiceNumber} (Method: {$consumption['costing_method']})",
                    $userId, $branchId
                ]);
            }

            $grossProfit = round($grandTotal - $cogsTotal, 2);

            // Update master sale with exact calculated batch COGS & gross profit
            $pdo->prepare("
                UPDATE sales SET cogs_total = ?, gross_profit = ? WHERE id = ?
            ")->execute([$cogsTotal, $grossProfit, $saleId]);

            // 6. Update Customer Ledger Balance (Khata)
            $custUpdate = $pdo->prepare("
                UPDATE customers SET 
                    total_purchases = total_purchases + ?,
                    total_paid = total_paid + ?,
                    outstanding_balance = outstanding_balance + ?
                WHERE id = ?
            ");
            $custUpdate->execute([$grandTotal, $paidAmount, $dueAmount, $customerId]);

            // If cash/card received, record in customer_payments
            if ($paidAmount > 0) {
                $payInsert = $pdo->prepare("
                    INSERT INTO customer_payments (
                        customer_id, sale_id, amount, payment_method, reference_no, notes, received_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                $payInsert->execute([
                    $customerId, $saleId, $paidAmount, $paymentMethod, $invoiceNumber,
                    "Payment received at checkout for invoice {$invoiceNumber}", $userId
                ]);
            }

            // 7. Update Cash Drawer Shift metrics if active
            if ($shiftId) {
                if ($paymentMethod === 'Cash') {
                    $pdo->prepare("
                        UPDATE cash_drawer_shifts SET
                            cash_sales_amount = cash_sales_amount + ?,
                            total_sales_amount = total_sales_amount + ?
                        WHERE id = ?
                    ")->execute([$paidAmount, $paidAmount, $shiftId]);
                } else {
                    $pdo->prepare("
                        UPDATE cash_drawer_shifts SET
                            other_sales_amount = other_sales_amount + ?,
                            total_sales_amount = total_sales_amount + ?
                        WHERE id = ?
                    ")->execute([$paidAmount, $paidAmount, $shiftId]);
                }
            }

            // 8. Audit Log
            Auth::logAudit(
                $userId,
                'CREATE_SALE',
                'Sales',
                $saleId,
                "Generated invoice #{$invoiceNumber} for Rs. " . number_format($grandTotal, 2) . " ({$paymentStatus})",
                $request->getClientIp()
            );

            Database::commit();

            Response::success([
                'sale_id'        => $saleId,
                'invoice_number' => $invoiceNumber,
                'grand_total'    => $grandTotal,
                'paid_amount'    => $paidAmount,
                'due_amount'     => $dueAmount,
                'payment_status' => $paymentStatus,
            ], "Invoice #{$invoiceNumber} created successfully!", 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            $msg = $e->getMessage();
            $statusCode = str_contains($msg, 'Insufficient stock') ? 400 : 500;
            Response::error($msg, $statusCode);
        }
    }

    /**
     * POST /api/sales/{id}/returns (ATOMIC SALES RETURN & REFUND TRANSACTION)
     */
    public function returns(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $saleId = (int)($params['id'] ?? 0);
        $userId = $session['userId'];

        $returnItems = $request->body('items', []);
        $rawRefund = strtoupper(trim((string)$request->body('refund_type', 'CASH_REFUND')));
        if ($rawRefund === 'CASH' || $rawRefund === 'CASH_REFUND') {
            $refundType = 'CASH_REFUND';
        } elseif ($rawRefund === 'CREDIT' || $rawRefund === 'LEDGER' || $rawRefund === 'LEDGER_ADJUSTMENT' || $rawRefund === 'STORE_CREDIT') {
            $refundType = 'LEDGER_ADJUSTMENT';
        } else {
            $refundType = 'MIXED';
        }
        $reason = trim((string)$request->body('reason', 'Customer return'));

        if (empty($returnItems) || !is_array($returnItems)) {
            Response::error('At least one item must be specified for return.', 400);
            return;
        }

        $pdo = Database::getConnection();

        $saleStmt = $pdo->prepare("SELECT * FROM sales WHERE id = ?");
        $saleStmt->execute([$saleId]);
        $sale = $saleStmt->fetch(PDO::FETCH_ASSOC);

        if (!$sale) {
            Response::error('Original sale invoice not found.', 404);
            return;
        }

        Database::beginTransaction();

        try {
            // Generate Return Number: RET-YYYYMMDD-XXXX
            $datePrefix = date('Ymd');
            $retCount = (int)$pdo->query("SELECT COUNT(*) FROM sales_returns WHERE return_number LIKE 'RET-{$datePrefix}-%'")->fetchColumn() + 1;
            $returnNumber = sprintf("RET-%s-%04d", $datePrefix, $retCount);

            $totalRefund = 0.00;
            $processedReturns = [];

            $itemStmt = $pdo->prepare("SELECT * FROM sale_items WHERE id = ? AND sale_id = ?");
            $prodStmt = $pdo->prepare("SELECT purchase_price, current_stock FROM products WHERE id = ?");

            foreach ($returnItems as $ri) {
                $saleItemId = (int)($ri['sale_item_id'] ?? 0);
                $productId = (int)($ri['product_id'] ?? 0);
                $returnQty = (float)($ri['quantity'] ?? 0);

                if ($returnQty <= 0) {
                    continue;
                }

                $originalItem = null;
                if ($saleItemId > 0) {
                    $itemStmt->execute([$saleItemId, $saleId]);
                    $originalItem = $itemStmt->fetch(PDO::FETCH_ASSOC);
                } elseif ($productId > 0) {
                    $itemByProd = $pdo->prepare("SELECT * FROM sale_items WHERE sale_id = ? AND product_id = ? LIMIT 1");
                    $itemByProd->execute([$saleId, $productId]);
                    $originalItem = $itemByProd->fetch(PDO::FETCH_ASSOC);
                    if ($originalItem) {
                        $saleItemId = (int)$originalItem['id'];
                    }
                }

                if (!$originalItem) {
                    throw new \Exception("Sale item #" . ($saleItemId ?: $productId) . " does not belong to invoice #{$sale['invoice_number']}.");
                }

                $maxReturnable = (float)$originalItem['quantity'] - (float)$originalItem['returned_quantity'];
                if ($returnQty > $maxReturnable) {
                    throw new \Exception("Cannot return {$returnQty} units. Maximum remaining returnable quantity is {$maxReturnable}.");
                }

                $unitPrice = (float)$originalItem['unit_price'];
                $lineRefund = round($returnQty * $unitPrice, 2);
                $totalRefund += $lineRefund;

                $prodStmt->execute([$originalItem['product_id']]);
                $prod = $prodStmt->fetch(PDO::FETCH_ASSOC);

                $processedReturns[] = [
                    'sale_item_id'      => $saleItemId,
                    'product_id'        => (int)$originalItem['product_id'],
                    'returned_quantity' => $returnQty,
                    'unit_price'        => $unitPrice,
                    'line_refund'       => $lineRefund,
                    'unit_cost'         => (float)($prod['purchase_price'] ?? 0),
                    'stock_before'      => (float)($prod['current_stock'] ?? 0),
                ];
            }

            $cashRefund = 0.00;
            $ledgerCredit = 0.00;

            if ($refundType === 'CASH_REFUND') {
                $cashRefund = $totalRefund;
            } elseif ($refundType === 'LEDGER_ADJUSTMENT') {
                $ledgerCredit = $totalRefund;
            } else {
                $cashRefund = (float)$request->body('cash_refund_amount', 0);
                $ledgerCredit = round($totalRefund - $cashRefund, 2);
            }

            // 1. Insert Sales Return Master
            $retInsert = $pdo->prepare("
                INSERT INTO sales_returns (
                    return_number, sale_id, customer_id, total_refund_amount, refund_type,
                    cash_refund_amount, ledger_credit_amount, reason, processed_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $retInsert->execute([
                $returnNumber, $saleId, $sale['customer_id'], $totalRefund, $refundType,
                $cashRefund, $ledgerCredit, $reason, $userId
            ]);
            $returnId = (int)$pdo->lastInsertId();

            // 2. Process Return Items & Restock
            $retItemInsert = $pdo->prepare("
                INSERT INTO sales_return_items (
                    return_id, sale_item_id, product_id, returned_quantity, unit_price, refund_line_total
                ) VALUES (?, ?, ?, ?, ?, ?)
            ");

            $updateSaleItem = $pdo->prepare("
                UPDATE sale_items SET returned_quantity = returned_quantity + ? WHERE id = ?
            ");

            $restockGlobal = $pdo->prepare("
                UPDATE products SET current_stock = current_stock + ? WHERE id = ?
            ");

            $restockBranch = $pdo->prepare("
                UPDATE branch_stocks SET current_stock = current_stock + ? WHERE branch_id = ? AND product_id = ?
            ");

            $invTxStmt = $pdo->prepare("
                INSERT INTO inventory_transactions (
                    product_id, transaction_type, reference_type, reference_id,
                    quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
                ) VALUES (?, 'SALE_RETURN', 'RETURN_NOTE', ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($processedReturns as $pr) {
                $retItemInsert->execute([
                    $returnId, $pr['sale_item_id'], $pr['product_id'], $pr['returned_quantity'],
                    $pr['unit_price'], $pr['line_refund']
                ]);

                $updateSaleItem->execute([$pr['returned_quantity'], $pr['sale_item_id']]);
                $restockGlobal->execute([$pr['returned_quantity'], $pr['product_id']]);
                $restockBranch->execute([$pr['returned_quantity'], $sale['branch_id'], $pr['product_id']]);

                // Restore batch layer
                InventoryBatchHelper::restoreStockForReturn(
                    $pdo,
                    $pr['product_id'],
                    (int)$sale['branch_id'],
                    $pr['returned_quantity'],
                    $returnId,
                    $pr['unit_cost']
                );

                $invTxStmt->execute([
                    $pr['product_id'],
                    $returnId,
                    $pr['returned_quantity'],
                    $pr['unit_cost'],
                    $pr['stock_before'],
                    $pr['stock_before'] + $pr['returned_quantity'],
                    "Sale return #{$returnNumber} on Invoice #{$sale['invoice_number']}",
                    $userId,
                    $sale['branch_id']
                ]);
            }

            // 3. Update Sale Net Total & Returned Amount
            $pdo->prepare("
                UPDATE sales SET 
                    returned_amount = returned_amount + ?,
                    net_total = grand_total - (returned_amount + ?)
                WHERE id = ?
            ")->execute([$totalRefund, $totalRefund, $saleId]);

            // 4. Update Customer Ledger Balance if Ledger Credit
            if ($ledgerCredit > 0) {
                $pdo->prepare("
                    UPDATE customers SET 
                        outstanding_balance = outstanding_balance - ?
                    WHERE id = ?
                ")->execute([$ledgerCredit, $sale['customer_id']]);
            }

            // 5. If Cash Refund and active shift, update drawer cash refunds
            if ($cashRefund > 0 && !empty($sale['shift_id'])) {
                $pdo->prepare("
                    UPDATE cash_drawer_shifts SET 
                        cash_refunds_amount = cash_refunds_amount + ?
                    WHERE id = ?
                ")->execute([$cashRefund, $sale['shift_id']]);
            }

            Auth::logAudit(
                $userId,
                'SALES_RETURN',
                'Sales',
                $saleId,
                "Processed return #{$returnNumber} for Rs. " . number_format($totalRefund, 2) . " on invoice #{$sale['invoice_number']}",
                $request->getClientIp()
            );

            Database::commit();

            Response::success([
                'return_id'           => $returnId,
                'return_number'       => $returnNumber,
                'total_refund_amount' => $totalRefund,
                'cash_refund_amount'  => $cashRefund,
                'ledger_credit'       => $ledgerCredit,
            ], "Return #{$returnNumber} processed successfully!", 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to process return: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/sales/{id}/payments (Khata Payment Settlement against Invoice)
     */
    public function payments(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $saleId = (int)($params['id'] ?? 0);
        $amount = (float)$request->body('amount', 0);
        $method = trim((string)$request->body('payment_method', 'Cash'));
        $reference = trim((string)$request->body('reference_no', ''));
        $notes = trim((string)$request->body('notes', ''));

        if ($amount <= 0) {
            Response::error('Payment amount must be greater than zero.', 400);
            return;
        }

        $pdo = Database::getConnection();

        $saleStmt = $pdo->prepare("SELECT * FROM sales WHERE id = ?");
        $saleStmt->execute([$saleId]);
        $sale = $saleStmt->fetch(PDO::FETCH_ASSOC);

        if (!$sale) {
            Response::error('Invoice not found.', 404);
            return;
        }

        $due = (float)$sale['due_amount'];
        if ($due <= 0) {
            Response::error('This invoice has already been fully paid.', 400);
            return;
        }

        Database::beginTransaction();

        try {
            $paymentAmount = min($amount, $due);
            $newPaid = (float)$sale['paid_amount'] + $paymentAmount;
            $newDue = (float)$sale['due_amount'] - $paymentAmount;
            $newStatus = ($newDue <= 0.01) ? 'PAID' : 'PARTIAL';

            // 1. Update Sale
            $pdo->prepare("
                UPDATE sales SET 
                    paid_amount = ?, due_amount = ?, payment_status = ?
                WHERE id = ?
            ")->execute([$newPaid, $newDue, $newStatus, $saleId]);

            // 2. Insert Customer Payment Log
            $pdo->prepare("
                INSERT INTO customer_payments (
                    customer_id, sale_id, amount, payment_method, reference_no, notes, received_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ")->execute([
                $sale['customer_id'], $saleId, $paymentAmount, $method,
                $reference ?: $sale['invoice_number'], $notes ?: "Settlement against invoice {$sale['invoice_number']}",
                $session['userId']
            ]);

            // 3. Update Customer Khata Ledger
            $pdo->prepare("
                UPDATE customers SET 
                    total_paid = total_paid + ?,
                    outstanding_balance = outstanding_balance - ?
                WHERE id = ?
            ")->execute([$paymentAmount, $paymentAmount, $sale['customer_id']]);

            Auth::logAudit(
                $session['userId'],
                'RECORD_PAYMENT',
                'Sales',
                $saleId,
                "Received Rs. " . number_format($paymentAmount, 2) . " against invoice #{$sale['invoice_number']}",
                $request->getClientIp()
            );

            Database::commit();

            Response::success([
                'sale_id'        => $saleId,
                'paid_amount'    => $newPaid,
                'due_amount'     => $newDue,
                'payment_status' => $newStatus,
            ], 'Payment recorded successfully');
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to record payment: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/sales/{id}/delivery (Partial/Full Goods Pickup/Fulfillment)
     */
    public function delivery(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $saleId = (int)($params['id'] ?? 0);
        $items = $request->body('items', []); // [{ sale_item_id, delivered_quantity }]
        $notes = trim((string)$request->body('notes', ''));

        if (empty($items) || !is_array($items)) {
            Response::error('Delivery items list is required.', 400);
            return;
        }

        $pdo = Database::getConnection();

        $saleStmt = $pdo->prepare("SELECT * FROM sales WHERE id = ?");
        $saleStmt->execute([$saleId]);
        $sale = $saleStmt->fetch(PDO::FETCH_ASSOC);

        if (!$sale) {
            Response::error('Sale invoice not found.', 404);
            return;
        }

        Database::beginTransaction();

        try {
            $itemStmt = $pdo->prepare("SELECT * FROM sale_items WHERE id = ? AND sale_id = ?");
            $updateItem = $pdo->prepare("
                UPDATE sale_items SET 
                    delivered_quantity = delivered_quantity + ?,
                    remaining_quantity = remaining_quantity - ?
                WHERE id = ?
            ");

            $logInsert = $pdo->prepare("
                INSERT INTO sale_delivery_logs (
                    sale_id, sale_item_id, delivered_quantity, total_delivered_after,
                    remaining_after, notes, recorded_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($items as $it) {
                $saleItemId = (int)$it['sale_item_id'];
                $delQty = (float)$it['delivered_quantity'];

                if ($delQty <= 0) {
                    continue;
                }

                $itemStmt->execute([$saleItemId, $saleId]);
                $item = $itemStmt->fetch(PDO::FETCH_ASSOC);

                if (!$item) {
                    throw new \Exception("Sale item #{$saleItemId} not found.");
                }

                $remaining = (float)($item['remaining_quantity'] ?? 0);
                if ($delQty > $remaining) {
                    throw new \Exception("Cannot deliver {$delQty} units. Only {$remaining} units remain pending.");
                }

                $newDelivered = (float)($item['delivered_quantity'] ?? 0) + $delQty;
                $newRemaining = $remaining - $delQty;

                $updateItem->execute([$delQty, $delQty, $saleItemId]);
                $logInsert->execute([
                    $saleId, $saleItemId, $delQty, $newDelivered, $newRemaining, $notes, $session['userId']
                ]);
            }

            // Check if any items still have remaining quantity
            $remainingCheck = $pdo->prepare("SELECT SUM(remaining_quantity) FROM sale_items WHERE sale_id = ?");
            $remainingCheck->execute([$saleId]);
            $totalRemaining = (float)$remainingCheck->fetchColumn();

            $newDeliveryStatus = ($totalRemaining <= 0) ? 'DELIVERED' : 'PARTIAL_DELIVERY';
            $pdo->prepare("UPDATE sales SET delivery_status = ? WHERE id = ?")->execute([$newDeliveryStatus, $saleId]);

            Auth::logAudit(
                $session['userId'],
                'DELIVERY_FULFILLMENT',
                'Sales',
                $saleId,
                "Recorded goods delivery for invoice #{$sale['invoice_number']} (Status: {$newDeliveryStatus})",
                $request->getClientIp()
            );

            Database::commit();

            Response::success([
                'sale_id'         => $saleId,
                'delivery_status' => $newDeliveryStatus,
                'remaining_total' => $totalRemaining,
            ], 'Delivery updated successfully');
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to update delivery: ' . $e->getMessage(), 500);
        }
    }

    /**
     * PATCH /api/sales/{id}/loading-fee
     */
    public function updateLoadingFee(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $saleId = (int)($params['id'] ?? 0);
        $newFee = max(0.0, round((float)$request->body('loading_fee', 0), 2));

        $pdo = Database::getConnection();
        $saleStmt = $pdo->prepare("SELECT * FROM sales WHERE id = ?");
        $saleStmt->execute([$saleId]);
        $sale = $saleStmt->fetch(PDO::FETCH_ASSOC);

        if (!$sale) {
            Response::error('Invoice not found.', 404);
            return;
        }

        $currentFee = (float)($sale['loading_fee'] ?? 0);
        $diff = $newFee - $currentFee;

        $newGrandTotal = max(0.0, round(((float)$sale['grand_total'] + $diff), 2));
        $newNetTotal = max(0.0, round(((float)($sale['net_total'] ?? $sale['grand_total']) + $diff), 2));
        $newOriginalTotal = max(0.0, round(((float)($sale['original_grand_total'] ?? $sale['grand_total']) + $diff), 2));
        $newDue = max(0.0, round(($newGrandTotal - (float)$sale['paid_amount']), 2));

        $newPaymentStatus = $sale['payment_status'];
        if ($newDue <= 0.01) {
            $newPaymentStatus = 'PAID';
        } elseif ((float)$sale['paid_amount'] > 0) {
            $newPaymentStatus = 'PARTIAL';
        } else {
            $newPaymentStatus = 'DUE';
        }

        Database::beginTransaction();

        try {
            $pdo->prepare("
                UPDATE sales
                SET loading_fee = ?,
                    grand_total = ?,
                    original_grand_total = ?,
                    net_total = ?,
                    due_amount = ?,
                    payment_status = ?
                WHERE id = ?
            ")->execute([$newFee, $newGrandTotal, $newOriginalTotal, $newNetTotal, $newDue, $newPaymentStatus, $saleId]);

            if (!empty($sale['customer_id'])) {
                $pdo->prepare("
                    UPDATE customers
                    SET total_purchases = total_purchases + ?,
                        outstanding_balance = outstanding_balance + ?
                    WHERE id = ?
                ")->execute([$diff, $diff, $sale['customer_id']]);
            }

            Database::commit();

            Response::success([
                'loading_fee'    => $newFee,
                'grand_total'    => $newGrandTotal,
                'net_total'      => $newNetTotal,
                'due_amount'     => $newDue,
                'payment_status' => $newPaymentStatus,
            ], 'Loading fee updated successfully.');
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to update loading fee: ' . $e->getMessage(), 500);
        }
    }
}
