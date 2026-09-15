<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class CashDrawerController
{
    /**
     * GET /api/cash-drawer/status
     */
    public function status(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $cashierId = $session['userId'];
        $branchId = (int)($request->query('branch_id') ?: $session['branchId']);

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("
            SELECT * FROM cash_drawer_shifts
            WHERE status = 'OPEN' AND branch_id = ? AND cashier_id = ?
            ORDER BY opened_at DESC, id DESC
            LIMIT 1
        ");
        $stmt->execute([$branchId, $cashierId]);
        $shift = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$shift) {
            // Check if there's any other open shift for this branch (e.g. for admin oversight)
            if ($session['role'] === 'ADMIN') {
                $anyStmt = $pdo->prepare("
                    SELECT * FROM cash_drawer_shifts
                    WHERE status = 'OPEN' AND branch_id = ?
                    ORDER BY opened_at DESC, id DESC LIMIT 1
                ");
                $anyStmt->execute([$branchId]);
                $shift = $anyStmt->fetch(PDO::FETCH_ASSOC);
            }
        }

        if (!$shift) {
            Response::success([
                'is_open' => false,
                'shift'   => null,
            ]);
            return;
        }

        $shiftId = (int)$shift['id'];

        // Live calculation of cash sales from sales table
        $cashSalesStmt = $pdo->prepare("
            SELECT 
                COALESCE(SUM(paid_amount), 0) as cash_total,
                COUNT(*) as cash_transactions_count
            FROM sales
            WHERE shift_id = ? AND payment_method = 'Cash'
        ");
        $cashSalesStmt->execute([$shiftId]);
        $cashSalesData = $cashSalesStmt->fetch(PDO::FETCH_ASSOC);
        $liveCashSales = (float)$cashSalesData['cash_total'];

        // Non-cash sales (Card, Bank, Khata)
        $otherSalesStmt = $pdo->prepare("
            SELECT 
                COALESCE(SUM(paid_amount), 0) as other_total,
                COUNT(*) as other_transactions_count
            FROM sales
            WHERE shift_id = ? AND payment_method != 'Cash'
        ");
        $otherSalesStmt->execute([$shiftId]);
        $otherSalesData = $otherSalesStmt->fetch(PDO::FETCH_ASSOC);
        $liveOtherSales = (float)$otherSalesData['other_total'];

        // Drawer petty expenses
        $expStmt = $pdo->prepare("
            SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as count
            FROM drawer_expenses
            WHERE shift_id = ?
        ");
        $expStmt->execute([$shiftId]);
        $expData = $expStmt->fetch(PDO::FETCH_ASSOC);
        $liveExpenses = (float)$expData['total_expenses'];

        // Cash refunds
        $refStmt = $pdo->prepare("
            SELECT COALESCE(SUM(sr.cash_refund_amount), 0) as total_refunds
            FROM sales_returns sr
            INNER JOIN sales s ON sr.sale_id = s.id
            WHERE s.shift_id = ?
        ");
        $refStmt->execute([$shiftId]);
        $liveRefunds = (float)$refStmt->fetchColumn();

        $openingFloat = (float)$shift['opening_balance'];
        $expectedCash = round($openingFloat + $liveCashSales - $liveRefunds - $liveExpenses, 2);

        // Fetch recent drawer expenses
        $recExpStmt = $pdo->prepare("
            SELECT * FROM drawer_expenses WHERE shift_id = ? ORDER BY id DESC LIMIT 10
        ");
        $recExpStmt->execute([$shiftId]);
        $expenses = $recExpStmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success([
            'is_open' => true,
            'shift'   => [
                'id'                     => $shiftId,
                'shift_code'             => $shift['shift_code'],
                'cashier_name'           => $shift['cashier_name'],
                'opened_at'              => $shift['opened_at'],
                'opening_balance'        => $openingFloat,
                'cash_sales_amount'      => $liveCashSales,
                'other_sales_amount'     => $liveOtherSales,
                'total_sales_amount'     => $liveCashSales + $liveOtherSales,
                'cash_refunds_amount'    => $liveRefunds,
                'drawer_expenses_amount' => $liveExpenses,
                'expected_closing_cash'  => $expectedCash,
                'expenses_list'          => $expenses,
            ],
        ]);
    }

    /**
     * POST /api/cash-drawer/open
     */
    public function open(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $cashierId = $session['userId'];
        $branchId = (int)($request->body('branch_id') ?: $session['branchId']);
        $openingFloat = (float)$request->body('opening_balance', 0);

        if ($openingFloat < 0) {
            Response::error('Opening balance cannot be negative.', 400);
            return;
        }

        $pdo = Database::getConnection();

        // Check if there is already an open shift for this cashier
        $exist = $pdo->prepare("SELECT id, shift_code FROM cash_drawer_shifts WHERE status = 'OPEN' AND cashier_id = ? AND branch_id = ?");
        $exist->execute([$cashierId, $branchId]);
        $existingShift = $exist->fetch(PDO::FETCH_ASSOC);

        if ($existingShift) {
            Response::error("You already have an open shift ({$existingShift['shift_code']}). Please close it first.", 400);
            return;
        }

        $datePrefix = date('Ymd');
        $shiftCount = (int)$pdo->query("SELECT COUNT(*) FROM cash_drawer_shifts WHERE shift_code LIKE 'SHIFT-{$datePrefix}-%'")->fetchColumn() + 1;
        $shiftCode = sprintf("SHIFT-%s-%03d", $datePrefix, $shiftCount);

        $stmt = $pdo->prepare("
            INSERT INTO cash_drawer_shifts (
                shift_code, branch_id, cashier_id, cashier_name, opened_at, status, opening_balance
            ) VALUES (?, ?, ?, ?, NOW(), 'OPEN', ?)
        ");
        $stmt->execute([$shiftCode, $branchId, $cashierId, $session['name'], $openingFloat]);
        $shiftId = (int)$pdo->lastInsertId();

        Auth::logAudit(
            $cashierId,
            'OPEN_DRAWER_SHIFT',
            'CashDrawer',
            $shiftId,
            "Opened cash drawer {$shiftCode} with float Rs. " . number_format($openingFloat, 2),
            $request->getClientIp()
        );

        Response::success([
            'shift_id'        => $shiftId,
            'shift_code'      => $shiftCode,
            'opening_balance' => $openingFloat,
        ], "Shift {$shiftCode} opened successfully!");
    }

    /**
     * POST /api/cash-drawer/expense (Petty Cash Payout)
     */
    public function expense(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $amount = (float)$request->body('amount', 0);
        $category = trim((string)$request->body('category', 'Miscellaneous'));
        $note = trim((string)($request->body('note') ?? $request->body('notes') ?? $request->body('title') ?? $request->body('description') ?? ''));
        $paidTo = trim((string)$request->body('paid_to', '')) ?: null;
        $shiftId = (int)$request->body('shift_id', 0);

        if ($amount <= 0) {
            Response::error('Expense amount must be greater than zero.', 400);
            return;
        }

        if ($note === '') {
            Response::error('A reason or description for the petty cash expense is required.', 400);
            return;
        }

        $pdo = Database::getConnection();

        if ($shiftId <= 0) {
            $shiftQuery = $pdo->prepare("
                SELECT id FROM cash_drawer_shifts 
                WHERE status = 'OPEN' AND (cashier_id = ? OR branch_id = ?)
                ORDER BY id DESC LIMIT 1
            ");
            $shiftQuery->execute([$session['userId'], $session['branchId']]);
            $shiftId = (int)$shiftQuery->fetchColumn();
        }

        if ($shiftId <= 0) {
            Response::error('No active cash drawer shift found. Please open a shift first.', 400);
            return;
        }

        Database::beginTransaction();

        try {
            $ins = $pdo->prepare("
                INSERT INTO drawer_expenses (
                    shift_id, branch_id, cashier_id, cashier_name, category, amount, note, paid_to
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $ins->execute([
                $shiftId, $session['branchId'], $session['userId'], $session['name'],
                $category, $amount, $note, $paidTo
            ]);
            $expenseId = (int)$pdo->lastInsertId();

            // Update drawer shift running total
            $pdo->prepare("
                UPDATE cash_drawer_shifts SET drawer_expenses_amount = drawer_expenses_amount + ? WHERE id = ?
            ")->execute([$amount, $shiftId]);

            // Also mirror into main expenses table so financial reports capture it
            $pdo->prepare("
                INSERT INTO expenses (title, category, amount, expense_date, payment_method, description, recorded_by)
                VALUES (?, ?, ?, NOW(), 'Cash', ?, ?)
            ")->execute([
                "Petty Cash: {$note}", $category, $amount, "From Drawer Shift #{$shiftId} (Paid to: " . ($paidTo ?: 'N/A') . ")", $session['userId']
            ]);

            Auth::logAudit(
                $session['userId'],
                'DRAWER_EXPENSE',
                'CashDrawer',
                $expenseId,
                "Paid out Rs. " . number_format($amount, 2) . " from drawer ({$category}: {$note})",
                $request->getClientIp()
            );

            Database::commit();

            Response::success([
                'expense_id' => $expenseId,
                'shift_id'   => $shiftId,
                'amount'     => $amount,
            ], 'Petty cash expense recorded successfully', 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            error_log("Failed to record drawer expense: " . $e->getMessage());
            Response::error('Unable to record drawer expense. Please try again.', 400);
        }
    }

    /**
     * POST /api/cash-drawer/close (Close Shift & Generate Z-Report)
     */
    public function close(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $shiftId = (int)$request->body('shift_id', 0);
        $actualClosingCash = (float)$request->body('actual_closing_cash', 0);
        $closingNotes = trim((string)$request->body('closing_notes', ''));

        $pdo = Database::getConnection();

        if ($shiftId <= 0) {
            $shiftQuery = $pdo->prepare("
                SELECT id FROM cash_drawer_shifts 
                WHERE status = 'OPEN' AND cashier_id = ? 
                ORDER BY id DESC LIMIT 1
            ");
            $shiftQuery->execute([$session['userId']]);
            $shiftId = (int)$shiftQuery->fetchColumn();
        }

        $stmt = $pdo->prepare("SELECT * FROM cash_drawer_shifts WHERE id = ?");
        $stmt->execute([$shiftId]);
        $shift = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$shift || $shift['status'] !== 'OPEN') {
            Response::error('Active shift not found or already closed.', 404);
            return;
        }

        Database::beginTransaction();

        try {
            // Aggregate final cash sales
            $csStmt = $pdo->prepare("SELECT COALESCE(SUM(paid_amount), 0) FROM sales WHERE shift_id = ? AND payment_method = 'Cash'");
            $csStmt->execute([$shiftId]);
            $finalCashSales = (float)$csStmt->fetchColumn();

            // Non-cash sales
            $osStmt = $pdo->prepare("SELECT COALESCE(SUM(paid_amount), 0) FROM sales WHERE shift_id = ? AND payment_method != 'Cash'");
            $osStmt->execute([$shiftId]);
            $finalOtherSales = (float)$osStmt->fetchColumn();

            // Cash refunds
            $rfStmt = $pdo->prepare("
                SELECT COALESCE(SUM(sr.cash_refund_amount), 0)
                FROM sales_returns sr
                INNER JOIN sales s ON sr.sale_id = s.id
                WHERE s.shift_id = ?
            ");
            $rfStmt->execute([$shiftId]);
            $finalRefunds = (float)$rfStmt->fetchColumn();

            // Drawer expenses
            $expStmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM drawer_expenses WHERE shift_id = ?");
            $expStmt->execute([$shiftId]);
            $finalExpenses = (float)$expStmt->fetchColumn();

            $opening = (float)$shift['opening_balance'];
            $expectedCash = round($opening + $finalCashSales - $finalRefunds - $finalExpenses, 2);
            $difference = round($actualClosingCash - $expectedCash, 2);

            $update = $pdo->prepare("
                UPDATE cash_drawer_shifts SET
                    closed_at = NOW(),
                    status = 'CLOSED',
                    cash_sales_amount = ?,
                    other_sales_amount = ?,
                    total_sales_amount = ?,
                    cash_refunds_amount = ?,
                    drawer_expenses_amount = ?,
                    expected_closing_cash = ?,
                    actual_closing_cash = ?,
                    cash_difference = ?,
                    closing_notes = ?
                WHERE id = ?
            ");

            $update->execute([
                $finalCashSales, $finalOtherSales, $finalCashSales + $finalOtherSales,
                $finalRefunds, $finalExpenses, $expectedCash, $actualClosingCash,
                $difference, $closingNotes ?: null, $shiftId
            ]);

            Auth::logAudit(
                $session['userId'],
                'CLOSE_DRAWER_SHIFT',
                'CashDrawer',
                $shiftId,
                "Closed shift {$shift['shift_code']} (Expected: Rs. {$expectedCash}, Actual: Rs. {$actualClosingCash}, Diff: Rs. {$difference})",
                $request->getClientIp()
            );

            Database::commit();

            Response::success([
                'shift_id'              => $shiftId,
                'shift_code'            => $shift['shift_code'],
                'opening_balance'       => $opening,
                'cash_sales_amount'     => $finalCashSales,
                'other_sales_amount'    => $finalOtherSales,
                'total_sales'           => $finalCashSales + $finalOtherSales,
                'cash_refunds_amount'   => $finalRefunds,
                'drawer_expenses_amount'=> $finalExpenses,
                'expected_closing_cash' => $expectedCash,
                'actual_closing_cash'   => $actualClosingCash,
                'cash_difference'       => $difference,
            ], "Shift {$shift['shift_code']} closed successfully. Z-Report generated!");
        } catch (\Throwable $e) {
            Database::rollBack();
            error_log("Failed to close cash drawer: " . $e->getMessage());
            Response::error('Unable to close cash drawer. Please check values and try again.', 400);
        }
    }

    /**
     * GET /api/cash-drawer/shifts (Past Shifts History)
     */
    public function shifts(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $branchId = $request->query('branch_id');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $pdo = Database::getConnection();

        $query = "
            SELECT 
                cds.*,
                b.name as branch_name,
                u.name as cashier_name
            FROM cash_drawer_shifts cds
            LEFT JOIN branches b ON cds.branch_id = b.id
            LEFT JOIN users u ON cds.cashier_id = u.id
            WHERE 1=1
        ";

        $bindings = [];

        if ($branchId && $branchId !== 'all') {
            $query .= " AND cds.branch_id = :b_id";
            $bindings[':b_id'] = (int)$branchId;
        }

        if ($dateFrom) {
            $query .= " AND DATE(cds.opened_at) >= :d_from";
            $bindings[':d_from'] = $dateFrom;
        }

        if ($dateTo) {
            $query .= " AND DATE(cds.opened_at) <= :d_to";
            $bindings[':d_to'] = $dateTo;
        }

        $query .= " ORDER BY cds.opened_at DESC, cds.id DESC LIMIT 100";

        $stmt = $pdo->prepare($query);
        $stmt->execute($bindings);
        $shifts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($shifts);
    }
}
