<?php
declare(strict_types=1);

/**
 * Global Application Configuration
 */

$corsOriginsRaw = getenv('CORS_ORIGINS');
$allowedOrigins = $corsOriginsRaw 
    ? array_map('trim', explode(',', $corsOriginsRaw))
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'];

return [
    'app_name'        => 'Hardware Store POS & ERP',
    'timezone'        => getenv('APP_TIMEZONE') ?: 'Asia/Karachi',
    'session_lifetime'=> (int)(getenv('SESSION_LIFETIME') ?: 604800), // 7 days in seconds
    'migration_key'   => getenv('MIGRATION_KEY') ?: 'hs_migrate_secret_key_2026',
    'upload_dir'      => __DIR__ . '/../uploads',
    'upload_url'      => '/uploads',
    'cors' => [
        'allowed_origins' => $allowedOrigins,
        'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
        'max_age'         => 86400,
    ],
];
