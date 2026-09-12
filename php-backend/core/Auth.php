<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

class Auth
{
    /**
     * Verify token and return user session object or null
     */
    public static function verifySession(?string $token): ?array
    {
        if (!$token) {
            return null;
        }

        $pdo = Database::getConnection();

        // 1. Query persistent user_sessions table
        $sql = "
            SELECT 
                s.token,
                s.user_id as userId,
                s.branch_id as branchId,
                s.expires_at,
                u.name,
                u.username,
                u.email,
                u.status,
                r.name as role,
                b.name as branch_name,
                b.code as branch_code
            FROM user_sessions s
            INNER JOIN users u ON s.user_id = u.id
            INNER JOIN roles r ON u.role_id = r.id
            LEFT JOIN branches b ON s.branch_id = b.id
            WHERE s.token = :token AND s.expires_at > NOW() AND u.status = 'active'
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([':token' => $token]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($session) {
            return [
                'token'       => $session['token'],
                'userId'      => (int)$session['userId'],
                'username'    => $session['username'],
                'name'        => $session['name'],
                'email'       => $session['email'],
                'role'        => strtoupper($session['role']),
                'branchId'    => (int)($session['branchId'] ?? 1),
                'branch_name' => $session['branch_name'] ?? 'Main Branch',
                'branch_code' => $session['branch_code'] ?? 'MB-01',
            ];
        }

        return null;
    }

    /**
     * Require authenticated session or abort with 401
     */
    public static function requireAuth(Request $request): array
    {
        $token = $request->getBearerToken();
        $session = self::verifySession($token);

        if (!$session) {
            Response::error('Unauthorized: Invalid or expired authentication session.', 401);
            exit;
        }

        return $session;
    }

    /**
     * Require ADMIN role or abort with 403
     */
    public static function requireAdmin(array $session): void
    {
        if (($session['role'] ?? '') !== 'ADMIN') {
            Response::error('Forbidden: Administrator privileges required for this action.', 403);
            exit;
        }
    }

    /**
     * Create a secure persistent session token
     */
    public static function createSession(int $userId, int $branchId, ?string $ip = null, ?string $ua = null): string
    {
        $pdo = Database::getConnection();
        $token = bin2hex(random_bytes(32)); // 64-char cryptographically secure token
        $config = require __DIR__ . '/../config/config.php';
        $lifetime = (int)($config['session_lifetime'] ?? 604800);
        $expiresAt = date('Y-m-d H:i:s', time() + $lifetime);

        $stmt = $pdo->prepare("
            INSERT INTO user_sessions (token, user_id, branch_id, ip_address, user_agent, expires_at)
            VALUES (:token, :user_id, :branch_id, :ip, :ua, :expires_at)
        ");

        $stmt->execute([
            ':token'      => $token,
            ':user_id'    => $userId,
            ':branch_id'  => $branchId,
            ':ip'         => $ip,
            ':ua'         => $ua ? substr($ua, 0, 255) : null,
            ':expires_at' => $expiresAt,
        ]);

        return $token;
    }

    /**
     * Destroy session on logout
     */
    public static function destroySession(string $token): bool
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM user_sessions WHERE token = :token");
        return $stmt->execute([':token' => $token]);
    }

    /**
     * Update active branch for current session
     */
    public static function updateSessionBranch(string $token, int $branchId): bool
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE user_sessions SET branch_id = :branch_id WHERE token = :token");
        return $stmt->execute([':branch_id' => $branchId, ':token' => $token]);
    }

    /**
     * Record an event in the audit log
     */
    public static function logAudit(?int $userId, string $action, string $module, ?int $recordId = null, ?string $details = null, ?string $ip = null): void
    {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                INSERT INTO audit_logs (user_id, action, module, record_id, details, ip_address)
                VALUES (:user_id, :action, :module, :record_id, :details, :ip)
            ");
            $stmt->execute([
                ':user_id'   => $userId,
                ':action'    => $action,
                ':module'    => $module,
                ':record_id' => $recordId,
                ':details'   => $details,
                ':ip'        => $ip,
            ]);
        } catch (\Throwable $e) {
            // Do not fail operation if audit log insert encounters non-fatal issue
        }
    }
}
