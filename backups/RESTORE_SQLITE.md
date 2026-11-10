# Restoring the SQLite Version

These backups live in the `backups/` folder and were created before the MySQL/MariaDB migration. Use this file if the team decides to return to the original SQLite setup. All paths below are relative to the project root.

## Backup files

| Backup | Restore to |
| --- | --- |
| `backups/server/db_backup.js` | `server/db.js` |
| `backups/server/auth_backup.js` | `server/auth.js` |
| `backups/server/api_backup.js` | `server/api.js` |
| `backups/server/server_backup.js` | `server.js` |
| `backups/server/seed-demo_backup.js` | `server/seed-demo.js` |
| `backups/server/http_backup.js` | `server/http.js` |
| `backups/package_backup.json` | `package.json` (optional) |
| `backups/package-lock_backup.json` | `package-lock.json` (optional) |
| `backups/README_backup.md` | `README.md` (optional) |
| `backups/data/trippers_backup.db` | `data/trippers.db` |
| `backups/data/accounts_backup.json` | `data/accounts.json` (optional) |
| `backups/data/setup-body_backup.json` | `data/setup-body.json` (optional) |
| `backups/data/setup-token_backup.txt` | `data/setup-token.txt` (optional) |

`backups/server/db_mysql_partial_backup.js` and `backups/server/auth_partial_backup.js` are only copies of the unfinished MySQL attempt. They are **not** part of the SQLite restore set.

The SQLite database snapshot was created with `VACUUM INTO`, passed `PRAGMA integrity_check`, and matches the original across all 24 tables.

## Restore steps

1. Stop the Node server (Ctrl+C in its terminal, or stop the process listening on port 4173).

2. From the project root, restore the backend files:

```powershell
Copy-Item -LiteralPath "backups\server\db_backup.js" -Destination "server\db.js" -Force
Copy-Item -LiteralPath "backups\server\auth_backup.js" -Destination "server\auth.js" -Force
Copy-Item -LiteralPath "backups\server\api_backup.js" -Destination "server\api.js" -Force
Copy-Item -LiteralPath "backups\server\server_backup.js" -Destination "server.js" -Force
Copy-Item -LiteralPath "backups\server\seed-demo_backup.js" -Destination "server\seed-demo.js" -Force
Copy-Item -LiteralPath "backups\server\http_backup.js" -Destination "server\http.js" -Force
```

3. Restore the SQLite database:

```powershell
Copy-Item -LiteralPath "backups\data\trippers_backup.db" -Destination "data\trippers.db" -Force
```

4. Delete stale WAL files so SQLite does not apply them to the restored database:

```powershell
Remove-Item -LiteralPath "data\trippers.db-wal" -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "data\trippers.db-shm" -Force -ErrorAction SilentlyContinue
```

5. Optionally restore the package files and runtime data:

```powershell
Copy-Item -LiteralPath "backups\package_backup.json" -Destination "package.json" -Force
Copy-Item -LiteralPath "backups\package-lock_backup.json" -Destination "package-lock.json" -Force
Copy-Item -LiteralPath "backups\README_backup.md" -Destination "README.md" -Force
Copy-Item -LiteralPath "backups\data\accounts_backup.json" -Destination "data\accounts.json" -Force
Copy-Item -LiteralPath "backups\data\setup-body_backup.json" -Destination "data\setup-body.json" -Force
Copy-Item -LiteralPath "backups\data\setup-token_backup.txt" -Destination "data\setup-token.txt" -Force
```

6. Start the app:

```powershell
npm start
```

Open `http://localhost:4173`.

## Notes

- `node:sqlite` is built into Node.js; the SQLite version does not depend on XAMPP or MySQL.
- `mysql2` can stay installed; the restored SQLite code does not use it.
- Existing passwords use the `scrypt$salt$hash` format, which the restored `auth_backup.js` understands.
- Do not run the MySQL and SQLite versions at the same time against the same project folder.
