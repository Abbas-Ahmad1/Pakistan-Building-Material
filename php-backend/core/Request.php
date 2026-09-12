<?php
declare(strict_types=1);

namespace App\Core;

class Request
{
    private array $queryParams;
    private array $bodyParams;
    private array $headers;

    public function __construct()
    {
        $this->queryParams = $_GET;
        $this->headers = $this->extractHeaders();
        $this->bodyParams = $this->extractBody();
    }

    /**
     * Get query parameter or all query parameters
     */
    public function query(?string $key = null, mixed $default = null): mixed
    {
        if ($key === null) {
            return $this->queryParams;
        }
        return $this->queryParams[$key] ?? $default;
    }

    /**
     * Get body field or all body parameters
     */
    public function body(?string $key = null, mixed $default = null): mixed
    {
        if ($key === null) {
            return $this->bodyParams;
        }
        return $this->bodyParams[$key] ?? $default;
    }

    /**
     * Get all input parameters combined (query + body)
     */
    public function all(): array
    {
        return array_merge($this->queryParams, $this->bodyParams);
    }

    /**
     * Get specific header value
     */
    public function header(string $name, ?string $default = null): ?string
    {
        $normalized = strtolower($name);
        return $this->headers[$normalized] ?? $default;
    }

    /**
     * Extract Bearer token with full cPanel/Apache fallback support
     */
    public function getBearerToken(): ?string
    {
        $auth = $this->header('authorization');

        if (!$auth) {
            // Check Apache / cPanel server environment variables
            if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
                $auth = $_SERVER['HTTP_AUTHORIZATION'];
            } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
                $auth = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
            }
        }

        if ($auth && preg_match('/Bearer\s+(\S+)/i', $auth, $matches)) {
            return $matches[1];
        }

        // Fallback: check query parameter ?token=
        if (!empty($this->queryParams['token'])) {
            return (string)$this->queryParams['token'];
        }

        return null;
    }

    /**
     * Get real client IP address
     */
    public function getClientIp(): string
    {
        $ipKeys = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_CLIENT_IP',
            'REMOTE_ADDR'
        ];

        foreach ($ipKeys as $key) {
            if (!empty($_SERVER[$key])) {
                $ips = explode(',', $_SERVER[$key]);
                return trim($ips[0]);
            }
        }

        return '127.0.0.1';
    }

    /**
     * Extract normalized headers
     */
    private function extractHeaders(): array
    {
        $headers = [];

        if (function_exists('getallheaders')) {
            $raw = getallheaders();
            if ($raw !== false) {
                foreach ($raw as $key => $val) {
                    $headers[strtolower((string)$key)] = (string)$val;
                }
            }
        }

        foreach ($_SERVER as $key => $val) {
            if (str_starts_with($key, 'HTTP_')) {
                $headerName = strtolower(str_replace('_', '-', substr($key, 5)));
                if (!isset($headers[$headerName])) {
                    $headers[$headerName] = (string)$val;
                }
            }
        }

        if (!empty($_SERVER['CONTENT_TYPE']) && !isset($headers['content-type'])) {
            $headers['content-type'] = $_SERVER['CONTENT_TYPE'];
        }

        return $headers;
    }

    /**
     * Parse raw request body (JSON or multipart/form-data)
     */
    private function extractBody(): array
    {
        $contentType = $this->header('content-type', '');

        if (str_contains($contentType, 'application/json')) {
            $rawInput = file_get_contents('php://input');
            if (!empty($rawInput)) {
                $data = json_decode($rawInput, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
                    return $data;
                }
            }
            return [];
        }

        return $_POST;
    }
}
