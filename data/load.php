<?php
/**
 * OrangePOS — Database Load Endpoint
 *
 * Returns the saved database JSON file. Called by OrangePOS on every
 * startup to restore all data (products, orders, customers, settings,
 * shifts, stock log, audit log, users) from the filesystem.
 *
 * If no database file exists yet (first run), returns a JSON object
 * with _empty: true so OrangePOS knows to seed default data.
 *
 * Also serves the .bak file as a fallback if the main file is corrupt.
 */

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Access-Control-Allow-Origin: *');

$dbFile  = __DIR__ . '/database.json';
$bakFile = __DIR__ . '/database.json.bak';

// Try main database file first
if (file_exists($dbFile)) {
    $content = file_get_contents($dbFile);
    $parsed  = json_decode($content, true);

    if ($parsed !== null) {
        // Valid JSON — serve it
        echo $content;
        exit;
    }

    // Main file is corrupt — try the backup
    if (file_exists($bakFile)) {
        $bakContent = file_get_contents($bakFile);
        $bakParsed  = json_decode($bakContent, true);
        if ($bakParsed !== null) {
            // Restore backup as main file
            copy($bakFile, $dbFile);
            echo json_encode(array_merge($bakParsed, [
                '_restoredFromBackup' => true,
                '_warning' => 'Main database was corrupt. Restored from backup.'
            ]));
            exit;
        }
    }

    // Both corrupt
    http_response_code(500);
    echo json_encode(['error' => 'Database file is corrupt and backup is unavailable.']);
    exit;
}

// No database file yet — first run
echo json_encode(['_empty' => true]);