# Restoring the SQLite Version

These backups were created before the MySQL/MariaDB migration. Use this file if the team decides to return to the original SQLite setup.

## Backup files

| Backup | Restore to |
| --- | --- |
| `server/db_backup.js` | `server/db.js` |
| `server/auth_backup.js` | `server/auth.js` |
| `server/api_backup.js` | `server/api.js` |
| `server/server_backup.js` | `server.js` |
| `server/seed-demo_backup.js` | `server/seed-demo.js` |
| `server/http_backup.js` | `server/http.js` |
| `package_backup.json` | `package.json` (optional) |
| `package-lock_backup.json` | `package-lock.json` (optional) |
| `README_backup.md` | `README.md` (optional) |
| `data/trippers_backup.db` | `data/trippers.db` |
| `data/accounts_backup.json` | `data/accounts.json` (optional) |
| `data/setup-body_backup.json` | `data/setup-body.json` (optional) |
| `data/setup-token_backup.txt` | `data/setup-token.txt` (optional) |

`server/db_mysql_partial_backup.js` and `server/auth_partial_backup.js` are only copies of the unfinished MySQL attempt. They are **not** part of the SQLite restore set.

The SQLite database snapshot was created with `VACUUM INTO`, passed `PRAGMA integrity_check`, and matches the original across all 24 tables.

## Restore steps

1. Stop the Node server (Ctrl+C in its terminal, or stop the process listening on port 4173).

2. From the project root, restore the backend files:

```powershell
Copy-Item -LiteralPath "server\db_backup.js" -Destination "server\db.js" -Force
Copy-Item -LiteralPath "server\auth_backup.js" -Destination "server\auth.js" -Force
Copy-Item -LiteralPath "server\api_backup.js" -Destination "server\api.js" -Force
Copy-Item -LiteralPath "server\server_backup.js" -Destination "server.js" -Force
Copy-Item -LiteralPath "server\seed-demo_backup.js" -Destination "server\seed-demo.js" -Force
Copy-Item -LiteralPath "server\http_backup.js" -Destination "server\http.js" -Force
```

3. Restore the SQLite database:

```powershell
Copy-Item -LiteralPath "data\trippers_backup.db" -Destination "data\trippers.db" -Force
```

4. Delete stale WAL files so SQLite does not apply them to the restored database:

```powershell
Remove-Item -LiteralPath "data\trippers.db-wal" -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "data\trippers.db-shm" -Force -ErrorAction SilentlyContinue
```

5. Optionally restore the package files and runtime data:

```powershell
Copy-Item -LiteralPath "package_backup.json" -Destination "package.json" -Force
Copy-Item -LiteralPath "package-lock_backup.json" -Destination "package-lock.json" -Force
Copy-Item -LiteralPath "README_backup.md" -Destination "README.md" -Force
Copy-Item -LiteralPath "data\accounts_backup.json" -Destination "data\accounts.json" -Force
Copy-Item -LiteralPath "data\setup-body_backup.json" -Destination "data\setup-body.json" -Force
Copy-Item -LiteralPath "data\setup-token_backup.txt" -Destination "data\setup-token.txt" -Force
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
