<?php
class Logger{
	private $minLogLevel = 2;
	private $needLog = false;
	private $cache = '';
	private $flushMethod = null;
	private $startTime;

	private function __construct(){
		$this->startTime = microtime(true);
	}
	
	private function __clone(){
		trigger_error('Cloning of logger', E_USER_ERROR);
	}
	
	public static function get(){
		static $inst = null;
		if(null === $inst) $inst = new self();
		return $inst;
	}
	
	public static function Info()	{ Logger::get()->logData(func_get_args(), 0);	}
	public static function Debug()	{ Logger::get()->logData(func_get_args(), 1);	}
	public static function Warning(){ Logger::get()->logData(func_get_args(), 2);	}
	public static function Error()	{ Logger::get()->doError(func_get_args());	}
	
	public static function setFlushCallback($f)	{
		Logger::get()->flushMethod = $f;
	}
	public static function logLevel($minLogLevel){
		Logger::get()->minLogLevel = $minLogLevel;
	}

	public static function time() {
		return (microtime(true) - Logger::get()->startTime) * 1000;
	}
	private function logData($inArr, $lvl){
		$this->cache .= $this->process($inArr, $lvl);
		$this->needLog |= $this->minLogLevel <= $lvl;
	}
	private function process($inArr, $lvl){
		$text = array_shift($inArr);
		if(count($inArr) > 0)
			$text = vsprintf($text, $inArr);
		return sprintf(
			'<log lvl=\'%d\' time=\'%f\'>%s</log>', 
			$lvl, $this->time(), $text
		);
	}
	
	public function onShutdown(){
		if($this->needLog)
		    call_user_func($this->flushMethod, $this->cache);
	}
	
	private function doError($inArr){
		$this->logData($inArr, 3);
		$this->trace();
	}
	
	public static function trace(){
		$data = '';
		$trace = debug_backtrace();
		$notIgnore = false;
		$tabs = '';
		foreach($trace as $t){
			if(isset($t['file'])){
				$fn = basename($t['file']);
				if($notIgnore || ($fn !== 'Logger.class.php')){
					$notIgnore = true;
					$args = $comma = '';
					foreach($t['args'] as $arg){
						if(is_string($arg)){
							$arg = '\'$arg\'';
						}
						if(is_array($arg)){
							$arg = 'Array';
						}
						if(is_object($arg)){
							$arg = 'Object';
						}
						$args .= $comma . $arg;
						$comma = ', ';
					}
					
					$class = isset($t['class']) ? ($t['class'] . '::') : '';
					$caller = sprintf('%s%s(%s)', $class, $t['function'], $args);
					$data .= sprintf('\n%s%s (%s) : %s', $tabs, $fn, $t['line'], $caller);
					$tabs .= '  ';
				}
			}
		}
		
		Logger::Debug($data);
	}
}

function __onError($errno, $errstr, $errfile, $errline){
	Logger::Error('Error #%d: %s (%s : %d)', $errno, $errstr, $errfile, $errline);
	Logger::get()->onShutdown();
//		ob_end_clean(); // fix this
	exit;
}

function __onShutdown(){
	$error = error_get_last();
	if(isset($error))
		__onError($error['type'], $error['message'], $error['file'], $error['line']);
	Logger::get()->onShutdown();
}

set_error_handler('__onError');
register_shutdown_function('__onShutdown');
?>