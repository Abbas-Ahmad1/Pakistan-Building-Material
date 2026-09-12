<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class CategoriesController
{
    /**
     * GET /api/categories
     */
    public function index(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $pdo = Database::getConnection();

        $stmt = $pdo->query("
            SELECT 
                c.*,
                (SELECT COUNT(*) FROM products WHERE category_id = c.id) as products_count
            FROM categories c
            ORDER BY c.name ASC
        ");
        $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch subcategories
        $subStmt = $pdo->query("
            SELECT 
                sc.*,
                (SELECT COUNT(*) FROM products WHERE subcategory_id = sc.id) as products_count
            FROM subcategories sc
            ORDER BY sc.name ASC
        ");
        $subcategories = $subStmt->fetchAll(PDO::FETCH_ASSOC);

        $subMap = [];
        foreach ($subcategories as $sc) {
            $subMap[$sc['category_id']][] = [
                'id'             => (int)$sc['id'],
                'name'           => $sc['name'],
                'description'    => $sc['description'] ?? null,
                'products_count' => (int)$sc['products_count'],
            ];
        }

        foreach ($categories as &$c) {
            $c['id'] = (int)$c['id'];
            $c['products_count'] = (int)$c['products_count'];
            $c['subcategories'] = $subMap[$c['id']] ?? [];
        }

        Response::success($categories);
    }

    /**
     * POST /api/categories
     */
    public function store(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $name = trim((string)$request->body('name', ''));
        $description = trim((string)$request->body('description', '')) ?: null;

        if ($name === '') {
            Response::error('Category name is required.', 400);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("INSERT INTO categories (name, description) VALUES (?, ?)");
        $stmt->execute([$name, $description]);
        $id = (int)$pdo->lastInsertId();

        Auth::logAudit($session['userId'], 'CREATE_CATEGORY', 'Categories', $id, "Created category: {$name}", $request->getClientIp());

        Response::success(['id' => $id, 'name' => $name], 'Category created successfully', 201);
    }

    /**
     * PUT /api/categories/{id}
     */
    public function update(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        $name = trim((string)$request->body('name', ''));
        $description = trim((string)$request->body('description', '')) ?: null;

        if ($name === '') {
            Response::error('Category name is required.', 400);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE categories SET name = ?, description = ? WHERE id = ?");
        $stmt->execute([$name, $description, $id]);

        Auth::logAudit($session['userId'], 'UPDATE_CATEGORY', 'Categories', $id, "Updated category: {$name}", $request->getClientIp());

        Response::success(null, 'Category updated successfully');
    }

    /**
     * DELETE /api/categories/{id}
     */
    public function destroy(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();

        $check = $pdo->prepare("SELECT COUNT(*) FROM products WHERE category_id = ?");
        $check->execute([$id]);
        if ((int)$check->fetchColumn() > 0) {
            Response::error('Cannot delete category containing products. Reassign or delete products first.', 400);
            return;
        }

        $pdo->prepare("DELETE FROM subcategories WHERE category_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM categories WHERE id = ?")->execute([$id]);

        Auth::logAudit($session['userId'], 'DELETE_CATEGORY', 'Categories', $id, "Deleted category ID: {$id}", $request->getClientIp());

        Response::success(null, 'Category deleted successfully');
    }

    /**
     * POST /api/categories/{id}/subcategories
     */
    public function storeSubcategory(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $categoryId = (int)($params['id'] ?? 0);

        $name = trim((string)$request->body('name', ''));
        $description = trim((string)$request->body('description', '')) ?: null;

        if ($name === '') {
            Response::error('Subcategory name is required.', 400);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("INSERT INTO subcategories (category_id, name, description) VALUES (?, ?, ?)");
        $stmt->execute([$categoryId, $name, $description]);
        $id = (int)$pdo->lastInsertId();

        Response::success(['id' => $id, 'name' => $name], 'Subcategory added successfully', 201);
    }

    /**
     * DELETE /api/categories/subcategories/{id}
     */
    public function destroySubcategory(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $pdo->prepare("UPDATE products SET subcategory_id = NULL WHERE subcategory_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM subcategories WHERE id = ?")->execute([$id]);

        Response::success(null, 'Subcategory deleted successfully');
    }
}
