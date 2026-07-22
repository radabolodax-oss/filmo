# backups/

Local, machine-specific backups of the `movix` MySQL database and Memurai/Redis
cache — generated ad hoc before risky operations (e.g. switching from native
MySQL/Memurai to the Docker-based ones in `docker-compose.yml`).

**Never committed** — `.sql` and `.rdb` files here are gitignored on purpose,
they can contain real user data and secrets.

## Regenerate

```bash
# MySQL dump (full data)
mysqldump -h localhost -P 3306 -u movix -p --routines --triggers --single-transaction movix > backups/movix_mysql_$(date +%Y%m%d_%H%M%S).sql

# Memurai/Redis RDB snapshot
"C:\Program Files\Memurai\memurai-cli.exe" -h 127.0.0.1 -p 6379 BGSAVE
# then copy the resulting dump.rdb from the Memurai install dir here
```

## Restore

```bash
mysql -h localhost -P 3306 -u movix -p movix < backups/movix_mysql_<timestamp>.sql
```

For the Redis/Memurai RDB file, stop the server, replace its `dump.rdb`, restart.

For a schema-only (no data) init script meant to be versioned, see
`API/Mainapi/exportscripts/schema_full_init.sql` instead — that one *is* committed.
