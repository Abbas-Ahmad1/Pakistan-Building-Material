<?php
declare(strict_types=1);

/**
 * SQLite to MySQL Data Migration Script
 * Migrates all records from hardware_store.db into MySQL 8+
 */

namespace App;

use PDO;
use PDOException;

// CLI or Web execution
$isCli = (php_sapi_name() === 'cli');

function output(string $message): void {
    global $isCli;
    if ($isCli) {
        echo $message . PHP_EOL;
    } else {
        echo htmlspecialchars($message) . "<br>\n";
    }
}

output("==================================================");
output("Hardware Store POS & ERP - SQLite to MySQL Migration");
output("==================================================");

// 1. Locate SQLite database
$sqlitePaths = [
    __DIR__ . '/../hardware_store.db',
    __DIR__ . '/hardware_store.db',
    dirname(__DIR__) . '/hardware_store.db',
];

$sqliteFile = null;
foreach ($sqlitePaths as $path) {
    if (file_exists($path)) {
        $sqliteFile = realpath($path);
        break;
    }
}

if (!$sqliteFile) {
    output("ERROR: SQLite database file 'hardware_store.db' not found in project root.");
    exit(1);
}

output("Found SQLite Database: {$sqliteFile} (" . round(filesize($sqliteFile) / 1024, 2) . " KB)");

// 2. Connect to SQLite
try {
    $sqlite = new PDO("sqlite:{$sqliteFile}");
    $sqlite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sqlite->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    output("Successfully connected to SQLite database.");
} catch (PDOException $e) {
    output("ERROR connecting to SQLite: " . $e->getMessage());
    exit(1);
}

// 3. Connect to MySQL
$dbConfig = require __DIR__ . '/config/database.php';
try {
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $dbConfig['host'],
        $dbConfig['port'],
        $dbConfig['database'],
        $dbConfig['charset']
    );
    $mysql = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], $dbConfig['options']);
    output("Successfully connected to MySQL database: {$dbConfig['database']} on {$dbConfig['host']}");
} catch (PDOException $e) {
    output("ERROR connecting to MySQL: " . $e->getMessage());
    output("Please verify database credentials in php-backend/config/database.php or ensure MySQL service is running.");
    exit(1);
}

// 4. Disable MySQL foreign key checks during migration
$mysql->exec("SET FOREIGN_KEY_CHECKS = 0");

// Ordered tables list
$tables = [
    'roles',
    'branches',
    'users',
    'categories',
    'subcategories',
    'suppliers',
    'customers',
    'products',
    'branch_stocks',
    'cash_drawer_shifts',
    'drawer_expenses',
    'sales',
    'sale_items',
    'sales_returns',
    'sales_return_items',
    'sale_delivery_logs',
    'customer_payments',
    'purchases',
    'purchase_items',
    'supplier_payments',
    'quotations',
    'quotation_items',
    'expenses',
    'inventory_transactions',
    'stock_transfers',
    'stock_transfer_items',
    'zakat_records',
    'audit_logs',
    'settings',
];

$totalMigratedRecords = 0;

foreach ($tables as $table) {
    // Check if table exists in SQLite
    $checkStmt = $sqlite->prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?");
    $checkStmt->execute([$table]);
    if ((int)$checkStmt->fetchColumn() === 0) {
        output("[-] Table '{$table}' not found in SQLite. Skipping.");
        continue;
    }

    // Fetch all rows from SQLite
    $rows = $sqlite->query("SELECT * FROM {$table}")->fetchAll();
    $count = count($rows);

    if ($count === 0) {
        output("[0] Table '{$table}' has 0 records. Skipping.");
        continue;
    }

    // Truncate MySQL table before migrating to avoid duplicates
    try {
        $mysql->exec("TRUNCATE TABLE `{$table}`");
    } catch (PDOException $e) {
        $mysql->exec("DELETE FROM `{$table}`");
    }

    // Prepare insert statement
    $columns = array_keys($rows[0]);
    $colList = '`' . implode('`, `', $columns) . '`';
    $placeholderList = ':' . implode(', :', $columns);

    $insertSql = "INSERT INTO `{$table}` ({$colList}) VALUES ({$placeholderList})";
    $insertStmt = $mysql->prepare($insertSql);

    $inserted = 0;
    foreach ($rows as $row) {
        // Normalize ISO 8601 timestamps (e.g. 2026-09-05T06:14:28.566Z -> 2026-09-05 06:14:28)
        foreach ($row as $k => $v) {
            if (is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $v)) {
                $row[$k] = date('Y-m-d H:i:s', strtotime($v));
            }
        }

        try {
            $insertStmt->execute($row);
            $inserted++;
        } catch (PDOException $e) {
            output("  [!] Warning on {$table} row ID " . ($row['id'] ?? '?') . ": " . $e->getMessage());
        }
    }

    $totalMigratedRecords += $inserted;
    output("[+] Table '{$table}': Successfully migrated {$inserted} / {$count} records.");
}

// 5. Re-enable foreign key checks
$mysql->exec("SET FOREIGN_KEY_CHECKS = 1");

output("==================================================");
output("MIGRATION COMPLETED SUCCESSFULLY!");
output("Total Records Migrated: {$totalMigratedRecords}");
output("==================================================");
