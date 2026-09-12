<?php
declare(strict_types=1);

/**
 * Global Application Configuration
 */

return [
    'app_name'        => 'Hardware Store POS & ERP',
    'timezone'        => getenv('APP_TIMEZONE') ?: 'Asia/Karachi',
    'session_lifetime'=> (int)(getenv('SESSION_LIFETIME') ?: 604800), // 7 days in seconds
    'upload_dir'      => __DIR__ . '/../uploads',
    'upload_url'      => '/uploads',
    'cors' => [
        'allowed_origins' => explode(',', getenv('CORS_ORIGINS') ?: '*'),
        'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
        'max_age'         => 86400,
    ],
];
