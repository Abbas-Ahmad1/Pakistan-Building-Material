<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class SettingsController
{
    /**
     * GET /api/settings
     */
    public function index(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $pdo = Database::getConnection();

        $rows = $pdo->query("SELECT `key`, `value` FROM settings")->fetchAll(PDO::FETCH_ASSOC);

        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['key']] = $row['value'];
        }

        Response::success($settings);
    }

    /**
     * POST /api/settings (ADMIN only)
     */
    public function update(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $data = $request->body();
        if (empty($data) || !is_array($data)) {
            Response::error('Settings data must be an object of key-value pairs.', 400);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            INSERT INTO settings (`key`, `value`)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = NOW()
        ");

        foreach ($data as $key => $val) {
            $strVal = is_bool($val) ? ($val ? 'true' : 'false') : (string)$val;
            $stmt->execute([$key, $strVal]);
        }

        Auth::logAudit($session['userId'], 'UPDATE_SETTINGS', 'Settings', null, "Updated store settings", $request->getClientIp());

        Response::success(null, 'Settings updated successfully');
    }
}
