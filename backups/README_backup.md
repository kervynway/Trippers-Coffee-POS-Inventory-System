<<<<<<< HEAD
# Trippers-Coffee-POS-Inventory-System
Trippers Coffee Inventory &amp; POS System Project led by Kervyn Darren Armada, Mark Louie Ramos &amp; Mikylla Custodio
=======
# Trippers Coffee POS

A vanilla HTML, CSS, and JavaScript point-of-sale and management application with a Node.js HTTP server and SQLite database.

## Run

```bash
npm start
```

Open `http://localhost:4173`. The root page is the staff sign-in and first-run setup screen; the cashier register and Admin dashboard require authenticated sessions.

## First-time setup

On the first run, the server prints a one-time setup token and saves it to `data/setup-token.txt`. Open the sign-in page, enter that token, and create the first administrator account. Keep the token private and do not commit it. The token is removed after successful setup.

Administrators can manage products, ingredients, inventory movements, and cashier accounts from the Admin dashboard. New cashiers must change their temporary password at first sign-in. Password reset requests notify the administrator; an administrator can reset a cashier password from the cashier-account screen.

## Security and data

- Passwords are hashed with scrypt; sessions use opaque, database-backed tokens in HttpOnly cookies.
- The server checks roles before serving `/pos.html` and Admin pages. API endpoints apply a separate fail-closed authorization policy.
- Orders, payments, products, ingredients, shifts, refunds, audit events, notifications, and settings are stored in SQLite at `data/trippers.db` by default. `TRIPPERS_DB` can point to a different database file.
- Cashier checkout sends the order to the server, uses server-calculated product prices, taxes and service charges, records the payment reference/tender, and applies recipe-based stock deduction.
- Card and wallet payments are recorded only after the cashier confirms the external terminal/wallet transaction. This project does not connect to a payment processor or handle card details.
- Use HTTPS and set `TRIPPERS_SECURE_COOKIES=1` when deploying behind a TLS-enabled reverse proxy. The development server binds to loopback by default.

## Current interface scope

The Admin overview, Products, Inventory, and Cashier Accounts screens use the database-backed APIs. Orders, Sales, and Loyalty & Customers still contain prototype data and should not be used as authoritative operational reports or customer records.

The whole system uses a black-and-gold coffee-house palette: deep espresso surfaces, warm gold accents, and cream type. Light mode keeps the same gold accents on warm parchment. The sign-in loading screen uses a restrained black-and-gold brand treatment. The application uses Google Fonts when online and includes responsive layouts.
>>>>>>> 495eef0 (Uploading the Project)
