<?php
include_once(__DIR__ . '/../configs/_configs.php');
include_once(__DIR__ . '/vendor/ClassLoader/ClassLoader.class.php');
ClassLoader::add(__DIR__);
ClassLoader::add(__DIR__ . '/vendor');

date_default_timezone_set('UTC');
Logger::setFlushCallback(function($log){
		(new DB\CdbLog())->save($log);
});
Logger::logLevel(2);

Logger::Debug('<script ip=\'%s\' time=\'%s\' script=\'%s\'/>',
	isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown',
	date('Y.m.d H:i:s'),
	$_SERVER['PHP_SELF']
);
?>