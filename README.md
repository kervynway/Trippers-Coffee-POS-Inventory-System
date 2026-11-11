# Trippers Coffee POS

Trippers Coffee Inventory & POS System Project led by Kervyn Darren Armada, Mark Louie Ramos & Mikylla Custodio.

A vanilla HTML, CSS, and JavaScript point-of-sale and management application with a Node.js HTTP server and MariaDB (XAMPP) database.

## Requirements

- Node.js 22.5 or newer (`node:sqlite` is used by the one-time SQLite migration)
- XAMPP with MariaDB 10.4 or newer
- MariaDB running on `127.0.0.1:3306`

## Setup

1. Start **MySQL** from the XAMPP control panel.

2. Create the database:

```powershell
mysql -u root -e "CREATE DATABASE IF NOT EXISTS trippers_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

If `mysql` is not on your PATH, run the command from the XAMPP shell or use the full path to `mysql.exe`.

3. Install dependencies and initialize the schema/catalog:

```powershell
npm install
npm run db:init
npm run db:seed
```

4. Import the existing SQLite users and settings:

```powershell
npm run db:migrate
```

This is idempotent and only migrates users and settings. Orders, sessions, login attempts, and activity logs are not copied. The existing passwords are preserved, so sign in with the accounts and passwords used before the migration. The SQLite source remains at `data/trippers.db` as a fallback.

Preview the migration without writing:

```powershell
npm run db:migrate -- --dry-run
```

5. Start the app:

```powershell
npm start
```

Open `http://localhost:4173`.

## First-time setup

If the database has no administrator account, the server prints a one-time setup token and saves it to `data/setup-token.txt`. Open the sign-in page, enter the token, and create the first administrator account. The token is removed after setup and must not be committed.

New cashiers must change their temporary password at first sign-in. Password reset requests notify the administrator, who can reset a cashier password from the cashier-account screen.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` | HTTP port |
| `DB_HOST` | `127.0.0.1` | MariaDB host |
| `DB_PORT` | `3306` | MariaDB port |
| `DB_USER` | `root` | MariaDB user |
| `DB_PASSWORD` | empty | MariaDB password |
| `DB_NAME` | `trippers_db` | Database name |
| `DB_POOL_SIZE` | `10` | Connection pool size |
| `TRIPPERS_DB` | `data/trippers.db` | SQLite source for `db:migrate` |
| `TRIPPERS_SECURE_COOKIES` | unset | Set to `1` behind HTTPS |

The default MariaDB credentials are intended for local XAMPP development. Use a dedicated database user and a strong password before deploying.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the server |
| `npm run db:init` | Create/update the MariaDB schema |
| `npm run db:seed` | Seed the base catalog and settings |
| `npm run db:migrate` | Import SQLite users and settings |
| `npm run db:seed-demo` | Add optional demo cashier and sales history |
| `npm run db:seed-demo -- --force` | Add demo data even when orders exist |

## Security and data

- Passwords are hashed with scrypt; sessions use opaque, database-backed tokens in HttpOnly cookies.
- The server checks roles before serving `/pos.html` and Admin pages. API endpoints use a separate fail-closed authorization policy.
- State-changing API requests are same-origin checked. Static paths such as `/server`, `/data`, `/database`, and `/backups` are blocked.
- Cashier checkout uses server-calculated prices, taxes, discounts, and service charges, then applies recipe-based stock deduction.
- Card and wallet payments are recorded only after the cashier confirms the external terminal or wallet transaction. This project does not connect to a payment processor or handle card details.
- Use HTTPS and set `TRIPPERS_SECURE_COOKIES=1` when deploying behind a TLS-enabled reverse proxy. The development server binds to loopback by default.

## Backup and rollback

Administrators can export a JSON backup from the app. The REST API also supports restoring a backup after typing `RESTORE` to confirm.

The original SQLite implementation and database snapshot are retained under `backups/`. See `backups/RESTORE_SQLITE.md` for the complete rollback procedure. Do not run the SQLite and MariaDB versions at the same time against the same application data.
