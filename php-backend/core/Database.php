<?php
declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $instance = null;

    /**
     * Get singleton PDO connection instance
     */
    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $config = require __DIR__ . '/../config/database.php';
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                $config['host'],
                $config['port'],
                $config['database'],
                $config['charset']
            );

            try {
                self::$instance = new PDO(
                    $dsn,
                    $config['username'],
                    $config['password'],
                    $config['options']
                );
            } catch (PDOException $e) {
                Response::json([
                    'success' => false,
                    'message' => 'Database connection failed: ' . $e->getMessage(),
                ], 500);
                exit;
            }
        }

        return self::$instance;
    }

    /**
     * Start a database transaction
     */
    public static function beginTransaction(): bool
    {
        $pdo = self::getConnection();
        if (!$pdo->inTransaction()) {
            return $pdo->beginTransaction();
        }
        return true;
    }

    /**
     * Commit active transaction
     */
    public static function commit(): bool
    {
        $pdo = self::getConnection();
        if ($pdo->inTransaction()) {
            return $pdo->commit();
        }
        return true;
    }

    /**
     * Rollback active transaction
     */
    public static function rollBack(): bool
    {
        $pdo = self::getConnection();
        if ($pdo->inTransaction()) {
            return $pdo->rollBack();
        }
        return true;
    }

    /**
     * Execute a statement with parameters
     */
    public static function execute(string $sql, array $params = []): bool
    {
        $stmt = self::getConnection()->prepare($sql);
        return $stmt->execute($params);
    }

    /**
     * Fetch all rows
     */
    public static function fetchAll(string $sql, array $params = []): array
    {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Fetch single row
     */
    public static function fetchOne(string $sql, array $params = []): ?array
    {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row !== false ? $row : null;
    }

    /**
     * Fetch single scalar value
     */
    public static function fetchValue(string $sql, array $params = []): mixed
    {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    /**
     * Get last insert ID
     */
    public static function lastInsertId(): int
    {
        return (int)self::getConnection()->lastInsertId();
    }
}
