<?php namespace DB;
class CdbBase {
	private static $_globalDB = null;
	protected $_db = null;

	private static function Options() {
		return array_merge(
			\CONFIGS::DB(),
			array('errmode' => 'exception')
		);
	}

	protected function __construct() {
		if(null === self::$_globalDB)
			self::$_globalDB = new SafeMySQL(self::Options());
		$this->_db = self::$_globalDB;
	}
}
?>