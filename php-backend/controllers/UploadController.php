<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;

class UploadController
{
    /**
     * POST /api/upload
     */
    public function upload(Request $request, array $params = []): void
    {
        Auth::requireAuth($request);

        // Check if image URL was sent in JSON
        $imageUrl = $request->body('image_url');
        if ($imageUrl) {
            Response::success(['url' => (string)$imageUrl], 'Image URL saved');
            return;
        }

        if (empty($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
            Response::error('No image file uploaded.', 400);
            return;
        }

        $file = $_FILES['image'];
        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, $allowedMimes, true)) {
            Response::error('Invalid file type. Only JPG, PNG, WEBP, and GIF images are allowed.', 400);
            return;
        }

        // Max file size: 5MB
        if ($file['size'] > 5 * 1024 * 1024) {
            Response::error('File size exceeds maximum limit of 5MB.', 400);
            return;
        }

        $extensionMap = [
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp',
            'image/gif'  => 'gif',
        ];
        $ext = $extensionMap[$mime] ?? 'jpg';

        $uploadDir = __DIR__ . '/../uploads/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $filename = 'prod_' . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
        $destination = $uploadDir . $filename;

        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            Response::error('Failed to move uploaded file to destination.', 500);
            return;
        }

        $publicUrl = '/uploads/' . $filename;

        Response::success([
            'url'      => $publicUrl,
            'filename' => $filename,
        ], 'Image uploaded successfully');
    }
}
