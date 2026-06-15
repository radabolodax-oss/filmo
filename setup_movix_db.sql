CREATE DATABASE IF NOT EXISTS movix;
CREATE USER IF NOT EXISTS 'movix'@'localhost' IDENTIFIED BY 'movix_pass';
GRANT ALL PRIVILEGES ON movix.* TO 'movix'@'localhost';
FLUSH PRIVILEGES;
SELECT 'Done! movix user created.' AS result;
