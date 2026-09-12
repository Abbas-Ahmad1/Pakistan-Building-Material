<?php
declare(strict_types=1);

namespace App\Core;

class Router
{
    private array $routes = [];

    public function get(string $path, callable|array $handler): void
    {
        $this->addRoute('GET', $path, $handler);
    }

    public function post(string $path, callable|array $handler): void
    {
        $this->addRoute('POST', $path, $handler);
    }

    public function put(string $path, callable|array $handler): void
    {
        $this->addRoute('PUT', $path, $handler);
    }

    public function patch(string $path, callable|array $handler): void
    {
        $this->addRoute('PATCH', $path, $handler);
    }

    public function delete(string $path, callable|array $handler): void
    {
        $this->addRoute('DELETE', $path, $handler);
    }

    public function options(string $path, callable|array $handler): void
    {
        $this->addRoute('OPTIONS', $path, $handler);
    }

    private function addRoute(string $method, string $path, callable|array $handler): void
    {
        // Normalize path: ensure leading slash, remove trailing slash
        $normalizedPath = '/' . trim($path, '/');
        if ($normalizedPath === '//') {
            $normalizedPath = '/';
        }

        // Convert route like /api/sales/{id}/delivery to regex: #^/api/sales/([^/]+)/delivery$#
        $regex = preg_replace('#\{([a-zA-Z0-9_]+)\}#', '(?P<$1>[^/]+)', $normalizedPath);
        $regex = '#^' . $regex . '$#';

        $this->routes[] = [
            'method'  => $method,
            'path'    => $normalizedPath,
            'regex'   => $regex,
            'handler' => $handler,
        ];
    }

    public function dispatch(string $method, string $uri, Request $request): void
    {
        // Clean URI: remove query string
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';

        // Normalize slashes
        $path = '/' . trim($path, '/');
        if ($path === '//') {
            $path = '/';
        }

        // Strip subfolder if app is located in /subfolder/api
        // E.g., if path is /hardware_store/api/products or /api/products
        // Match either with or without prefix
        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            if (preg_match($route['regex'], $path, $matches)) {
                $params = [];
                foreach ($matches as $key => $value) {
                    if (is_string($key)) {
                        $params[$key] = $value;
                    }
                }

                $this->executeHandler($route['handler'], $request, $params);
                return;
            }
        }

        // Fallback: If uri begins with a subfolder or /api, try relative match
        // e.g. /php-backend/api/products -> /api/products
        if (preg_match('#(/api/.*)$#', $path, $apiMatches)) {
            $subPath = $apiMatches[1];
            foreach ($this->routes as $route) {
                if ($route['method'] !== $method) {
                    continue;
                }

                if (preg_match($route['regex'], $subPath, $matches)) {
                    $params = [];
                    foreach ($matches as $key => $value) {
                        if (is_string($key)) {
                            $params[$key] = $value;
                        }
                    }

                    $this->executeHandler($route['handler'], $request, $params);
                    return;
                }
            }
        }

        Response::error("Route not found: [{$method}] {$path}", 404);
    }

    private function executeHandler(callable|array $handler, Request $request, array $params): void
    {
        if (is_array($handler)) {
            [$class, $method] = $handler;
            $instance = new $class();
            $instance->$method($request, $params);
        } else {
            $handler($request, $params);
        }
    }
}
