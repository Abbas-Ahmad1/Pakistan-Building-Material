<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class ExpensesController
{
    /**
     * GET /api/expenses
     */
    public function index(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);

        $search = trim((string)$request->query('search', ''));
        $category = $request->query('category');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $pdo = Database::getConnection();

        $query = "
            SELECT 
                e.*,
                u.name as recorded_by_name
            FROM expenses e
            LEFT JOIN users u ON e.recorded_by = u.id
            WHERE 1=1
        ";

        $bindings = [];

        if ($search !== '') {
            $query .= " AND (e.title LIKE :search OR e.description LIKE :search)";
            $bindings[':search'] = "%{$search}%";
        }

        if ($category && $category !== 'all') {
            $query .= " AND e.category = :category";
            $bindings[':category'] = $category;
        }

        if ($dateFrom) {
            $query .= " AND DATE(e.expense_date) >= :d_from";
            $bindings[':d_from'] = $dateFrom;
        }

        if ($dateTo) {
            $query .= " AND DATE(e.expense_date) <= :d_to";
            $bindings[':d_to'] = $dateTo;
        }

        $query .= " ORDER BY e.expense_date DESC, e.id DESC LIMIT 100";

        $stmt = $pdo->prepare($query);
        $stmt->execute($bindings);
        $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($expenses as &$e) {
            $e['id'] = (int)$e['id'];
            $e['amount'] = (float)$e['amount'];
        }

        // Summary calculation
        $sumStmt = $pdo->query("SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as count FROM expenses");
        $summary = $sumStmt->fetch(PDO::FETCH_ASSOC);

        Response::success($expenses, '', 200, ['summary' => $summary]);
    }

    /**
     * GET /api/expenses/categories
     */
    public function categories(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $pdo = Database::getConnection();

        $cats = $pdo->query("
            SELECT DISTINCT category FROM expenses WHERE category IS NOT NULL AND category != ''
            UNION
            SELECT DISTINCT category FROM drawer_expenses WHERE category IS NOT NULL AND category != ''
            ORDER BY category ASC
        ")->fetchAll(PDO::FETCH_COLUMN);

        if (empty($cats)) {
            $cats = ['Electricity', 'Shop Rent', 'Salaries', 'Tea & Refreshments', 'Maintenance', 'Transportation', 'Labor/Mazdoori', 'Miscellaneous'];
        }

        Response::success($cats);
    }

    /**
     * POST /api/expenses
     */
    public function store(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);

        $title = trim((string)$request->body('title', ''));
        $category = trim((string)$request->body('category', 'Miscellaneous'));
        $amount = (float)$request->body('amount', 0);
        $expenseDate = $request->body('expense_date') ?: date('Y-m-d H:i:s');
        $paymentMethod = trim((string)$request->body('payment_method', 'Cash'));
        $description = trim((string)$request->body('description', '')) ?: null;

        if ($title === '' || $amount <= 0) {
            Response::error('Title and a valid positive amount are required.', 400);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            INSERT INTO expenses (title, category, amount, expense_date, payment_method, description, recorded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$title, $category, $amount, $expenseDate, $paymentMethod, $description, $session['userId']]);
        $id = (int)$pdo->lastInsertId();

        Auth::logAudit($session['userId'], 'CREATE_EXPENSE', 'Expenses', $id, "Recorded expense: {$title} (Rs. " . number_format($amount, 2) . ")", $request->getClientIp());

        Response::success(['id' => $id, 'title' => $title, 'amount' => $amount], 'Expense recorded successfully', 201);
    }

    /**
     * DELETE /api/expenses/{id} (ADMIN only)
     */
    public function destroy(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $pdo->prepare("DELETE FROM expenses WHERE id = ?")->execute([$id]);

        Auth::logAudit($session['userId'], 'DELETE_EXPENSE', 'Expenses', $id, "Deleted expense ID: {$id}", $request->getClientIp());

        Response::success(null, 'Expense deleted successfully');
    }
}
