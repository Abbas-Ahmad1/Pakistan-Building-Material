<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

class ProductsController
{
    /**
     * GET /api/products
     */
    public function index(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $isAdmin = ($session['role'] ?? '') === 'ADMIN';

        $search = trim((string)$request->query('search', ''));
        $categoryId = $request->query('category_id');
        $status = $request->query('status');
        $stockStatus = $request->query('stock_status');
        $branchId = (int)($request->query('branch_id') ?: $session['branchId']);

        $pdo = Database::getConnection();

        $query = "
            SELECT 
                p.id,
                p.sku,
                p.barcode,
                p.name,
                p.category_id,
                c.name as category_name,
                p.subcategory_id,
                sc.name as subcategory_name,
                p.brand,
                p.description,
                p.unit,
                " . ($isAdmin ? "p.purchase_price," : "0 as purchase_price,") . "
                p.selling_price,
                p.wholesale_price,
                COALESCE(bs.current_stock, p.current_stock) as current_stock,
                p.current_stock as global_stock,
                COALESCE(bs.minimum_stock, p.minimum_stock) as minimum_stock,
                p.supplier_id,
                s.company as supplier_name,
                p.image_url,
                p.status,
                p.created_at,
                p.updated_at
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN subcategories sc ON p.subcategory_id = sc.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            LEFT JOIN branch_stocks bs ON p.id = bs.product_id AND bs.branch_id = :branch_id
            WHERE 1=1
        ";

        $bindings = [':branch_id' => $branchId];

        if ($search !== '') {
            $query .= " AND (p.name LIKE :search OR p.sku LIKE :search OR p.barcode LIKE :search OR p.brand LIKE :search)";
            $bindings[':search'] = "%{$search}%";
        }

        if ($categoryId && $categoryId !== 'all') {
            $query .= " AND p.category_id = :cat_id";
            $bindings[':cat_id'] = (int)$categoryId;
        }

        if ($status && $status !== 'all') {
            $query .= " AND p.status = :status";
            $bindings[':status'] = $status;
        } else {
            $query .= " AND p.status != 'discontinued'";
        }

        if ($stockStatus === 'out_of_stock') {
            $query .= " AND COALESCE(bs.current_stock, p.current_stock) <= 0";
        } elseif ($stockStatus === 'low_stock') {
            $query .= " AND COALESCE(bs.current_stock, p.current_stock) > 0 AND COALESCE(bs.current_stock, p.current_stock) <= COALESCE(bs.minimum_stock, p.minimum_stock)";
        }

        $query .= " ORDER BY p.name ASC";

        $stmt = $pdo->prepare($query);
        $stmt->execute($bindings);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Normalize numeric values
        foreach ($products as &$prod) {
            $prod['id'] = (int)$prod['id'];
            $prod['category_id'] = (int)$prod['category_id'];
            $prod['subcategory_id'] = $prod['subcategory_id'] ? (int)$prod['subcategory_id'] : null;
            $prod['supplier_id'] = $prod['supplier_id'] ? (int)$prod['supplier_id'] : null;
            $prod['purchase_price'] = (float)$prod['purchase_price'];
            $prod['selling_price'] = (float)$prod['selling_price'];
            $prod['wholesale_price'] = (float)$prod['wholesale_price'];
            $prod['current_stock'] = (float)$prod['current_stock'];
            $prod['global_stock'] = (float)$prod['global_stock'];
            $prod['minimum_stock'] = (float)$prod['minimum_stock'];
        }

        Response::success($products);
    }

