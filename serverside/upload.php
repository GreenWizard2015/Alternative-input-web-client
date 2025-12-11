<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if (!isset($_FILES['chunk'])) {
    echo json_encode(["success" => "false", "error" => "No chunk uploaded."]);
    exit(0);
}

// $_FILES['chunk']['tmp_name'] holds the temporary path of the uploaded file
$filePath = $_FILES['chunk']['tmp_name'];

// Ensure the file actually exists before attempting to read it
if (!file_exists($filePath)) {
    echo json_encode(["success" => "false", "error" => "Uploaded file not found."]);
    exit(0);
}

// Read the binary data from the file
$binaryData = file_get_contents($filePath);

if ($binaryData === false) {
    echo json_encode(["success" => "false", "error" => "Failed to read the uploaded file."]);
    exit(0);
}

$encoded_chunk = gzencode($binaryData, 5);

do {
  $uuid = get_guid();
  $filePath = __DIR__ . "/chunks/$uuid.gz";
} while (file_exists($filePath));

file_put_contents($filePath, $encoded_chunk);
// calculate the total number of chunks
$files = glob(__DIR__ . "/chunks/*.gz");
$total = count($files);
echo json_encode([ "success" => true, "total" => $total ]);

exit(0);

function get_guid(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);    // Set version to 0100
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);    // Set bits 6-7 to 10
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

?>