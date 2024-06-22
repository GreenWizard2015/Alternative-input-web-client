<?php namespace DB;
class CdbLog extends CdbBase {
  public function __construct(){
    parent::__construct();
  }

	public function save($data){
		$DB = $this->_db;
		$DB->ignoreOneQuery();
		$DB->query('INSERT INTO Log (Data) VALUES (?s)', $data);
	}
}
?>
