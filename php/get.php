<?php
/**
 * OrangePOS — Local Snapshot Reader
 *
 * The dashboard (dashboard.html) polls this endpoint to get the latest
 * data snapshot pushed by OrangePOS via sync.php.
 */

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');

$file = __DIR__ . '/data/snapshot.json';

if (!file_exists($file)) {
    echo json_encode(['_empty' => true, 'message' => 'No data synced yet. Use OrangePOS at least once on the till.']);
    exit;
}

readfile($file);