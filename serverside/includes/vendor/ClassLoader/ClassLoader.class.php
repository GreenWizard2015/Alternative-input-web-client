<?php
class ClassLoader {
    private static $_paths = [];
    private static $_extensions = ['.class.php', '.php', '.inc.php'];

    public static function add($path) {
        self::$_paths[] = $path;
    }

    public static function addExtension($extension) {
        if (!in_array($extension, self::$_extensions)) {
            self::$_extensions[] = $extension;
        }
    }

    public static function load($class) {
        $file = str_replace('\\', DIRECTORY_SEPARATOR, $class);
        if (DIRECTORY_SEPARATOR != $file[1])
            $file = DIRECTORY_SEPARATOR . $file;
        
        foreach (self::$_extensions as $extension) {
            foreach (self::$_paths as $dir) {
                $path = $dir . $file . $extension;
                if (is_readable($path)) {
                    include_once($path);
                    return true;
                }
            }
        }
        
        return false;
    }
}

spl_autoload_register(__NAMESPACE__ . '\ClassLoader::load');
?>
