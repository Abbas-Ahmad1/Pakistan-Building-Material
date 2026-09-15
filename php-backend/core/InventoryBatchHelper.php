<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

class InventoryBatchHelper
{
    /**
     * Process stock inward (e.g. from Purchase Order or Initial Stock)
     * Creates an inventory batch layer, calculates cost change, updates previous_cost / weighted_avg_cost,
     * and if auto_price_update is enabled, updates selling_price and writes price history.
     */
    public static function processStockInward(
        PDO $pdo,
        int $productId,
        int $branchId,
        float $quantity,
        float $unitCost,
        ?int $purchaseId = null,
        ?int $supplierId = null,
        ?string $batchNumber = null,
        ?int $userId = null,
        string $referenceType = 'PURCHASE_ORDER'
    ): array {
        if ($quantity <= 0) {
            return ['status' => 'skipped', 'reason' => 'Zero quantity'];
        }

        // Fetch current product pricing and costing configurations
        $stmt = $pdo->prepare("
            SELECT 
                id, name, sku, purchase_price, previous_cost, selling_price, wholesale_price,
                pricing_mode, markup_percentage, margin_percentage, auto_price_update,
                current_stock, weighted_avg_cost
            FROM products 
            WHERE id = ? FOR UPDATE
        ");
        $stmt->execute([$productId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$product) {
            throw new \Exception("Product #{$productId} not found during batch processing.");
        }

        $oldCost = (float)$product['purchase_price'];
        $oldSellingPrice = (float)$product['selling_price'];
        $currentStock = (float)$product['current_stock'];
        $pricingMode = $product['pricing_mode'] ?: 'FIXED';
        $markupPercent = (float)($product['markup_percentage'] ?? 0);
        $marginPercent = (float)($product['margin_percentage'] ?? 0);
        $autoUpdate = (int)($product['auto_price_update'] ?? 0);

        // 1. Calculate Weighted Average Cost
        // If currentStock <= 0, new weighted average cost is simply unitCost
        $totalStockAfter = $currentStock + $quantity;
        $existingTotalVal = max(0.0, $currentStock * ($product['weighted_avg_cost'] > 0 ? (float)$product['weighted_avg_cost'] : $oldCost));
        $newInwardVal = $quantity * $unitCost;
        $newWeightedAvgCost = $totalStockAfter > 0 ? round(($existingTotalVal + $newInwardVal) / $totalStockAfter, 2) : $unitCost;

        // 2. Calculate Cost Change %
        $costChangePercent = 0.0;
        if ($oldCost > 0) {
            $costChangePercent = round((($unitCost - $oldCost) / $oldCost) * 100, 2);
        }

        // 3. Generate unique Batch Number if not passed
        if (!$batchNumber) {
            $dateStr = date('Ymd');
            $batchNumber = "BATCH-{$dateStr}-P{$productId}-" . strtoupper(substr(uniqid(), -4));
        }

        // 4. Insert into inventory_batches
        $insBatch = $pdo->prepare("
            INSERT INTO inventory_batches (
                product_id, branch_id, supplier_id, purchase_id, batch_number,
                unit_cost, initial_quantity, remaining_quantity, received_date, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        ");
        $notes = "Inward from {$referenceType}" . ($purchaseId ? " #{$purchaseId}" : "");
        $insBatch->execute([
            $productId,
            $branchId,
            $supplierId,
            $purchaseId,
            $batchNumber,
            $unitCost,
            $quantity,
            $quantity,
            $notes
        ]);
        $batchId = (int)$pdo->lastInsertId();

        // 5. Log batch transaction
        $insBatchTx = $pdo->prepare("
            INSERT INTO inventory_batch_transactions (
                batch_id, transaction_type, reference_type, reference_id,
                quantity, unit_cost, remaining_quantity_after
            ) VALUES (?, 'PURCHASE', ?, ?, ?, ?, ?)
        ");
        $insBatchTx->execute([
            $batchId,
            $referenceType,
            $purchaseId,
            $quantity,
            $unitCost,
            $quantity
        ]);

        // 6. Automatic Selling Price Calculation if pricing_mode != 'FIXED' and auto_price_update == 1
        $newSellingPrice = $oldSellingPrice;
        $priceChangePercent = 0.0;
        $priceChanged = false;
        $changeReason = '';

        if ($autoUpdate === 1 && abs($unitCost - $oldCost) > 0.001) {
            if ($pricingMode === 'MARKUP' && $markupPercent > 0) {
                // Selling Price = Cost * (1 + Markup% / 100)
                $newSellingPrice = round($unitCost * (1 + ($markupPercent / 100)), 2);
                $changeReason = "Auto-updated via MARKUP ({$markupPercent}%) on new purchase cost Rs. " . number_format($unitCost, 2);
            } elseif ($pricingMode === 'MARGIN' && $marginPercent > 0 && $marginPercent < 100) {
                // Selling Price = Cost / (1 - Margin% / 100)
                $newSellingPrice = round($unitCost / (1 - ($marginPercent / 100)), 2);
                $changeReason = "Auto-updated via MARGIN ({$marginPercent}%) on new purchase cost Rs. " . number_format($unitCost, 2);
            }

            if ($newSellingPrice !== $oldSellingPrice && $newSellingPrice > 0) {
                $priceChanged = true;
                if ($oldSellingPrice > 0) {
                    $priceChangePercent = round((($newSellingPrice - $oldSellingPrice) / $oldSellingPrice) * 100, 2);
                }
            }
        }

        // 7. Update products table with previous_cost, cost_change_percent, weighted_avg_cost, and new selling_price if changed
        $updProduct = $pdo->prepare("
            UPDATE products SET
                previous_cost = ?,
                purchase_price = ?,
                cost_change_percent = ?,
                weighted_avg_cost = ?,
                last_cost_update = NOW(),
                selling_price = ?
            WHERE id = ?
        ");
        $updProduct->execute([
            $oldCost,
            $unitCost,
            $costChangePercent,
            $newWeightedAvgCost,
            $newSellingPrice,
            $productId
        ]);

        // 8. Record in product_price_history if cost changed or price changed
        if (abs($unitCost - $oldCost) > 0.001 || $priceChanged) {
            $reason = $changeReason ?: ("Stock inward at Rs. " . number_format($unitCost, 2) . " (Previous: Rs. " . number_format($oldCost, 2) . ")");
            $insHist = $pdo->prepare("
                INSERT INTO product_price_history (
                    product_id, branch_id, old_cost, new_cost, cost_change_percent,
                    old_selling_price, new_selling_price, price_change_percent,
                    pricing_mode, reason, user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $insHist->execute([
                $productId,
                $branchId,
                $oldCost,
                $unitCost,
                $costChangePercent,
                $oldSellingPrice,
                $newSellingPrice,
                $priceChangePercent,
                $pricingMode,
                $reason,
                $userId
            ]);
        }

        return [
            'batch_id'            => $batchId,
            'batch_number'        => $batchNumber,
            'old_cost'            => $oldCost,
            'new_cost'            => $unitCost,
            'cost_change_percent' => $costChangePercent,
            'old_selling_price'   => $oldSellingPrice,
            'new_selling_price'   => $newSellingPrice,
            'price_changed'       => $priceChanged,
            'weighted_avg_cost'   => $newWeightedAvgCost
        ];
    }

    /**
     * Consume stock for a sale using FIFO (or Weighted Average Costing)
     * Deducts quantity from oldest active inventory_batches for the branch,
     * logs inventory_batch_transactions, and returns the accurate calculated total line COGS.
     */
    public static function consumeStockForSale(
        PDO $pdo,
        int $productId,
        int $branchId,
        float $quantity,
        int $saleId,
        ?int $saleItemId = null
    ): array {
        if ($quantity <= 0) {
            return ['cogs' => 0.0, 'effective_unit_cost' => 0.0, 'consumed_layers' => []];
        }

        // Check system costing method setting
        $methodStmt = $pdo->query("SELECT `value` FROM settings WHERE `key` = 'inventory_costing_method' LIMIT 1");
        $costingMethod = strtoupper((string)($methodStmt ? $methodStmt->fetchColumn() : 'FIFO'));

        // If configured for WEIGHTED_AVERAGE, calculate COGS from product's weighted_avg_cost or purchase_price
        if ($costingMethod === 'WEIGHTED_AVERAGE' || $costingMethod === 'AVCO') {
            $pStmt = $pdo->prepare("SELECT purchase_price, weighted_avg_cost FROM products WHERE id = ?");
            $pStmt->execute([$productId]);
            $pData = $pStmt->fetch(PDO::FETCH_ASSOC);
            $avgCost = ($pData && (float)$pData['weighted_avg_cost'] > 0)
                ? (float)$pData['weighted_avg_cost']
                : (float)($pData['purchase_price'] ?? 0.0);

            $totalCogs = round($quantity * $avgCost, 2);

            // Deduct batches in FIFO order as well so batch remaining_quantity stays synced
            self::depleteBatchesFifo($pdo, $productId, $branchId, $quantity, $saleId, $avgCost);

            return [
                'cogs' => $totalCogs,
                'effective_unit_cost' => $avgCost,
                'costing_method' => 'WEIGHTED_AVERAGE',
                'consumed_layers' => [['cost' => $avgCost, 'quantity' => $quantity]]
            ];
        }

        // Standard FIFO Costing:
        // Find active batches for this product & branch ordered by received_date ASC, id ASC
        $stmt = $pdo->prepare("
            SELECT id, batch_number, unit_cost, remaining_quantity
            FROM inventory_batches
            WHERE product_id = ? AND branch_id = ? AND remaining_quantity > 0
            ORDER BY received_date ASC, id ASC
            FOR UPDATE
        ");
        $stmt->execute([$productId, $branchId]);
        $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $remainingToConsume = $quantity;
        $totalCogs = 0.0;
        $consumedLayers = [];

        $updBatch = $pdo->prepare("UPDATE inventory_batches SET remaining_quantity = ? WHERE id = ?");
        $insTx = $pdo->prepare("
            INSERT INTO inventory_batch_transactions (
                batch_id, transaction_type, reference_type, reference_id,
                quantity, unit_cost, remaining_quantity_after
            ) VALUES (?, 'SALE', 'INVOICE', ?, ?, ?, ?)
        ");

        foreach ($batches as $b) {
            if ($remainingToConsume <= 0) {
                break;
            }

            $bId = (int)$b['id'];
            $bRem = (float)$b['remaining_quantity'];
            $bCost = (float)$b['unit_cost'];

            $takeQty = min($remainingToConsume, $bRem);
            $newRem = round($bRem - $takeQty, 2);
            $lineCogs = round($takeQty * $bCost, 2);

            $totalCogs += $lineCogs;
            $remainingToConsume = round($remainingToConsume - $takeQty, 2);

            $updBatch->execute([$newRem, $bId]);
            $insTx->execute([$bId, $saleId, -$takeQty, $bCost, $newRem]);

            $consumedLayers[] = [
                'batch_id' => $bId,
                'batch_number' => $b['batch_number'],
                'cost' => $bCost,
                'quantity' => $takeQty,
                'subtotal_cost' => $lineCogs
            ];
        }

        // If there wasn't enough batch stock (e.g. negative stock or pre-existing stock without batch),
        // use latest purchase price for the remaining shortage
        if ($remainingToConsume > 0) {
            $pStmt = $pdo->prepare("SELECT purchase_price FROM products WHERE id = ?");
            $pStmt->execute([$productId]);
            $fallbackCost = (float)($pStmt->fetchColumn() ?: 0.0);
            $shortageCogs = round($remainingToConsume * $fallbackCost, 2);
            $totalCogs += $shortageCogs;

            $consumedLayers[] = [
                'batch_id' => null,
                'batch_number' => 'UNBATCHED_STOCK',
                'cost' => $fallbackCost,
                'quantity' => $remainingToConsume,
                'subtotal_cost' => $shortageCogs
            ];
        }

        $effectiveUnitCost = $quantity > 0 ? round($totalCogs / $quantity, 2) : 0.0;

        return [
            'cogs' => round($totalCogs, 2),
            'effective_unit_cost' => $effectiveUnitCost,
            'costing_method' => 'FIFO',
            'consumed_layers' => $consumedLayers
        ];
    }

    /**
     * Helper to deplete batches for FIFO quantity tracking
     */
    private static function depleteBatchesFifo(
        PDO $pdo,
        int $productId,
        int $branchId,
        float $quantity,
        int $saleId,
        float $avgCost
    ): void {
        $stmt = $pdo->prepare("
            SELECT id, remaining_quantity, unit_cost
            FROM inventory_batches
            WHERE product_id = ? AND branch_id = ? AND remaining_quantity > 0
            ORDER BY received_date ASC, id ASC
            FOR UPDATE
        ");
        $stmt->execute([$productId, $branchId]);
        $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $rem = $quantity;
        $updBatch = $pdo->prepare("UPDATE inventory_batches SET remaining_quantity = ? WHERE id = ?");
        $insTx = $pdo->prepare("
            INSERT INTO inventory_batch_transactions (
                batch_id, transaction_type, reference_type, reference_id,
                quantity, unit_cost, remaining_quantity_after
            ) VALUES (?, 'SALE', 'INVOICE', ?, ?, ?, ?)
        ");

        foreach ($batches as $b) {
            if ($rem <= 0) break;
            $bId = (int)$b['id'];
            $avail = (float)$b['remaining_quantity'];
            $take = min($rem, $avail);
            $newRem = round($avail - $take, 2);
            $rem = round($rem - $take, 2);

            $updBatch->execute([$newRem, $bId]);
            $insTx->execute([$bId, $saleId, -$take, (float)$b['unit_cost'], $newRem]);
        }
    }

    /**
     * Restore stock on Sales Return: replenish the most recent batch or create return batch
     */
    public static function restoreStockForReturn(
        PDO $pdo,
        int $productId,
        int $branchId,
        float $quantity,
        int $returnId,
        float $unitCost
    ): void {
        if ($quantity <= 0) return;

        // Check if there is an active batch for this product/branch to restore to
        $stmt = $pdo->prepare("
            SELECT id, remaining_quantity FROM inventory_batches
            WHERE product_id = ? AND branch_id = ?
            ORDER BY id DESC LIMIT 1
            FOR UPDATE
        ");
        $stmt->execute([$productId, $branchId]);
        $latestBatch = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($latestBatch) {
            $batchId = (int)$latestBatch['id'];
            $newRem = round((float)$latestBatch['remaining_quantity'] + $quantity, 2);
            $pdo->prepare("UPDATE inventory_batches SET remaining_quantity = ? WHERE id = ?")->execute([$newRem, $batchId]);

            $pdo->prepare("
                INSERT INTO inventory_batch_transactions (
                    batch_id, transaction_type, reference_type, reference_id,
                    quantity, unit_cost, remaining_quantity_after
                ) VALUES (?, 'SALE_RETURN', 'RETURN', ?, ?, ?, ?)
            ")->execute([$batchId, $returnId, $quantity, $unitCost, $newRem]);
        } else {
            // Create a return batch
            $batchNum = "RET-" . date('Ymd') . "-P{$productId}-" . strtoupper(substr(uniqid(), -4));
            $pdo->prepare("
                INSERT INTO inventory_batches (
                    product_id, branch_id, batch_number, unit_cost, initial_quantity, remaining_quantity, received_date, notes
                ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
            ")->execute([$productId, $branchId, $batchNum, $unitCost, $quantity, $quantity, "Restocked from Sales Return #{$returnId}"]);
            $batchId = (int)$pdo->lastInsertId();

            $pdo->prepare("
                INSERT INTO inventory_batch_transactions (
                    batch_id, transaction_type, reference_type, reference_id,
                    quantity, unit_cost, remaining_quantity_after
                ) VALUES (?, 'SALE_RETURN', 'RETURN', ?, ?, ?, ?)
            ")->execute([$batchId, $returnId, $quantity, $unitCost, $quantity]);
        }
    }
}
