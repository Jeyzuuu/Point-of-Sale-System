<?php
/**
 * OrangePOS — Database Save Endpoint
 *
 * Receives the full database from OrangePOS and writes it to a JSON
 * file on the server filesystem. This is the primary data store —
 * much more reliable than browser localStorage which can be wiped
 * by browser updates, cache clears, or OS reconfigurations.
 *
 * File location: /var/www/html/orangepos/data/database.json
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
if (!$raw) {
    http_response_code(400);
    echo json_encode(['error' => 'Empty body']);
    exit;
}

$data = json_decode($raw, true);
if ($data === null) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON: ' . json_last_error_msg()]);
    exit;
}

$dataDir = __DIR__;
$dbFile  = $dataDir . '/database.json';
$tmpFile = $dbFile . '.tmp';
$bakFile = $dbFile . '.bak';

// Write atomically: tmp → rename (prevents partial writes from corrupting the file)
$bytes = file_put_contents($tmpFile, json_encode($data, JSON_PRETTY_PRINT));
if ($bytes === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write database file. Check folder permissions.']);
    exit;
}

// Keep a rolling backup of the previous version
if (file_exists($dbFile)) {
    copy($dbFile, $bakFile);
}

// Atomic rename — either the full file exists or the old one does, never a partial write
if (!rename($tmpFile, $dbFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to rename temp file']);
    exit;
}

echo json_encode([
    'status' => 'ok',
    'bytes'  => $bytes,
    'savedAt' => date('c'),
]);