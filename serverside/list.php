<?php
$directoryPath = "chunks";

$baseUrl = "http://" . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']) . "/chunks";

$gzFiles = glob($directoryPath . "/*.gz");

$gzUrls = array_map(fn($filePath) => $baseUrl . '/' . basename($filePath), $gzFiles);

echo json_encode($gzUrls);
?>
