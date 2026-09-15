<?php
declare(strict_types=1);

/**
 * Hardware Store POS & ERP - Safe Incremental Database Migration Runner
 * 
 * Safe for CLI and shared hosting / cPanel environments.
 * Prevents unauthorized public access.
 * Non-destructive: Does NOT drop tables or delete production data.
 */

namespace App;

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/core/Database.php';
require_once __DIR__ . '/core/Migrator.php';
require_once __DIR__ . '/core/Auth.php';

use App\Core\Database;
use App\Core\Migrator;
use App\Core\Auth;
use PDOException;

$isCli = (php_sapi_name() === 'cli');

// 1. Enforce Authorization if executed via Web
if (!$isCli) {
    header('Content-Type: application/json; charset=utf-8');

    $authorized = false;

    // Check Bearer Token (Admin Role)
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
        $token = $matches[1];
        $session = Auth::verifySession($token);
        if ($session && strtoupper($session['role'] ?? '') === 'ADMIN') {
            $authorized = true;
        }
    }

    // Check Secret Key
    $secretKey = getenv('MIGRATION_KEY') ?: 'hs_migrate_secret_key_2026';
    $providedKey = $_GET['key'] ?? $_POST['key'] ?? '';
    if (!empty($providedKey) && hash_equals($secretKey, (string)$providedKey)) {
        $authorized = true;
    }

    if (!$authorized) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized access to database migration runner. Please provide an Admin Bearer token or valid migration secret key.',
        ], JSON_PRETTY_PRINT);
        exit;
    }
}

// 2. Connect to Database & Run Migrator
try {
    $pdo = Database::getConnection();
    $migrator = new Migrator($pdo, __DIR__ . '/migrations');

    $action = $isCli ? ($argv[1] ?? '--run') : ($_GET['action'] ?? 'run');

    if ($action === '--status' || $action === 'status') {
        $status = $migrator->getStatus();
        if ($isCli) {
            echo "==================================================\n";
            echo "DATABASE MIGRATION STATUS\n";
            echo "==================================================\n";
            echo "Total Migration Files: " . $status['total_files'] . "\n";
            echo "Applied Migrations:    " . $status['applied_count'] . "\n";
            echo "Pending Migrations:    " . $status['pending_count'] . "\n";
            if (!empty($status['pending'])) {
                echo "\nPending:\n";
                foreach ($status['pending'] as $p) {
                    echo "  - {$p}\n";
                }
            } else {
                echo "\nAll migrations are up to date.\n";
            }
        } else {
            echo json_encode([
                'success' => true,
                'status' => $status,
            ], JSON_PRETTY_PRINT);
        }
        exit(0);
    }

    // Run pending migrations
    $results = $migrator->runPending();

    if ($isCli) {
        echo "==================================================\n";
        echo "HARDWARE STORE DATABASE MIGRATIONS\n";
        echo "==================================================\n";
        if (empty($results['applied']) && empty($results['errors'])) {
            echo "No pending migrations found. Database is already up to date.\n";
        } else {
            foreach ($results['applied'] as $mig) {
                echo "[SUCCESS] Applied: {$mig}\n";
            }
            foreach ($results['errors'] as $err) {
                echo "[ERROR] Failed: " . json_encode($err) . "\n";
            }
        }
    } else {
        echo json_encode([
            'success' => empty($results['errors']),
            'message' => empty($results['errors']) 
                ? (empty($results['applied']) ? 'Database is up to date.' : 'Migrations applied successfully.') 
                : 'Migration execution encountered errors.',
            'results' => $results,
            'current_status' => $migrator->getStatus(),
        ], JSON_PRETTY_PRINT);
    }

} catch (PDOException $e) {
    if ($isCli) {
        echo "[FATAL PDO ERROR]: " . $e->getMessage() . "\n";
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database connection or query failure.',
            'error' => $e->getMessage(),
        ]);
    }
    exit(1);
} catch (\Throwable $t) {
    if ($isCli) {
        echo "[FATAL ERROR]: " . $t->getMessage() . "\n";
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Migration runner error: ' . $t->getMessage(),
        ]);
    }
    exit(1);
}
