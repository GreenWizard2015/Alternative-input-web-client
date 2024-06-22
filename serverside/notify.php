<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');
set_time_limit(120);
include('includes/_preconfigure.php');

$db = new Database\CdbNotifies();
$db->saveData(file_get_contents('php://input'));
echo file_get_contents('php://input');
?>