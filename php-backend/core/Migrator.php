<?php
declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;
use RuntimeException;

class Migrator
{
    private PDO $pdo;
    private string $migrationsDir;

    public function __construct(PDO $pdo, ?string $migrationsDir = null)
    {
        $this->pdo = $pdo;
        $this->migrationsDir = $migrationsDir ?: dirname(__DIR__) . '/migrations';

        if (!is_dir($this->migrationsDir)) {
            mkdir($this->migrationsDir, 0755, true);
        }

        $this->ensureMigrationsTable();
    }

    /**
     * Ensure the tracking table exists
     */
    public function ensureMigrationsTable(): void
    {
        $sql = "
            CREATE TABLE IF NOT EXISTS `schema_migrations` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `migration` VARCHAR(255) NOT NULL UNIQUE,
                `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ";
        $this->pdo->exec($sql);
    }

    /**
     * Get list of already applied migrations
     */
    public function getAppliedMigrations(): array
    {
        $stmt = $this->pdo->query("SELECT `migration`, `applied_at` FROM `schema_migrations` ORDER BY `id` ASC");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get list of applied migration filenames
     */
    public function getAppliedMigrationNames(): array
    {
        $applied = $this->getAppliedMigrations();
        return array_column($applied, 'migration');
    }

    /**
     * Get all migration files from the migrations folder
     */
    public function getAllMigrationFiles(): array
    {
        if (!is_dir($this->migrationsDir)) {
            return [];
        }

        $files = glob($this->migrationsDir . '/*.sql');
        if ($files === false) {
            return [];
        }

        $migrations = array_map('basename', $files);
        sort($migrations, SORT_NATURAL);
        return $migrations;
    }

    /**
     * Get pending migrations
     */
    public function getPendingMigrations(): array
    {
        $all = $this->getAllMigrationFiles();
        $applied = $this->getAppliedMigrationNames();

        return array_values(array_diff($all, $applied));
    }

    /**
     * Run all pending migrations
     */
    public function runPending(): array
    {
        $pending = $this->getPendingMigrations();
        $results = [
            'total' => count($pending),
            'applied' => [],
            'errors' => [],
        ];

        if (empty($pending)) {
            return $results;
        }

        foreach ($pending as $migrationFile) {
            $filePath = $this->migrationsDir . '/' . $migrationFile;
            $sql = file_get_contents($filePath);

            if ($sql === false) {
                $results['errors'][] = "Unable to read migration file: {$migrationFile}";
                break;
            }

            try {
                $this->executeMigrationSql($sql);

                // Record into schema_migrations
                $stmt = $this->pdo->prepare("INSERT INTO `schema_migrations` (`migration`) VALUES (?)");
                $stmt->execute([$migrationFile]);

                $results['applied'][] = $migrationFile;
            } catch (\Throwable $e) {
                $results['errors'][] = [
                    'migration' => $migrationFile,
                    'error' => $e->getMessage(),
                ];
                // Halt on first failure to prevent subsequent broken migrations
                break;
            }
        }

        return $results;
    }

    /**
     * Execute SQL statements from a migration file
     */
    private function executeMigrationSql(string $sql): void
    {
        // Remove SQL comments and split by semicolon
        $cleanedSql = preg_replace('/--.*$/m', '', $sql);
        $cleanedSql = preg_replace('/\/\*.*?\*\//s', '', $cleanedSql ?? '');

        $statements = array_filter(
            array_map('trim', explode(';', $cleanedSql ?? '')),
            fn($stmt) => $stmt !== ''
        );

        foreach ($statements as $statement) {
            $this->pdo->exec($statement);
        }
    }

    /**
     * Get system migration status report
     */
    public function getStatus(): array
    {
        $all = $this->getAllMigrationFiles();
        $applied = $this->getAppliedMigrations();
        $appliedNames = array_column($applied, 'migration');
        $pending = array_values(array_diff($all, $appliedNames));

        return [
            'total_files' => count($all),
            'applied_count' => count($applied),
            'pending_count' => count($pending),
            'applied' => $applied,
            'pending' => $pending,
        ];
    }
}
