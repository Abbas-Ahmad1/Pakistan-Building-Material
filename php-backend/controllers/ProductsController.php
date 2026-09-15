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
                " . ($isAdmin ? "p.purchase_price, p.previous_cost, p.weighted_avg_cost," : "0 as purchase_price, 0 as previous_cost, 0 as weighted_avg_cost,") . "
                p.cost_change_percent,
                p.selling_price,
                p.wholesale_price,
                p.pricing_mode,
                p.markup_percentage,
                p.margin_percentage,
                p.auto_price_update,
                p.last_cost_update,
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
            $prod['previous_cost'] = (float)($prod['previous_cost'] ?? 0);
            $prod['cost_change_percent'] = (float)($prod['cost_change_percent'] ?? 0);
            $prod['weighted_avg_cost'] = (float)($prod['weighted_avg_cost'] ?? 0);
            $prod['selling_price'] = (float)$prod['selling_price'];
            $prod['wholesale_price'] = (float)$prod['wholesale_price'];
            $prod['pricing_mode'] = $prod['pricing_mode'] ?: 'FIXED';
            $prod['markup_percentage'] = (float)($prod['markup_percentage'] ?? 0);
            $prod['margin_percentage'] = (float)($prod['margin_percentage'] ?? 0);
            $prod['auto_price_update'] = (bool)($prod['auto_price_update'] ?? 0);
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
        $pricingMode = in_array($request->body('pricing_mode'), ['FIXED', 'MARKUP', 'MARGIN'], true) ? $request->body('pricing_mode') : 'FIXED';
        $markupPercentage = (float)$request->body('markup_percentage', 0);
        $marginPercentage = (float)$request->body('margin_percentage', 0);
        $autoPriceUpdate = $request->body('auto_price_update') ? 1 : 0;

        // Validation: price values must be non-negative
        if ($purchasePrice < 0 || $sellingPrice < 0 || $wholesalePrice < 0) {
            Response::error('Purchase price, selling price, and wholesale price cannot be negative.', 400);
            return;
        }

        // Validation: Margin percentage cannot be 100% or greater
        if ($pricingMode === 'MARGIN' && $marginPercentage >= 100) {
            Response::error('Target margin percentage must be strictly less than 100%.', 400);
            return;
        }

        if ($pricingMode === 'MARKUP' && $markupPercentage < 0) {
            Response::error('Markup percentage cannot be negative.', 400);
            return;
        }

        if ($pricingMode === 'MARGIN' && $marginPercentage < 0) {
            Response::error('Margin percentage cannot be negative.', 400);
            return;
        }

        // Auto-compute selling price on creation if markup/margin provided and selling_price <= 0
        if ($sellingPrice <= 0 && $purchasePrice > 0) {
            if ($pricingMode === 'MARKUP' && $markupPercentage > 0) {
                $sellingPrice = round($purchasePrice * (1 + ($markupPercentage / 100)), 2);
            } elseif ($pricingMode === 'MARGIN' && $marginPercentage > 0 && $marginPercentage < 100) {
                $sellingPrice = round($purchasePrice / (1 - ($marginPercentage / 100)), 2);
            }
        }

        Database::beginTransaction();

        try {
            $insert = $pdo->prepare("
                INSERT INTO products (
                    sku, barcode, name, category_id, subcategory_id, brand, description, unit,
                    purchase_price, previous_cost, cost_change_percent, selling_price, wholesale_price,
                    pricing_mode, markup_percentage, margin_percentage, auto_price_update,
                    last_cost_update, weighted_avg_cost, current_stock, minimum_stock,
                    supplier_id, image_url, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)
            ");

            $insert->execute([
                $sku, $barcode, $name, $categoryId, $subcategoryId, $brand, $description, $unit,
                $purchasePrice, $purchasePrice, $sellingPrice, $wholesalePrice,
                $pricingMode, $markupPercentage, $marginPercentage, $autoPriceUpdate,
                $purchasePrice, $initialStock, $minStock,
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
                $stockForBranch = ($bId == 1) ? $initialStock : 0.00;
                $bsInsert->execute([$bId, $productId, $stockForBranch, $minStock]);
            }

            // Create initial batch layer and audit log if stock > 0
            if ($initialStock > 0) {
                $batchNum = "BATCH-INIT-1-{$productId}";
                $pdo->prepare("
                    INSERT INTO inventory_batches (
                        product_id, branch_id, supplier_id, batch_number,
                        unit_cost, initial_quantity, remaining_quantity, received_date, notes
                    ) VALUES (?, 1, ?, ?, ?, ?, ?, NOW(), 'Initial opening stock')
                ")->execute([$productId, $supplierId, $batchNum, $purchasePrice, $initialStock, $initialStock]);
                $batchId = (int)$pdo->lastInsertId();

                $pdo->prepare("
                    INSERT INTO inventory_batch_transactions (
                        batch_id, transaction_type, reference_type, reference_id,
                        quantity, unit_cost, remaining_quantity_after
                    ) VALUES (?, 'PURCHASE', 'OPENING_STOCK', NULL, ?, ?, ?)
                ")->execute([$batchId, $initialStock, $purchasePrice, $initialStock]);

                $txStmt = $pdo->prepare("
                    INSERT INTO inventory_transactions (
                        product_id, transaction_type, reference_type, reference_id,
                        quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
                    ) VALUES (?, 'ADJUSTMENT_IN', 'OPENING_STOCK', NULL, ?, ?, 0.00, ?, 'Opening initial stock', ?, 1)
                ");
                $txStmt->execute([$productId, $initialStock, $purchasePrice, $initialStock, $session['userId']]);
            }

            // Initial price history record
            $pdo->prepare("
                INSERT INTO product_price_history (
                    product_id, branch_id, old_cost, new_cost, cost_change_percent,
                    old_selling_price, new_selling_price, price_change_percent,
                    pricing_mode, reason, user_id
                ) VALUES (?, NULL, 0.00, ?, 0.00, 0.00, ?, 0.00, ?, 'Initial product creation', ?)
            ")->execute([$productId, $purchasePrice, $sellingPrice, $pricingMode, $session['userId']]);

            Auth::logAudit($session['userId'], 'CREATE_PRODUCT', 'Products', $productId, "Created product: {$name} ({$sku})", $request->getClientIp());

            Database::commit();

            Response::success(['id' => $productId, 'sku' => $sku, 'name' => $name], 'Product created successfully', 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            error_log("Failed to create product: " . $e->getMessage());
            Response::error('Unable to create product. Please verify inputs and try again.', 400);
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
        $pricingMode = in_array($request->body('pricing_mode'), ['FIXED', 'MARKUP', 'MARGIN'], true) ? $request->body('pricing_mode') : ($prod['pricing_mode'] ?: 'FIXED');
        $markupPercentage = $request->body('markup_percentage') !== null ? (float)$request->body('markup_percentage') : (float)($prod['markup_percentage'] ?? 0);
        $marginPercentage = $request->body('margin_percentage') !== null ? (float)$request->body('margin_percentage') : (float)($prod['margin_percentage'] ?? 0);
        $autoPriceUpdate = $request->body('auto_price_update') !== null ? ($request->body('auto_price_update') ? 1 : 0) : (int)($prod['auto_price_update'] ?? 0);

        // Validation: price values must be non-negative
        if ($purchasePrice < 0 || $sellingPrice < 0 || $wholesalePrice < 0) {
            Response::error('Purchase price, selling price, and wholesale price cannot be negative.', 400);
            return;
        }

        // Validation: Margin percentage cannot be 100% or greater (Cost / (1 - margin/100) would be division by zero or negative)
        if ($pricingMode === 'MARGIN' && $marginPercentage >= 100) {
            Response::error('Target margin percentage must be strictly less than 100%.', 400);
            return;
        }

        if ($pricingMode === 'MARKUP' && $markupPercentage < 0) {
            Response::error('Markup percentage cannot be negative.', 400);
            return;
        }

        if ($pricingMode === 'MARGIN' && $marginPercentage < 0) {
            Response::error('Margin percentage cannot be negative.', 400);
            return;
        }

        // Dynamic formula calculation if selling price is not explicitly set or when using dynamic pricing
        if ($purchasePrice > 0) {
            if ($pricingMode === 'MARKUP' && $markupPercentage > 0) {
                // If selling price was unchanged or user is applying the markup mode
                $calculatedSelling = round($purchasePrice * (1 + ($markupPercentage / 100)), 2);
                if ($sellingPrice <= 0 || ($request->body('selling_price') === null && (float)$prod['purchase_price'] != $purchasePrice)) {
                    $sellingPrice = $calculatedSelling;
                }
            } elseif ($pricingMode === 'MARGIN' && $marginPercentage > 0 && $marginPercentage < 100) {
                $calculatedSelling = round($purchasePrice / (1 - ($marginPercentage / 100)), 2);
                if ($sellingPrice <= 0 || ($request->body('selling_price') === null && (float)$prod['purchase_price'] != $purchasePrice)) {
                    $sellingPrice = $calculatedSelling;
                }
            }
        }

        // Check SKU uniqueness
        $skuCheck = $pdo->prepare("SELECT id FROM products WHERE sku = ? AND id != ?");
        $skuCheck->execute([$sku, $id]);
        if ($skuCheck->fetch()) {
            Response::error('Another product with this SKU already exists.', 400);
            return;
        }

        $oldCost = (float)$prod['purchase_price'];
        $oldSelling = (float)$prod['selling_price'];
        $costChanged = abs($purchasePrice - $oldCost) > 0.001;
        $priceChanged = abs($sellingPrice - $oldSelling) > 0.001;

        $costChangePercent = (float)($prod['cost_change_percent'] ?? 0);
        $previousCost = (float)($prod['previous_cost'] ?? $oldCost);

        if ($costChanged) {
            $previousCost = $oldCost;
            $costChangePercent = $oldCost > 0 ? round((($purchasePrice - $oldCost) / $oldCost) * 100, 2) : 0.0;
        }

        $update = $pdo->prepare("
            UPDATE products SET
                sku = ?, barcode = ?, name = ?, category_id = ?, subcategory_id = ?,
                brand = ?, description = ?, unit = ?, purchase_price = ?, previous_cost = ?,
                cost_change_percent = ?, selling_price = ?, wholesale_price = ?,
                pricing_mode = ?, markup_percentage = ?, margin_percentage = ?, auto_price_update = ?,
                last_cost_update = " . ($costChanged ? "NOW()" : "last_cost_update") . ",
                minimum_stock = ?, supplier_id = ?, image_url = ?, status = ?
            WHERE id = ?
        ");

        $update->execute([
            $sku, $barcode, $name, $categoryId, $subcategoryId,
            $brand, $description, $unit, $purchasePrice, $previousCost,
            $costChangePercent, $sellingPrice, $wholesalePrice,
            $pricingMode, $markupPercentage, $marginPercentage, $autoPriceUpdate,
            $minStock, $supplierId, $imageUrl, $status,
            $id
        ]);

        // Audit price or cost history if modified (strictly record only if changed)
        if ($costChanged || $priceChanged) {
            $priceChangePercent = ($oldSelling > 0 && $priceChanged) ? round((($sellingPrice - $oldSelling) / $oldSelling) * 100, 2) : 0.0;
            $reason = trim((string)$request->body('change_reason', 'Manual product catalog update'));
            $pdo->prepare("
                INSERT INTO product_price_history (
                    product_id, branch_id, old_cost, new_cost, cost_change_percent,
                    old_selling_price, new_selling_price, price_change_percent,
                    pricing_mode, reason, user_id
                ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ")->execute([
                $id, $oldCost, $purchasePrice, $costChangePercent,
                $oldSelling, $sellingPrice, $priceChangePercent,
                $pricingMode, $reason, $session['userId']
            ]);
        }

        Auth::logAudit($session['userId'], 'UPDATE_PRODUCT', 'Products', $id, "Updated product: {$name} ({$sku})", $request->getClientIp());

        Response::success(null, 'Product updated successfully');
    }

    /**
     * GET /api/products/{id}/price-history
     */
    public function priceHistory(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("
            SELECT 
                ph.*,
                u.name as changed_by_name,
                b.name as branch_name
            FROM product_price_history ph
            LEFT JOIN users u ON ph.user_id = u.id
            LEFT JOIN branches b ON ph.branch_id = b.id
            WHERE ph.product_id = ?
            ORDER BY ph.created_at DESC, ph.id DESC
        ");
        $stmt->execute([$id]);
        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($history as &$h) {
            $h['id'] = (int)$h['id'];
            $h['product_id'] = (int)$h['product_id'];
            $h['old_cost'] = (float)$h['old_cost'];
            $h['new_cost'] = (float)$h['new_cost'];
            $h['cost_change_percent'] = (float)$h['cost_change_percent'];
            $h['old_selling_price'] = (float)$h['old_selling_price'];
            $h['new_selling_price'] = (float)$h['new_selling_price'];
            $h['price_change_percent'] = (float)$h['price_change_percent'];
        }

        Response::success($history);
    }

    /**
     * GET /api/products/{id}/batches
     */
    public function batches(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);
        $id = (int)($params['id'] ?? 0);
        $branchId = $request->query('branch_id');
        $pdo = Database::getConnection();

        $query = "
            SELECT 
                ib.*,
                b.name as branch_name,
                s.company as supplier_name,
                p.purchase_number
            FROM inventory_batches ib
            LEFT JOIN branches b ON ib.branch_id = b.id
            LEFT JOIN suppliers s ON ib.supplier_id = s.id
            LEFT JOIN purchases p ON ib.purchase_id = p.id
            WHERE ib.product_id = ?
        ";
        $bindings = [$id];
        if ($branchId && $branchId !== 'all') {
            $query .= " AND ib.branch_id = ?";
            $bindings[] = (int)$branchId;
        }
        $query .= " ORDER BY ib.remaining_quantity > 0 DESC, ib.received_date DESC, ib.id DESC";

        $stmt = $pdo->prepare($query);
        $stmt->execute($bindings);
        $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($batches as &$batch) {
            $batch['id'] = (int)$batch['id'];
            $batch['unit_cost'] = (float)$batch['unit_cost'];
            $batch['initial_quantity'] = (float)$batch['initial_quantity'];
            $batch['remaining_quantity'] = (float)$batch['remaining_quantity'];
        }

        Response::success($batches);
    }

    /**
     * POST /api/products/bulk-price-update (ADMIN only)
     */
    public function bulkPriceUpdate(Request $request, array $params = []): void
    {
        $session = Auth::requireAuth($request);
        Auth::requireAdmin($session);

        $productIds = $request->body('product_ids', []);
        $categoryId = $request->body('category_id');
        $adjustmentType = $request->body('adjustment_type', 'PERCENT');
        $value = (float)$request->body('value', 0);
        $reason = trim((string)$request->body('reason', 'Bulk price adjustment'));

        $pdo = Database::getConnection();
        Database::beginTransaction();

        try {
            $query = "SELECT id, name, sku, purchase_price, selling_price, pricing_mode, markup_percentage, margin_percentage FROM products WHERE status = 'active'";
            $bindings = [];

            if (!empty($productIds) && is_array($productIds)) {
                $placeholders = implode(',', array_fill(0, count($productIds), '?'));
                $query .= " AND id IN ({$placeholders})";
                $bindings = array_map('intval', $productIds);
            } elseif ($categoryId && $categoryId !== 'all') {
                $query .= " AND category_id = ?";
                $bindings[] = (int)$categoryId;
            }

            $stmt = $pdo->prepare($query);
            $stmt->execute($bindings);
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $updatedCount = 0;
            $updStmt = $pdo->prepare("UPDATE products SET selling_price = ? WHERE id = ?");
            $histStmt = $pdo->prepare("
                INSERT INTO product_price_history (
                    product_id, branch_id, old_cost, new_cost, cost_change_percent,
                    old_selling_price, new_selling_price, price_change_percent,
                    pricing_mode, reason, user_id
                ) VALUES (?, NULL, ?, ?, 0.00, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($products as $p) {
                $oldPrice = (float)$p['selling_price'];
                $cost = (float)$p['purchase_price'];
                $newPrice = $oldPrice;

                if ($adjustmentType === 'PERCENT') {
                    $newPrice = round($oldPrice * (1 + ($value / 100)), 2);
                } elseif ($adjustmentType === 'FIXED_AMOUNT') {
                    $newPrice = round(max(0.0, $oldPrice + $value), 2);
                } elseif ($adjustmentType === 'RECALCULATE_FROM_COST') {
                    $mode = $p['pricing_mode'] ?: 'MARKUP';
                    $markup = (float)($p['markup_percentage'] ?? 0);
                    $margin = (float)($p['margin_percentage'] ?? 0);
                    if ($mode === 'MARKUP' && $markup > 0) {
                        $newPrice = round($cost * (1 + ($markup / 100)), 2);
                    } elseif ($mode === 'MARGIN' && $margin > 0 && $margin < 100) {
                        $newPrice = round($cost / (1 - ($margin / 100)), 2);
                    }
                }

                if ($newPrice !== $oldPrice && $newPrice > 0) {
                    $updStmt->execute([$newPrice, $p['id']]);
                    $priceChangePercent = $oldPrice > 0 ? round((($newPrice - $oldPrice) / $oldPrice) * 100, 2) : 0.0;
                    $histStmt->execute([
                        $p['id'],
                        $cost,
                        $cost,
                        $oldPrice,
                        $newPrice,
                        $priceChangePercent,
                        $p['pricing_mode'] ?: 'FIXED',
                        $reason,
                        $session['userId']
                    ]);
                    $updatedCount++;
                }
            }

            Auth::logAudit(
                $session['userId'],
                'BULK_PRICE_UPDATE',
                'Products',
                null,
                "Bulk updated prices for {$updatedCount} products. Reason: {$reason}",
                $request->getClientIp()
            );

            Database::commit();
            Response::success(['updated_count' => $updatedCount], "Successfully updated prices for {$updatedCount} products.");
        } catch (\Throwable $e) {
            Database::rollBack();
            error_log("Failed bulk price update: " . $e->getMessage());
            Response::error('Failed to perform bulk price update.', 400);
        }
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
