<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class UsersController
{
    /**
     * GET /api/users
     */
    public function index(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $pdo = Database::getConnection();
        $stmt = $pdo->query("
            SELECT 
                u.id, u.name, u.username, u.email, u.status, u.created_at,
                r.name as role, r.id as role_id,
                b.name as branch_name, b.id as branch_id
            FROM users u
            INNER JOIN roles r ON u.role_id = r.id
            LEFT JOIN branches b ON u.branch_id = b.id
            ORDER BY u.id ASC
        ");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($users);
    }

    /**
     * POST /api/users (ADMIN only)
     */
    public function store(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $name = trim((string)$request->body('name', ''));
        $username = trim((string)$request->body('username', ''));
        $email = trim((string)$request->body('email', ''));
        $password = (string)$request->body('password', '');
        $roleId = (int)$request->body('role_id', 2); // 1 = Admin, 2 = Cashier
        $branchId = (int)$request->body('branch_id', 1);

        if ($name === '' || $username === '' || $password === '') {
            Response::error('Name, username, and password are required.', 400);
            return;
        }

        $pdo = Database::getConnection();

        // Check unique username
        $check = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $check->execute([$username]);
        if ($check->fetch()) {
            Response::error('A user with this username already exists.', 400);
            return;
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);

        $stmt = $pdo->prepare("
            INSERT INTO users (name, username, email, password_hash, role_id, branch_id, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
        ");
        $stmt->execute([$name, $username, $email ?: null, $hash, $roleId, $branchId]);
        $id = (int)$pdo->lastInsertId();

        Auth::logAudit($session['userId'], 'CREATE_USER', 'Users', $id, "Created user: {$username}", $request->getClientIp());

        Response::success(['id' => $id, 'username' => $username], 'User created successfully', 201);
    }

    /**
     * PUT /api/users/{id} (ADMIN only)
     */
    public function update(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $user = $pdo->prepare("SELECT * FROM users WHERE id = ?");
        $user->execute([$id]);
        $existing = $user->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            Response::error('User not found.', 404);
            return;
        }

        $name = trim((string)$request->body('name', $existing['name']));
        $email = trim((string)$request->body('email', (string)$existing['email'])) ?: null;
        $roleId = (int)$request->body('role_id', $existing['role_id']);
        $branchId = (int)$request->body('branch_id', $existing['branch_id']);
        $status = $request->body('status', $existing['status']);
        $password = (string)$request->body('password', '');

        if ($password !== '') {
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("
                UPDATE users SET name = ?, email = ?, role_id = ?, branch_id = ?, status = ?, password_hash = ?
                WHERE id = ?
            ");
            $stmt->execute([$name, $email, $roleId, $branchId, $status, $hash, $id]);
        } else {
            $stmt = $pdo->prepare("
                UPDATE users SET name = ?, email = ?, role_id = ?, branch_id = ?, status = ?
                WHERE id = ?
            ");
            $stmt->execute([$name, $email, $roleId, $branchId, $status, $id]);
        }

        Auth::logAudit($session['userId'], 'UPDATE_USER', 'Users', $id, "Updated user: {$existing['username']}", $request->getClientIp());

        Response::success(null, 'User updated successfully');
    }

    /**
     * DELETE /api/users/{id} (ADMIN only)
     */
    public function destroy(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        if ($id === 1) {
            Response::error('Primary Administrator account cannot be deleted.', 400);
            return;
        }

        $pdo = Database::getConnection();
        $pdo->prepare("UPDATE users SET status = 'inactive' WHERE id = ?")->execute([$id]);

        Auth::logAudit($session['userId'], 'DEACTIVATE_USER', 'Users', $id, "Deactivated user ID: {$id}", $request->getClientIp());

        Response::success(null, 'User deactivated successfully');
    }
}
