<?php namespace Database;

class CdbNotifies extends \DB\CdbBase {
  public function __construct() {
    parent::__construct();
  }

    public function saveData($data) {
        $this->_db->query("INSERT INTO Notify (data) VALUES (?s)", $data);
    }
}
?>
