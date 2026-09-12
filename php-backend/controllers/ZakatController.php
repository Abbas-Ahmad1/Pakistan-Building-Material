<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class ZakatController
{
    /**
     * GET /api/zakat/calculate (Shariah Wealth Calculation)
     */
    public function calculate(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $pdo = Database::getConnection();

        // 1. Inventory value at cost
        $invCost = (float)$pdo->query("
            SELECT COALESCE(SUM(current_stock * purchase_price), 0)
            FROM products WHERE status = 'active' AND current_stock > 0
        ")->fetchColumn();

        // 2. Active cash drawer cash
        $drawerCash = (float)$pdo->query("
            SELECT COALESCE(SUM(expected_closing_cash), 0)
            FROM cash_drawer_shifts WHERE status = 'OPEN'
        ")->fetchColumn();

        // 3. Trade receivables (recoverable customer credit)
        $receivables = (float)$pdo->query("
            SELECT COALESCE(SUM(outstanding_balance), 0)
            FROM customers WHERE outstanding_balance > 0
        ")->fetchColumn();

        // 4. Liabilities (supplier payables)
        $payables = (float)$pdo->query("
            SELECT COALESCE(SUM(payable_balance), 0)
            FROM suppliers WHERE payable_balance > 0
        ")->fetchColumn();

        // Default silver nisab benchmark (approx. 52.5 tolas / 612.36 grams)
        $silverRateGram = 260.00; // Benchmark PKR
        $nisabThreshold = round(612.36 * $silverRateGram, 2);

        $totalAssets = round($invCost + $drawerCash + $receivables, 2);
        $netZakatable = round(max(0.00, $totalAssets - $payables), 2);
        $isNisabMet = ($netZakatable >= $nisabThreshold);
        $zakatDue = $isNisabMet ? round($netZakatable * 0.025, 2) : 0.00;

        Response::success([
            'inventory_value'     => $invCost,
            'cash_in_hand'        => $drawerCash,
            'trade_receivables'   => $receivables,
            'total_assets'        => $totalAssets,
            'current_liabilities' => $payables,
            'net_zakatable_wealth'=> $netZakatable,
            'nisab_threshold'     => $nisabThreshold,
            'is_nisab_met'        => $isNisabMet,
            'zakat_rate_percent'  => 2.5,
            'zakat_due_amount'    => $zakatDue,
        ]);
    }

    /**
     * GET /api/zakat/records or /api/zakat/history
     */
    public function history(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $pdo = Database::getConnection();

        $stmt = $pdo->query("
            SELECT * FROM zakat_records 
            ORDER BY created_at DESC, id DESC
        ");
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($records);
    }

    /**
     * POST /api/zakat/save
     */
    public function save(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $fiscalYear = trim((string)($request->body('fiscal_year') ?: date('Y')));
        $invVal = (float)($request->body('inventory_value') ?? 0);
        $cashVal = (float)($request->body('cash_balance') ?? $request->body('cash_value') ?? 0);
        $bankVal = (float)($request->body('bank_balance') ?? 0);
        $receivables = (float)($request->body('receivables_value') ?? $request->body('receivables') ?? 0);
        $liabilities = (float)($request->body('liabilities_value') ?? $request->body('liabilities') ?? 0);
        $notes = trim((string)$request->body('notes', ''));

        $totalAssets = $invVal + $cashVal + $bankVal + $receivables;
        $netWealth = (float)($request->body('net_zakatable_amount') ?? $request->body('net_zakatable_wealth') ?? max(0.00, $totalAssets - $liabilities));
        $zakatRate = (float)($request->body('zakat_rate') ?? 2.50);
        $zakatAmount = (float)($request->body('calculated_zakat') ?? $request->body('zakat_amount') ?? round($netWealth * ($zakatRate / 100.0), 2));

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            INSERT INTO zakat_records (
                fiscal_year, cash_balance, bank_balance, inventory_value,
                receivables_value, liabilities_value, net_zakatable_amount,
                zakat_rate, calculated_zakat, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $fiscalYear, $cashVal, $bankVal, $invVal,
            $receivables, $liabilities, $netWealth,
            $zakatRate, $zakatAmount, $notes ?: null
        ]);
        $id = (int)$pdo->lastInsertId();

        Auth::logAudit($session['userId'], 'SAVE_ZAKAT_RECORD', 'Zakat', $id, "Saved zakat assessment: Rs. " . number_format($zakatAmount, 2), $request->getClientIp());

        Response::success([
            'id'                   => $id,
            'net_zakatable_amount' => $netWealth,
            'calculated_zakat'     => $zakatAmount,
            'zakat_amount'         => $zakatAmount,
        ], 'Zakat assessment saved successfully', 201);
    }

    /**
     * DELETE /api/zakat/records/{id}
     */
    public function destroy(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $pdo->prepare("DELETE FROM zakat_records WHERE id = ?")->execute([$id]);

        Response::success(null, 'Zakat record deleted successfully');
    }
}
