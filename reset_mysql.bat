@echo off
net stop MySQL80
timeout /t 2 /nobreak
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.0\my.ini" --init-file="C:\Users\PC\Desktop\prowler\MovixOpenSource-main\reset_mysql_root.sql" --console --skip-grant-tables &
timeout /t 5 /nobreak
net start MySQL80
echo Done.
