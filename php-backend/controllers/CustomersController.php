<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class CustomersController
{
    /**
     * GET /api/customers
     */
    public function index(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $search = trim((string)$request->query('search', ''));
        $balanceFilter = $request->query('balance_filter'); // 'due', 'clear', 'all'

        $pdo = Database::getConnection();

        $query = "
            SELECT 
                c.*,
                (SELECT COUNT(*) FROM sales WHERE customer_id = c.id) as total_invoices_count,
                (SELECT MAX(sale_date) FROM sales WHERE customer_id = c.id) as last_purchase_date
            FROM customers c
            WHERE 1=1
        ";

        $bindings = [];

        if ($search !== '') {
            $query .= " AND (c.name LIKE :search OR c.phone LIKE :search OR c.email LIKE :search OR c.address LIKE :search)";
            $bindings[':search'] = "%{$search}%";
        }

        if ($balanceFilter === 'due') {
            $query .= " AND c.outstanding_balance > 0";
        } elseif ($balanceFilter === 'clear') {
            $query .= " AND c.outstanding_balance <= 0";
        }

        $query .= " ORDER BY c.outstanding_balance DESC, c.name ASC";

        $stmt = $pdo->prepare($query);
        $stmt->execute($bindings);
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($customers as &$c) {
            $c['id'] = (int)$c['id'];
            $c['credit_limit'] = (float)$c['credit_limit'];
            $c['total_purchases'] = (float)$c['total_purchases'];
            $c['total_paid'] = (float)$c['total_paid'];
            $c['outstanding_balance'] = (float)$c['outstanding_balance'];
            $c['is_walk_in'] = (int)$c['is_walk_in'];
            $c['total_invoices_count'] = (int)$c['total_invoices_count'];
        }

        // Summary aggregates
        $sumStmt = $pdo->query("
            SELECT 
                COUNT(*) as total_customers,
                COALESCE(SUM(outstanding_balance), 0) as total_receivables,
                COALESCE(SUM(total_purchases), 0) as total_all_purchases,
                COALESCE(SUM(total_paid), 0) as total_all_paid
            FROM customers
        ");
        $summary = $sumStmt->fetch(PDO::FETCH_ASSOC);

        Response::success($customers, '', 200, ['summary' => $summary]);
    }

    /**
     * GET /api/customers/{id}
     */
    public function show(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM customers WHERE id = ?");
        $stmt->execute([$id]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$customer) {
            Response::error('Customer not found.', 404);
            return;
        }

        $customer['id'] = (int)$customer['id'];
        $customer['credit_limit'] = (float)$customer['credit_limit'];
        $customer['total_purchases'] = (float)$customer['total_purchases'];
        $customer['total_paid'] = (float)$customer['total_paid'];
        $customer['outstanding_balance'] = (float)$customer['outstanding_balance'];
        $customer['is_walk_in'] = (int)$customer['is_walk_in'];

        // Invoices history
        $salesStmt = $pdo->prepare("
            SELECT id, invoice_number, sale_date, grand_total, paid_amount, due_amount, payment_status, payment_method
            FROM sales
            WHERE customer_id = ?
            ORDER BY sale_date DESC, id DESC
            LIMIT 50
        ");
        $salesStmt->execute([$id]);
        $customer['invoices'] = $salesStmt->fetchAll(PDO::FETCH_ASSOC);

        // Payments history
        $payStmt = $pdo->prepare("
            SELECT cp.*, u.name as received_by_name
            FROM customer_payments cp
            LEFT JOIN users u ON cp.received_by = u.id
            WHERE cp.customer_id = ?
            ORDER BY cp.payment_date DESC, cp.id DESC
            LIMIT 50
        ");
        $payStmt->execute([$id]);
        $customer['payments'] = $payStmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($customer);
    }

    /**
     * POST /api/customers
     */
    public function store(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);

        $name = trim((string)$request->body('name', ''));
        $phone = trim((string)$request->body('phone', '')) ?: null;
        $email = trim((string)$request->body('email', '')) ?: null;
        $address = trim((string)$request->body('address', '')) ?: null;
        $creditLimit = (float)$request->body('credit_limit', 0);
        $openingBalance = (float)$request->body('opening_balance', 0);

        if ($name === '') {
            Response::error('Customer name is required.', 400);
            return;
        }

        $pdo = Database::getConnection();

        if ($phone) {
            $exist = $pdo->prepare("SELECT id FROM customers WHERE phone = ?");
            $exist->execute([$phone]);
            if ($exist->fetch()) {
                Response::error('A customer with this phone number already exists.', 400);
                return;
            }
        }

        $stmt = $pdo->prepare("
            INSERT INTO customers (name, phone, email, address, credit_limit, outstanding_balance, total_purchases)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$name, $phone, $email, $address, $creditLimit, $openingBalance, $openingBalance]);
        $id = (int)$pdo->lastInsertId();

        Auth::logAudit($session['userId'], 'CREATE_CUSTOMER', 'Customers', $id, "Created customer: {$name}", $request->getClientIp());

        Response::success(['id' => $id, 'name' => $name], 'Customer created successfully', 201);
    }

    /**
     * PUT /api/customers/{id}
     */
    public function update(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $existing = $pdo->prepare("SELECT * FROM customers WHERE id = ?");
        $existing->execute([$id]);
        $cust = $existing->fetch(PDO::FETCH_ASSOC);

        if (!$cust) {
            Response::error('Customer not found.', 404);
            return;
        }

        $name = trim((string)$request->body('name', $cust['name']));
        $phone = trim((string)$request->body('phone', (string)$cust['phone'])) ?: null;
        $email = trim((string)$request->body('email', (string)$cust['email'])) ?: null;
        $address = trim((string)$request->body('address', (string)$cust['address'])) ?: null;
        $creditLimit = (float)$request->body('credit_limit', $cust['credit_limit']);

        if ($phone) {
            $check = $pdo->prepare("SELECT id FROM customers WHERE phone = ? AND id != ?");
            $check->execute([$phone, $id]);
            if ($check->fetch()) {
                Response::error('Another customer with this phone number already exists.', 400);
                return;
            }
        }

        $update = $pdo->prepare("
            UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, credit_limit = ?
            WHERE id = ?
        ");
        $update->execute([$name, $phone, $email, $address, $creditLimit, $id]);

        Auth::logAudit($session['userId'], 'UPDATE_CUSTOMER', 'Customers', $id, "Updated customer details: {$name}", $request->getClientIp());

        Response::success(null, 'Customer updated successfully');
    }

    /**
     * DELETE /api/customers/{id} (ADMIN only)
     */
    public function destroy(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();

        $salesCheck = $pdo->prepare("SELECT COUNT(*) FROM sales WHERE customer_id = ?");
        $salesCheck->execute([$id]);
        if ((int)$salesCheck->fetchColumn() > 0) {
            Response::error('Cannot delete customer with existing sales history. You can update their profile instead.', 400);
            return;
        }

        $pdo->prepare("DELETE FROM customer_payments WHERE customer_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM customers WHERE id = ?")->execute([$id]);

        Auth::logAudit($session['userId'], 'DELETE_CUSTOMER', 'Customers', $id, "Deleted customer ID: {$id}", $request->getClientIp());

        Response::success(null, 'Customer deleted successfully');
    }

    /**
     * POST /api/customers/{id}/payments (Khata Ledger Settlement)
     */
    public function recordPayment(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);
        $amount = (float)$request->body('amount', 0);
        $method = trim((string)$request->body('payment_method', 'Cash'));
        $reference = trim((string)$request->body('reference_no', ''));
        $notes = trim((string)$request->body('notes', 'Khata settlement'));

        if ($amount <= 0) {
            Response::error('Payment amount must be greater than zero.', 400);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM customers WHERE id = ?");
        $stmt->execute([$id]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$customer) {
            Response::error('Customer not found.', 404);
            return;
        }

        Database::beginTransaction();

        try {
            // 1. Insert customer payment
            $ins = $pdo->prepare("
                INSERT INTO customer_payments (
                    customer_id, sale_id, amount, payment_method, reference_no, notes, received_by
                ) VALUES (?, NULL, ?, ?, ?, ?, ?)
            ");
            $ins->execute([$id, $amount, $method, $reference ?: null, $notes, $session['userId']]);
            $paymentId = (int)$pdo->lastInsertId();

            // 2. Update customer ledger
            $upd = $pdo->prepare("
                UPDATE customers SET
                    total_paid = total_paid + ?,
                    outstanding_balance = outstanding_balance - ?
                WHERE id = ?
            ");
            $upd->execute([$amount, $amount, $id]);

            // 3. FIFO auto-settle unpaid invoices for this customer
            $unpaidStmt = $pdo->prepare("
                SELECT id, due_amount, paid_amount FROM sales
                WHERE customer_id = ? AND due_amount > 0
                ORDER BY sale_date ASC, id ASC
            ");
            $unpaidStmt->execute([$id]);
            $unpaidInvoices = $unpaidStmt->fetchAll(PDO::FETCH_ASSOC);

            $remainingSettlement = $amount;
            $updateSaleStmt = $pdo->prepare("
                UPDATE sales SET paid_amount = ?, due_amount = ?, payment_status = ? WHERE id = ?
            ");

            foreach ($unpaidInvoices as $inv) {
                if ($remainingSettlement <= 0) {
                    break;
                }

                $invDue = (float)$inv['due_amount'];
                $settle = min($remainingSettlement, $invDue);

                $newPaid = (float)$inv['paid_amount'] + $settle;
                $newDue = $invDue - $settle;
                $newStatus = ($newDue <= 0.01) ? 'PAID' : 'PARTIAL';

                $updateSaleStmt->execute([$newPaid, $newDue, $newStatus, $inv['id']]);
                $remainingSettlement -= $settle;
            }

            Auth::logAudit(
                $session['userId'],
                'CUSTOMER_KHATA_PAYMENT',
                'Customers',
                $id,
                "Received Rs. " . number_format($amount, 2) . " from {$customer['name']} via {$method}",
                $request->getClientIp()
            );

            Database::commit();

            Response::success([
                'payment_id'          => $paymentId,
                'customer_id'         => $id,
                'amount'              => $amount,
                'new_balance'         => (float)$customer['outstanding_balance'] - $amount,
            ], 'Khata payment recorded and invoices settled successfully!', 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to record customer payment: ' . $e->getMessage(), 500);
        }
    }
}
