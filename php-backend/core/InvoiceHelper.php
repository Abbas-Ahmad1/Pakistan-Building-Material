<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

class InvoiceHelper
{
    /**
     * Generate a unified, sequential, collision-safe invoice number
     * Standard Format across POS and Quotation conversions:
     * INV-YYYYMMDD-XXXX (e.g. INV-20260913-0001)
     */
    public static function generateInvoiceNumber(PDO $pdo): string
    {
        $datePrefix = date('Ymd');
        $prefix = "INV-{$datePrefix}-";

        // Lock latest record for today within active transaction to prevent race conditions
        $stmt = $pdo->prepare("
            SELECT invoice_number 
            FROM sales 
            WHERE invoice_number LIKE ? 
            ORDER BY id DESC 
            LIMIT 1 
            FOR UPDATE
        ");
        $stmt->execute([$prefix . '%']);
        $lastInvoice = $stmt->fetchColumn();

        $nextSeq = 1;
        if ($lastInvoice) {
            $parts = explode('-', (string)$lastInvoice);
            if (isset($parts[2]) && is_numeric($parts[2])) {
                $nextSeq = (int)$parts[2] + 1;
            } else {
                $countStmt = $pdo->prepare("SELECT COUNT(*) FROM sales WHERE invoice_number LIKE ?");
                $countStmt->execute([$prefix . '%']);
                $nextSeq = (int)$countStmt->fetchColumn() + 1;
            }
        }

        $candidate = sprintf("%s%04d", $prefix, $nextSeq);

        // Defensive collision resolution
        $check = $pdo->prepare("SELECT id FROM sales WHERE invoice_number = ?");
        $check->execute([$candidate]);
        if ($check->fetch()) {
            $candidate = sprintf("%s%04d-%s", $prefix, $nextSeq, bin2hex(random_bytes(2)));
        }

        return $candidate;
    }

    /**
     * Generate a unified, sequential, collision-safe purchase order number
     * Format: PO-YYYYMMDD-XXXX (e.g. PO-20260913-0001)
     */
    public static function generatePurchaseNumber(PDO $pdo): string
    {
        $datePrefix = date('Ymd');
        $prefix = "PO-{$datePrefix}-";

        $stmt = $pdo->prepare("
            SELECT purchase_number 
            FROM purchases 
            WHERE purchase_number LIKE ? 
            ORDER BY id DESC 
            LIMIT 1 
            FOR UPDATE
        ");
        $stmt->execute([$prefix . '%']);
        $lastPO = $stmt->fetchColumn();

        $nextSeq = 1;
        if ($lastPO) {
            $parts = explode('-', (string)$lastPO);
            if (isset($parts[2]) && is_numeric($parts[2])) {
                $nextSeq = (int)$parts[2] + 1;
            } else {
                $countStmt = $pdo->prepare("SELECT COUNT(*) FROM purchases WHERE purchase_number LIKE ?");
                $countStmt->execute([$prefix . '%']);
                $nextSeq = (int)$countStmt->fetchColumn() + 1;
            }
        }

        $candidate = sprintf("%s%04d", $prefix, $nextSeq);

        $check = $pdo->prepare("SELECT id FROM purchases WHERE purchase_number = ?");
        $check->execute([$candidate]);
        if ($check->fetch()) {
            $candidate = sprintf("%s%04d-%s", $prefix, $nextSeq, bin2hex(random_bytes(2)));
        }

        return $candidate;
    }

    /**
     * Generate a unified, sequential, collision-safe quotation number
     * Format: QT-YYYYMMDD-XXXX (e.g. QT-20260913-0001)
     */
    public static function generateQuotationNumber(PDO $pdo): string
    {
        $datePrefix = date('Ymd');
        $prefix = "QT-{$datePrefix}-";

        $stmt = $pdo->prepare("
            SELECT quotation_number 
            FROM quotations 
            WHERE quotation_number LIKE ? 
            ORDER BY id DESC 
            LIMIT 1 
            FOR UPDATE
        ");
        $stmt->execute([$prefix . '%']);
        $lastQT = $stmt->fetchColumn();

        $nextSeq = 1;
        if ($lastQT) {
            $parts = explode('-', (string)$lastQT);
            if (isset($parts[2]) && is_numeric($parts[2])) {
                $nextSeq = (int)$parts[2] + 1;
            } else {
                $countStmt = $pdo->prepare("SELECT COUNT(*) FROM quotations WHERE quotation_number LIKE ?");
                $countStmt->execute([$prefix . '%']);
                $nextSeq = (int)$countStmt->fetchColumn() + 1;
            }
        }

        $candidate = sprintf("%s%04d", $prefix, $nextSeq);

        $check = $pdo->prepare("SELECT id FROM quotations WHERE quotation_number = ?");
        $check->execute([$candidate]);
        if ($check->fetch()) {
            $candidate = sprintf("%s%04d-%s", $prefix, $nextSeq, bin2hex(random_bytes(2)));
        }

        return $candidate;
    }
}
