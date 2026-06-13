<?php
/**
 * OrangePOS — Local Snapshot Receiver
 *
 * OrangePOS (running on the Orange Pi) POSTs its full data snapshot
 * here every time something changes. The snapshot is saved to a local
 * JSON file, which the read-only dashboard (dashboard.html) polls.
 *
 * This runs entirely on the local network — no internet required.
 */

header('Content-Type: application/json');

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if ($data === null) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// Add a server-side timestamp so the dashboard can show "last updated"
$data['_receivedAt'] = date('c');

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0775, true);
}

$file = $dataDir . '/snapshot.json';
$tmpFile = $file . '.tmp';

// Write atomically: write to temp file, then rename
$bytes = file_put_contents($tmpFile, json_encode($data));
if ($bytes === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write snapshot']);
    exit;
}
rename($tmpFile, $file);

echo json_encode(['status' => 'ok', 'receivedAt' => $data['_receivedAt']]);