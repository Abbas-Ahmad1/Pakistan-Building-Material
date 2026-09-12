<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class AuditLogsController
{
    /**
     * GET /api/audit-logs
     */
    public function index(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $module = $request->query('module');
        $action = $request->query('action');
        $search = trim((string)$request->query('search', ''));
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $limit = (int)($request->query('limit', 100));
        $offset = (int)($request->query('offset', 0));

        $pdo = Database::getConnection();

        $query = "
            SELECT 
                al.*,
                u.name as user_name,
                u.username,
                r.name as user_role
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE 1=1
        ";

        $bindings = [];

        if ($module && $module !== 'all') {
            $query .= " AND al.module = :module";
            $bindings[':module'] = $module;
        }

        if ($action && $action !== 'all') {
            $query .= " AND al.action = :action";
            $bindings[':action'] = $action;
        }

        if ($search !== '') {
            $query .= " AND (al.details LIKE :search OR u.name LIKE :search OR al.action LIKE :search)";
            $bindings[':search'] = "%{$search}%";
        }

        if ($dateFrom) {
            $query .= " AND DATE(al.created_at) >= :d_from";
            $bindings[':d_from'] = $dateFrom;
        }

        if ($dateTo) {
            $query .= " AND DATE(al.created_at) <= :d_to";
            $bindings[':d_to'] = $dateTo;
        }

        $query .= " ORDER BY al.created_at DESC, al.id DESC LIMIT :limit OFFSET :offset";

        $stmt = $pdo->prepare($query);
        foreach ($bindings as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($logs);
    }
}
