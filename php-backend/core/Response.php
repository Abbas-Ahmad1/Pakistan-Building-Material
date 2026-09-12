<?php
declare(strict_types=1);

namespace App\Core;

class Response
{
    /**
     * Send JSON response
     */
    public static function json(mixed $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Send successful response
     */
    public static function success(mixed $data = null, string $message = '', int $status = 200, array $extra = []): void
    {
        $payload = [
            'success' => true,
        ];

        if ($message !== '') {
            $payload['message'] = $message;
        }

        if ($data !== null) {
            $payload['data'] = $data;
        }

        foreach ($extra as $key => $val) {
            $payload[$key] = $val;
        }

        self::json($payload, $status);
    }

    /**
     * Send error response
     */
    public static function error(string $message, int $status = 400, mixed $data = null): void
    {
        $payload = [
            'success' => false,
            'message' => $message,
        ];

        if ($data !== null) {
            $payload['data'] = $data;
        }

        self::json($payload, $status);
    }
}
