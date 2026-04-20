<?php
/*
 * NEJstudios — File Upload API
 *
 * POST multipart/form-data with field "file"
 *   → { "ok": true, "url": "/uploads/filename.ext", "name": "original.jpg" }
 *
 * POST ?action=delete&file=filename.ext
 *   → { "ok": true }
 *
 * On error: { "ok": false, "error": "reason" }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ── Config ─────────────────────────────────────────────────────────────────
define('MAX_SIZE',       20 * 1024 * 1024); // 20 MB
define('ALLOWED_EXTS',  ['jpg','jpeg','png','webp','gif','heic','heif']);
define('ALLOWED_MIMES', [
    'image/jpeg',
    'image/jpg',   // non-standard but returned by some systems
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/heic-sequence',
    'image/heif-sequence',
]);

// Raise PHP upload limits — shared cPanel hosting often defaults to 2–8 MB
@ini_set('upload_max_filesize', '25M');
@ini_set('post_max_size',       '30M');
@ini_set('memory_limit',        '128M');

// Uploads dir is one level up from api/, sibling of index.html
// Use dirname() — realpath() returns false if directory doesn't exist yet
$uploadsDir = dirname(__DIR__) . '/uploads';

// ── Ensure uploads directory exists ────────────────────────────────────────
if (!is_dir($uploadsDir)) {
    if (!mkdir($uploadsDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not create uploads directory at: ' . $uploadsDir]);
        exit;
    }
    // Prevent directory listing
    file_put_contents($uploadsDir . '/.htaccess', "Options -Indexes\nDeny from all\n<FilesMatch \"\.(jpg|jpeg|png|webp|gif|heic|heif)$\">\n  Allow from all\n</FilesMatch>\n");
}

// ── Helper: safe filename check (no path traversal) ────────────────────────
function isSafeFilename($name) {
    // Only allow alphanumeric, underscores, hyphens, dots — no slashes, no null bytes
    return $name && preg_match('/^[a-zA-Z0-9_\-\.]+$/', $name) && strpos($name, '..') === false;
}

// ── Route: DELETE action ────────────────────────────────────────────────────
$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'delete') {
    $filename = isset($_GET['file']) ? basename($_GET['file']) : '';

    if (!$filename || !isSafeFilename($filename)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid filename']);
        exit;
    }

    $target = $uploadsDir . '/' . $filename;

    // Only delete files that exist inside the uploads dir (extra safety check)
    if (!file_exists($target) || realpath($target) !== realpath($uploadsDir) . '/' . $filename) {
        // Not found — treat as success (idempotent delete)
        echo json_encode(['ok' => true]);
        exit;
    }

    if (unlink($target)) {
        echo json_encode(['ok' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not delete file']);
    }
    exit;
}

// ── Route: Upload ───────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

if (empty($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No file received']);
    exit;
}

$f = $_FILES['file'];

// Check for upload errors
if ($f['error'] !== UPLOAD_ERR_OK) {
    $phpErrors = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds form size limit',
        UPLOAD_ERR_PARTIAL    => 'File upload was incomplete',
        UPLOAD_ERR_NO_FILE    => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
        UPLOAD_ERR_EXTENSION  => 'Upload blocked by server extension',
    ];
    $errMsg = isset($phpErrors[$f['error']]) ? $phpErrors[$f['error']] : 'Upload error ' . $f['error'];
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $errMsg]);
    exit;
}

// Check size
if ($f['size'] > MAX_SIZE) {
    http_response_code(413);
    echo json_encode(['ok' => false, 'error' => 'File exceeds 20 MB limit']);
    exit;
}

// Validate extension
$originalName = $f['name'];
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
if (!in_array($ext, ALLOWED_EXTS)) {
    http_response_code(415);
    echo json_encode(['ok' => false, 'error' => 'File type not allowed. Accepted: JPG, PNG, WEBP, GIF, HEIC, HEIF']);
    exit;
}

// Validate MIME type (using finfo for reliability)
$finfo    = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($f['tmp_name']);
if (!in_array($mimeType, ALLOWED_MIMES)) {
    http_response_code(415);
    echo json_encode(['ok' => false, 'error' => 'Invalid file content (MIME: ' . $mimeType . ')']);
    exit;
}

// Generate unique filename: {timestamp}_{random8}.{ext}
$random   = substr(bin2hex(random_bytes(4)), 0, 8);
$newName  = time() . '_' . $random . '.' . $ext;
$target   = $uploadsDir . '/' . $newName;

if (!move_uploaded_file($f['tmp_name'], $target)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not save file']);
    exit;
}

// Set readable permissions
chmod($target, 0644);

echo json_encode([
    'ok'   => true,
    'url'  => '/uploads/' . $newName,
    'name' => $originalName,
]);