    /**
     * GET /api/products/search (Fast POS barcode, SKU, name search with branch stock)
     */
    public function search(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $term = trim((string)$request->query('q', ''));
        $branchId = (int)($request->query('branch_id') ?: $session['branchId']);

        if ($term === '') {
            Response::success([]);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            SELECT 
                p.id,
                p.sku,
                p.barcode,
                p.name,
                p.unit,
                p.purchase_price,
                p.selling_price,
                p.wholesale_price,
                COALESCE(bs.current_stock, p.current_stock) as current_stock,
                COALESCE(bs.minimum_stock, p.minimum_stock) as minimum_stock,
                c.name as category_name,
                p.image_url
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN branch_stocks bs ON p.id = bs.product_id AND bs.branch_id = :branch_id
            WHERE p.status = 'active'
              AND (p.barcode = :exact_term OR p.sku = :exact_term OR p.name LIKE :like_term OR p.sku LIKE :like_term)
            ORDER BY 
              CASE WHEN p.barcode = :exact_term THEN 0
                   WHEN p.sku = :exact_term THEN 1
                   ELSE 2 END,
              p.name ASC
            LIMIT 25
        ");

        $stmt->execute([
            ':branch_id'  => $branchId,
            ':exact_term' => $term,
            ':like_term'  => "%{$term}%"
        ]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($results as &$r) {
            $r['id'] = (int)$r['id'];
            $r['purchase_price'] = (float)$r['purchase_price'];
            $r['selling_price'] = (float)$r['selling_price'];
            $r['wholesale_price'] = (float)$r['wholesale_price'];
            $r['current_stock'] = (float)$r['current_stock'];
            $r['minimum_stock'] = (float)$r['minimum_stock'];
        }

        Response::success($results);
    }

    /**
     * GET /api/products/{id}
     */
    public function show(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        $isAdmin = ($session['role'] ?? '') === 'ADMIN';
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            SELECT 
                p.*,
                c.name as category_name,
                sc.name as subcategory_name,
                s.company as supplier_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN subcategories sc ON p.subcategory_id = sc.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.id = ?
        ");
        $stmt->execute([$id]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$product) {
            Response::error('Product not found.', 404);
            return;
        }

        if (!$isAdmin) {
            $product['purchase_price'] = 0.00;
        }

        // Fetch branch stocks breakdown
        $bsStmt = $pdo->prepare("
            SELECT bs.branch_id, b.name as branch_name, b.code as branch_code, bs.current_stock, bs.minimum_stock
            FROM branch_stocks bs
            INNER JOIN branches b ON bs.branch_id = b.id
            WHERE bs.product_id = ?
            ORDER BY b.id ASC
        ");
        $bsStmt->execute([$id]);
        $product['branch_stocks'] = $bsStmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($product);
    }

    /**
     * POST /api/products (ADMIN only)
     */
    public function store(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $name = trim((string)$request->body('name', ''));
        $sku = trim((string)$request->body('sku', ''));
        $categoryId = (int)$request->body('category_id', 0);
        $unit = trim((string)$request->body('unit', 'Piece'));
        $sellingPrice = (float)$request->body('selling_price', 0);

        if ($name === '' || $categoryId <= 0) {
            Response::error('Product name and category are required.', 400);
            return;
        }

        // Auto-generate SKU if not provided
        if ($sku === '') {
            $sku = 'PRD-' . strtoupper(substr(uniqid(), -6));
        }

        $pdo = Database::getConnection();

        // Check uniqueness of SKU and barcode
        $checkStmt = $pdo->prepare("SELECT id FROM products WHERE sku = ?");
        $checkStmt->execute([$sku]);
        if ($checkStmt->fetch()) {
            Response::error('A product with this SKU already exists.', 400);
            return;
        }

        $barcode = trim((string)$request->body('barcode', '')) ?: null;
        if ($barcode) {
            $bcStmt = $pdo->prepare("SELECT id FROM products WHERE barcode = ?");
            $bcStmt->execute([$barcode]);
            if ($bcStmt->fetch()) {
                Response::error('A product with this Barcode already exists.', 400);
                return;
            }
        }

        $subcategoryId = $request->body('subcategory_id') ? (int)$request->body('subcategory_id') : null;
        $supplierId = $request->body('supplier_id') ? (int)$request->body('supplier_id') : null;
        $brand = trim((string)$request->body('brand', '')) ?: null;
        $description = trim((string)$request->body('description', '')) ?: null;
        $purchasePrice = (float)$request->body('purchase_price', 0);
        $wholesalePrice = (float)$request->body('wholesale_price', 0);
        $initialStock = (float)$request->body('current_stock', 0);
        $minStock = (float)$request->body('minimum_stock', 5);
        $imageUrl = trim((string)$request->body('image_url', '')) ?: null;
        $status = $request->body('status', 'active');

        Database::beginTransaction();

        try {
            $insert = $pdo->prepare("
                INSERT INTO products (
                    sku, barcode, name, category_id, subcategory_id, brand, description, unit,
                    purchase_price, selling_price, wholesale_price, current_stock, minimum_stock,
                    supplier_id, image_url, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $insert->execute([
                $sku, $barcode, $name, $categoryId, $subcategoryId, $brand, $description, $unit,
                $purchasePrice, $sellingPrice, $wholesalePrice, $initialStock, $minStock,
                $supplierId, $imageUrl, $status
            ]);

            $productId = (int)$pdo->lastInsertId();

            // Initialize stock in branch_stocks for all active branches
            $branches = $pdo->query("SELECT id FROM branches WHERE status = 'ACTIVE'")->fetchAll(PDO::FETCH_COLUMN);
            $bsInsert = $pdo->prepare("
                INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock)
                VALUES (?, ?, ?, ?)
            ");

            foreach ($branches as $bId) {
                // If main branch (1), allocate initial stock; otherwise 0
                $stockForBranch = ($bId == 1) ? $initialStock : 0.00;
                $bsInsert->execute([$bId, $productId, $stockForBranch, $minStock]);
            }

            // Log initial inventory transaction if stock > 0
            if ($initialStock > 0) {
                $txStmt = $pdo->prepare("
                    INSERT INTO inventory_transactions (
                        product_id, transaction_type, reference_type, reference_id,
                        quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
                    ) VALUES (?, 'ADJUSTMENT_IN', 'OPENING_STOCK', NULL, ?, ?, 0.00, ?, 'Opening initial stock', ?, 1)
                ");
                $txStmt->execute([$productId, $initialStock, $purchasePrice, $initialStock, $session['userId']]);
            }

            Auth::logAudit($session['userId'], 'CREATE_PRODUCT', 'Products', $productId, "Created product: {$name} ({$sku})", $request->getClientIp());

            Database::commit();

            Response::success(['id' => $productId, 'sku' => $sku, 'name' => $name], 'Product created successfully', 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to create product: ' . $e->getMessage(), 500);
        }
    }

    /**
     * PUT /api/products/{id} (ADMIN only)
     */
    public function update(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();
        $existing = $pdo->prepare("SELECT * FROM products WHERE id = ?");
        $existing->execute([$id]);
        $prod = $existing->fetch(PDO::FETCH_ASSOC);

        if (!$prod) {
            Response::error('Product not found.', 404);
            return;
        }

        $name = trim((string)$request->body('name', $prod['name']));
        $sku = trim((string)$request->body('sku', $prod['sku']));
        $barcode = trim((string)$request->body('barcode', (string)$prod['barcode'])) ?: null;
        $categoryId = (int)$request->body('category_id', $prod['category_id']);
        $subcategoryId = $request->body('subcategory_id') !== null ? (int)$request->body('subcategory_id') : $prod['subcategory_id'];
        $supplierId = $request->body('supplier_id') !== null ? (int)$request->body('supplier_id') : $prod['supplier_id'];
        $brand = $request->body('brand', $prod['brand']);
        $description = $request->body('description', $prod['description']);
        $unit = $request->body('unit', $prod['unit']);
        $purchasePrice = (float)$request->body('purchase_price', $prod['purchase_price']);
        $sellingPrice = (float)$request->body('selling_price', $prod['selling_price']);
        $wholesalePrice = (float)$request->body('wholesale_price', $prod['wholesale_price']);
        $minStock = (float)$request->body('minimum_stock', $prod['minimum_stock']);
        $imageUrl = $request->body('image_url', $prod['image_url']);
        $status = $request->body('status', $prod['status']);

        // Check SKU uniqueness
        $skuCheck = $pdo->prepare("SELECT id FROM products WHERE sku = ? AND id != ?");
        $skuCheck->execute([$sku, $id]);
        if ($skuCheck->fetch()) {
            Response::error('Another product with this SKU already exists.', 400);
            return;
        }

        $update = $pdo->prepare("
            UPDATE products SET
                sku = ?, barcode = ?, name = ?, category_id = ?, subcategory_id = ?,
                brand = ?, description = ?, unit = ?, purchase_price = ?, selling_price = ?,
                wholesale_price = ?, minimum_stock = ?, supplier_id = ?, image_url = ?, status = ?
            WHERE id = ?
        ");

        $update->execute([
            $sku, $barcode, $name, $categoryId, $subcategoryId,
            $brand, $description, $unit, $purchasePrice, $sellingPrice,
            $wholesalePrice, $minStock, $supplierId, $imageUrl, $status,
            $id
        ]);

        Auth::logAudit($session['userId'], 'UPDATE_PRODUCT', 'Products', $id, "Updated product: {$name} ({$sku})", $request->getClientIp());

        Response::success(null, 'Product updated successfully');
    }

    /**
     * DELETE /api/products/{id} (ADMIN only)
     */
    public function destroy(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);
        $id = (int)($params['id'] ?? 0);

        $pdo = Database::getConnection();

        // Check if product is tied to sales
        $saleCheck = $pdo->prepare("SELECT COUNT(*) FROM sale_items WHERE product_id = ?");
        $saleCheck->execute([$id]);
        if ((int)$saleCheck->fetchColumn() > 0) {
            // Soft-delete to discontinued to preserve historical accounting
            $pdo->prepare("UPDATE products SET status = 'discontinued' WHERE id = ?")->execute([$id]);
            Response::success(null, 'Product has historical sales transactions. Status changed to "discontinued" to preserve accounting integrity.');
            return;
        }

        $pdo->prepare("DELETE FROM branch_stocks WHERE product_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$id]);

        Auth::logAudit($session['userId'], 'DELETE_PRODUCT', 'Products', $id, "Deleted product ID: {$id}", $request->getClientIp());

        Response::success(null, 'Product deleted successfully');
    }
}
