<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class SuppliersController
{
    /**
     * GET /api/suppliers
     */
    public function index(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $search = trim((string)$request->query('search', ''));
        $status = $request->query('status');

        $pdo = Database::getConnection();

        $query = "
            SELECT 
                s.*,
                (SELECT COUNT(*) FROM purchases WHERE supplier_id = s.id) as total_purchases_count,
                (SELECT COUNT(*) FROM products WHERE supplier_id = s.id) as products_supplied_count
            FROM suppliers s
            WHERE 1=1
        ";

        $bindings = [];

        if ($search !== '') {
            $query .= " AND (s.name LIKE :search OR s.company LIKE :search OR s.phone LIKE :search OR s.email LIKE :search)";
            $bindings[':search'] = "%{$search}%";
        }

        if ($status && $status !== 'all') {
            $query .= " AND s.status = :status";
            $bindings[':status'] = $status;
        }

        $query .= " ORDER BY s.payable_balance DESC, s.company ASC";

        $stmt = $pdo->prepare($query);
        $stmt->execute($bindings);
        $suppliers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($suppliers as &$s) {
            $s['id'] = (int)$s['id'];
            $s['total_purchases'] = (float)$s['total_purchases'];
            $s['paid_amount'] = (float)$s['paid_amount'];
            $s['payable_balance'] = (float)$s['payable_balance'];
            $s['total_purchases_count'] = (int)$s['total_purchases_count'];
            $s['products_supplied_count'] = (int)$s['products_supplied_count'];
        }

        // Summary aggregates
        $sumStmt = $pdo->query("
            SELECT 
                COUNT(*) as total_suppliers,
                COALESCE(SUM(payable_balance), 0) as total_payables,
                COALESCE(SUM(total_purchases), 0) as total_inward_purchases,
                COALESCE(SUM(paid_amount), 0) as total_disbursements
            FROM suppliers
        ");
        $summary = $sumStmt->fetch(PDO::FETCH_ASSOC);

        Response::success($suppliers, '', 200, ['summary' => $summary]);
    }

    /**
     * GET /api/suppliers/{id}
     */
    public function show(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM suppliers WHERE id = ?");
        $stmt->execute([$id]);
        $supplier = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$supplier) {
            Response::error('Supplier not found.', 404);
            return;
        }

        // Purchases history
        $pStmt = $pdo->prepare("
            SELECT id, purchase_number, purchase_date, grand_total, paid_amount, due_amount, payment_status
            FROM purchases
            WHERE supplier_id = ?
            ORDER BY purchase_date DESC, id DESC
            LIMIT 50
        ");
        $pStmt->execute([$id]);
        $supplier['purchases'] = $pStmt->fetchAll(PDO::FETCH_ASSOC);

        // Payments history
        $payStmt = $pdo->prepare("
            SELECT sp.*, u.name as paid_by_name
            FROM supplier_payments sp
            LEFT JOIN users u ON sp.paid_by = u.id
            WHERE sp.supplier_id = ?
            ORDER BY sp.payment_date DESC, sp.id DESC
            LIMIT 50
        ");
        $payStmt->execute([$id]);
        $supplier['payments'] = $payStmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($supplier);
    }

    /**
     * POST /api/suppliers
     */
    public function store(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $name = trim((string)$request->body('name', ''));
        $company = trim((string)$request->body('company', ''));
        $phone = trim((string)$request->body('phone', ''));
        $email = trim((string)$request->body('email', '')) ?: null;
        $address = trim((string)$request->body('address', '')) ?: null;
        $openingBalance = (float)$request->body('opening_balance', 0);

        if ($name === '' && $company === '') {
            Response::error('Supplier contact person or company name is required.', 400);
            return;
        }

        $displayName = $name !== '' ? $name : $company;
        $companyName = $company !== '' ? $company : $displayName;

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("
            INSERT INTO suppliers (name, company, phone, email, address, payable_balance, total_purchases)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$displayName, $companyName, $phone, $email, $address, $openingBalance, $openingBalance]);
        $id = (int)$pdo->lastInsertId();

        Auth::logAudit($session['userId'], 'CREATE_SUPPLIER', 'Suppliers', $id, "Added supplier: {$companyName}", $request->getClientIp());

        Response::success(['id' => $id, 'name' => $displayName, 'company' => $companyName], 'Supplier created successfully', 201);
    }

    /**
     * PUT /api/suppliers/{id}
     */
    public function update(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $existing = $pdo->prepare("SELECT * FROM suppliers WHERE id = ?");
        $existing->execute([$id]);
        $sup = $existing->fetch(PDO::FETCH_ASSOC);

        if (!$sup) {
            Response::error('Supplier not found.', 404);
            return;
        }

        $name = trim((string)$request->body('name', $sup['name']));
        $company = trim((string)$request->body('company', $sup['company']));
        $phone = trim((string)$request->body('phone', $sup['phone']));
        $email = trim((string)$request->body('email', (string)$sup['email'])) ?: null;
        $address = trim((string)$request->body('address', (string)$sup['address'])) ?: null;
        $status = $request->body('status', $sup['status']);

        $update = $pdo->prepare("
            UPDATE suppliers SET name = ?, company = ?, phone = ?, email = ?, address = ?, status = ?
            WHERE id = ?
        ");
        $update->execute([$name, $company, $phone, $email, $address, $status, $id]);

        Auth::logAudit($session['userId'], 'UPDATE_SUPPLIER', 'Suppliers', $id, "Updated supplier: {$company}", $request->getClientIp());

        Response::success(null, 'Supplier updated successfully');
    }

    /**
     * DELETE /api/suppliers/{id} (ADMIN only)
     */
    public function destroy(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();

        $pCheck = $pdo->prepare("SELECT COUNT(*) FROM purchases WHERE supplier_id = ?");
        $pCheck->execute([$id]);
        if ((int)$pCheck->fetchColumn() > 0) {
            Response::error('Cannot delete supplier with recorded purchase orders. You may mark them as INACTIVE.', 400);
            return;
        }

        $pdo->prepare("DELETE FROM suppliers WHERE id = ?")->execute([$id]);

        Auth::logAudit($session['userId'], 'DELETE_SUPPLIER', 'Suppliers', $id, "Deleted supplier ID: {$id}", $request->getClientIp());

        Response::success(null, 'Supplier deleted successfully');
    }

    /**
     * POST /api/suppliers/{id}/payments (Supplier Ledger Payment)
     */
    public function recordPayment(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);
        $amount = (float)$request->body('amount', 0);
        $method = trim((string)$request->body('payment_method', 'Bank Transfer'));
        $reference = trim((string)$request->body('reference_no', ''));
        $notes = trim((string)$request->body('notes', 'Supplier ledger disbursement'));

        if ($amount <= 0) {
            Response::error('Payment amount must be greater than zero.', 400);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM suppliers WHERE id = ?");
        $stmt->execute([$id]);
        $supplier = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$supplier) {
            Response::error('Supplier not found.', 404);
            return;
        }

        Database::beginTransaction();

        try {
            // 1. Insert supplier payment
            $ins = $pdo->prepare("
                INSERT INTO supplier_payments (
                    supplier_id, purchase_id, amount, payment_method, reference_no, notes, paid_by
                ) VALUES (?, NULL, ?, ?, ?, ?, ?)
            ");
            $ins->execute([$id, $amount, $method, $reference ?: null, $notes, $session['userId']]);
            $paymentId = (int)$pdo->lastInsertId();

            // 2. Update supplier ledger
            $upd = $pdo->prepare("
                UPDATE suppliers SET
                    paid_amount = paid_amount + ?,
                    payable_balance = payable_balance - ?
                WHERE id = ?
            ");
            $upd->execute([$amount, $amount, $id]);

            // 3. Auto-settle oldest unpaid purchases
            $unpaidStmt = $pdo->prepare("
                SELECT id, due_amount, paid_amount FROM purchases
                WHERE supplier_id = ? AND due_amount > 0
                ORDER BY purchase_date ASC, id ASC
            ");
            $unpaidStmt->execute([$id]);
            $unpaidPurchases = $unpaidStmt->fetchAll(PDO::FETCH_ASSOC);

            $rem = $amount;
            $updPurch = $pdo->prepare("UPDATE purchases SET paid_amount = ?, due_amount = ?, payment_status = ? WHERE id = ?");

            foreach ($unpaidPurchases as $po) {
                if ($rem <= 0) break;
                $poDue = (float)$po['due_amount'];
                $settle = min($rem, $poDue);
                $newPaid = (float)$po['paid_amount'] + $settle;
                $newDue = $poDue - $settle;
                $newStatus = ($newDue <= 0.01) ? 'PAID' : 'PARTIAL';

                $updPurch->execute([$newPaid, $newDue, $newStatus, $po['id']]);
                $rem -= $settle;
            }

            Auth::logAudit(
                $session['userId'],
                'SUPPLIER_PAYMENT',
                'Suppliers',
                $id,
                "Disbursed Rs. " . number_format($amount, 2) . " to {$supplier['company']} via {$method}",
                $request->getClientIp()
            );

            Database::commit();

            Response::success([
                'payment_id'      => $paymentId,
                'supplier_id'     => $id,
                'amount'          => $amount,
                'new_balance'     => (float)$supplier['payable_balance'] - $amount,
            ], 'Supplier payment recorded successfully', 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to record supplier payment: ' . $e->getMessage(), 500);
        }
    }
}
