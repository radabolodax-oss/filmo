# backups/

Backups of the `movix` MySQL database and Memurai/Redis cache.

- **Plaintext** `.sql` / `.rdb` — gitignored, local-only, never leave this machine
  unless you copy them somewhere yourself. Real user data and secrets, don't commit.
- **Encrypted** `.sql.age` / `.rdb.age` — safe to commit (this is the point of
  encrypting them: they survive in git history without exposing the data),
  as long as the private key never ends up in this repo.

## The private key

Generated once with `age-keygen`, **not stored in this repo**. It must live
somewhere outside git — a password manager entry, a note app, wherever you keep
other secrets. Without it, the `.age` files here are permanently unreadable —
there is no recovery path if the key is lost, that's the whole point of
encryption. Public key for reference (safe to share, only used to encrypt):

```
age1ndjrjdazg6prmdwmxmfp0agvfwuuttd7ltldycga3n8h2808hf5skex2v0
```

## Regenerate + encrypt a fresh backup

```bash
# 1. MySQL dump (full data)
mysqldump -h localhost -P 3306 -u movix -p --routines --triggers --single-transaction movix > backups/movix_mysql_$(date +%Y%m%d_%H%M%S).sql

# 2. Memurai/Redis RDB snapshot
"C:\Program Files\Memurai\memurai-cli.exe" -h 127.0.0.1 -p 6379 BGSAVE
# then copy the resulting dump.rdb from the Memurai install dir here

# 3. Encrypt (age must be installed: winget install FiloSottile.age)
age -r age1ndjrjdazg6prmdwmxmfp0agvfwuuttd7ltldycga3n8h2808hf5skex2v0 -o backups/movix_mysql_<timestamp>.sql.age backups/movix_mysql_<timestamp>.sql
age -r age1ndjrjdazg6prmdwmxmfp0agvfwuuttd7ltldycga3n8h2808hf5skex2v0 -o backups/memurai_dump_<timestamp>.rdb.age backups/memurai_dump_<timestamp>.rdb

# 4. Commit only the .age files, delete/keep the plaintext locally as you prefer
git add backups/*.age
```

## Restore

```bash
# Decrypt (needs the private key, from wherever you stored it)
age -d -i /path/to/private-key.txt -o backups/movix_mysql_<timestamp>.sql backups/movix_mysql_<timestamp>.sql.age

# Then load it
mysql -h localhost -P 3306 -u movix -p movix < backups/movix_mysql_<timestamp>.sql
```

For the Redis/Memurai RDB file: decrypt the same way, stop the server, replace
its `dump.rdb`, restart.

For a schema-only (no data) init script meant to be versioned in the clear, see
`API/Mainapi/exportscripts/schema_full_init.sql` instead.
