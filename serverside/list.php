<?php
$directoryPath = "chunks";

$baseUrl = "http://vksf.com.ru.host1617252.serv21.hostland.pro/AI/chunks";

$gzFiles = glob($directoryPath . "/*.gz");

$gzUrls = array_map(function($filePath) use ($baseUrl, $directoryPath) {
    return $baseUrl . '/' . basename($filePath);
}, $gzFiles);

echo json_encode($gzUrls);
?>
