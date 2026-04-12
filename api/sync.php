<?php
/*
 * NEJstudios — Server Sync API
 * Stores bookings, schedule, and tasks as JSON files on the server.
 * This lets all devices (admin, team, clients) share the same data.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// Allowed resources
$allowed  = ['bookings', 'schedule', 'tasks'];
$resource = isset($_GET['resource']) ? preg_replace('/[^a-z_]/', '', $_GET['resource']) : '';

if (!in_array($resource, $allowed)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid resource']);
    exit;
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) { mkdir($dataDir, 0755, true); }

$file = $dataDir . '/' . $resource . '.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Return saved data, or empty array
    echo file_exists($file) ? file_get_contents($file) : '[]';

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    // Validate JSON
    json_decode($body);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }
    // Write atomically
    $tmp = $file . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $body, LOCK_EX) !== false) {
        rename($tmp, $file);
        echo json_encode(['ok' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Could not write data']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
