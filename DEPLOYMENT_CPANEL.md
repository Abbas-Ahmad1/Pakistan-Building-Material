# Complete Shared Hosting (cPanel) Deployment Guide
## Hardware Store POS & ERP (PHP 8.2+ & MySQL 8+)

This guide provides step-by-step instructions for deploying the Hardware Store POS & ERP system to standard shared hosting platforms like **Hostinger**, **GoDaddy**, **Namecheap**, **Bluehost**, **cPanel**, or any standard Linux Apache/Nginx + PHP + MySQL environment.

---

### Table of Contents
1. [Prerequisites & Server Requirements](#1-prerequisites--server-requirements)
2. [Database Setup (MySQL)](#2-database-setup-mysql)
3. [Migrating Existing Data from SQLite to MySQL](#3-migrating-existing-data-from-sqlite-to-mysql)
4. [Backend Deployment (`php-backend`)](#4-backend-deployment-php-backend)
5. [Frontend Build & Deployment (React / Vite)](#5-frontend-build--deployment-react--vite)
6. [Combined Single-Domain Setup (`public_html`)](#6-combined-single-domain-setup-public_html)
7. [Subdomain / Separate Domain Setup (Optional)](#7-subdomain--separate-domain-setup-optional)
8. [Apache `.htaccess` & Authorization Header Configuration](#8-apache-htaccess--authorization-header-configuration)
9. [Default Credentials & Verification](#9-default-credentials--verification)
10. [Troubleshooting & FAQ](#10-troubleshooting--faq)

---

### 1. Prerequisites & Server Requirements

- **PHP Version:** PHP 8.2 or 8.3+ (available in cPanel under **Select PHP Version**).
- **PHP Extensions Required:**
  - `pdo_mysql` (PDO MySQL driver)
  - `openssl` (for secure token generation)
  - `mbstring` (for UTF-8 string handling)
  - `json` (for JSON API requests and responses)
  - `fileinfo` (for MIME-type image upload validation)
- **MySQL Version:** MySQL 8.0+ or MariaDB 10.5+.
- **Apache Modules:** `mod_rewrite`, `mod_headers`.

---

### 2. Database Setup (MySQL)

1. Log into your hosting **cPanel**.
2. Go to **MySQL Database Wizard** (or **Databases** > **MySQL Databases**).
3. **Step 1:** Create a new database name, e.g.: `u123456_hardware_store`.
4. **Step 2:** Create a new database user, e.g.: `u123456_dbuser`, with a strong password.
5. **Step 3:** Assign **ALL PRIVILEGES** to the user for this database.
6. Open **phpMyAdmin** from cPanel:
   - Select your new database.
   - Click the **Import** tab.
   - Choose `php-backend/database.sql` from your local machine and click **Go** (creates all 19 relational tables with indexes and foreign keys).
   - Next, import `php-backend/seed.sql` to populate default roles, users, categories, settings, and starter inventory.

---

### 3. Migrating Existing Data from SQLite to MySQL

If you want to migrate all live data directly from your existing `hardware_store.db` file to MySQL:

1. Update your MySQL connection details in `php-backend/config/database.php`:
   ```php
   'host'     => 'localhost',
   'database' => 'u123456_hardware_store',
   'username' => 'u123456_dbuser',
   'password' => 'YourStrongPasswordHere',
   ```
2. Run the migration script:
   - **Via SSH Terminal:**
     ```bash
     cd php-backend
     php migrate.php
     ```
   - **Or via Browser (temporary):**
     Upload `migrate.php` to your server and open `https://yourdomain.com/api/migrate.php` in your browser.
     *(Delete or protect `migrate.php` after migration completes).*

---

### 4. Backend Deployment (`php-backend`)

1. Open your cPanel **File Manager**.
2. Upload the contents of the `php-backend` folder to your target directory on the server:
   - **Option A (Inside an `/api` folder):** `public_html/api/`
   - **Option B (Root of a subdomain):** e.g., `api.yourdomain.com` (`public_html/api_subdomain/`)
3. Ensure the `uploads/` directory has write permissions (`chmod 755` or `chmod 775`).
4. In `php-backend/config/database.php`, ensure your MySQL credentials match your cPanel database.
5. Verify your backend health check by visiting:
   ```
   https://yourdomain.com/api/health
   ```
   You should receive:
   ```json
   {
     "success": true,
     "data": {
       "status": "healthy",
       "engine": "PHP 8.2.x",
       "database": "MySQL 8+"
     }
   }
   ```

---

### 5. Frontend Build & Deployment (React / Vite)

1. On your development machine, open the project directory in a terminal.
2. If your PHP backend is in `/api` on the same domain, no build configuration changes are needed.
3. If your PHP backend is hosted on a separate subdomain (e.g. `https://api.yourdomain.com`), set:
   ```env
   VITE_API_BASE_URL=https://api.yourdomain.com
   ```
4. Build the production React assets:
   ```bash
   npm run build
   ```
   This generates the static bundle in the `dist/` directory.

---

### 6. Combined Single-Domain Setup (`public_html`)

The most common cPanel setup is hosting both the React frontend and PHP API on the same domain:

```
public_html/
│
├── api/                             <-- Upload php-backend contents here
│   ├── config/
│   │   ├── config.php
│   │   └── database.php
│   ├── controllers/
│   │   ├── AuthController.php
│   │   ├── ProductsController.php
│   │   ├── SalesController.php
│   │   ├── CashDrawerController.php
│   │   ├── BranchesController.php
│   │   └── ... (all controllers)
│   ├── core/
│   │   ├── Database.php
│   │   ├── Request.php
│   │   ├── Response.php
│   │   ├── Router.php
│   │   └── Auth.php
│   ├── uploads/                     <-- Writeable folder (chmod 755)
│   ├── .htaccess                    <-- API route rewriting & authorization
│   └── index.php                    <-- API entry point
│
├── assets/                          <-- From frontend dist/assets/
│   ├── index-xxxx.js
│   └── index-xxxx.css
├── index.html                       <-- From frontend dist/index.html
├── favicon.ico
└── .htaccess                        <-- Frontend SPA route rewrite rules
```

#### Frontend Root `.htaccess` (`public_html/.htaccess`):
To enable React client-side routing (so refreshing on `/sales` or `/inventory` doesn't 404):
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # Allow direct access to the /api folder
    RewriteRule ^api/ - [L]

    # Serve existing files directly
    RewriteCond %{REQUEST_FILENAME} -f [OR]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]

    # Route all other URLs to the React index.html
    RewriteRule ^ index.html [L]
</IfModule>
```

---

### 7. Subdomain / Separate Domain Setup (Optional)

If you prefer hosting the backend on `api.yourhardwarestore.com` and the frontend on `yourhardwarestore.com`:
1. In cPanel, create a subdomain: `api.yourhardwarestore.com` pointing to `/public_html/api/`.
2. Upload `php-backend` contents directly into `/public_html/api/`.
3. In `php-backend/config/config.php`, add your frontend domain to `cors_origins`:
   ```php
   'cors_origins' => [
       'https://yourhardwarestore.com',
       'https://www.yourhardwarestore.com',
   ],
   ```
4. Build the frontend with `VITE_API_BASE_URL=https://api.yourhardwarestore.com`.

---

### 8. Apache `.htaccess` & Authorization Header Configuration

In shared hosting environments running PHP via FastCGI or CGI (Hostinger, GoDaddy, etc.), Apache strips the `Authorization: Bearer <token>` header by default.

The provided `php-backend/.htaccess` includes the fix:
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # Pass Authorization header to PHP
    SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1
    <IfModule mod_authz_core.c>
        CGIPassAuth On
    </IfModule>

    # Block direct access to configuration
    RewriteRule ^config/.*$ - [F,L]
    RewriteRule ^\.env.*$ - [F,L]
    RewriteRule ^database\.sql$ - [F,L]
    RewriteRule ^seed\.sql$ - [F,L]
    RewriteRule ^migrate\.php$ - [F,L]

    # Route API requests to index.php
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)$ index.php [QSA,L]
</IfModule>
```

Additionally, `php-backend/core/Request.php` checks all fallback sources:
- `$_SERVER['HTTP_AUTHORIZATION']`
- `$_SERVER['REDIRECT_HTTP_AUTHORIZATION']`
- `apache_request_headers()`
- URL query parameter `?token=...`

---

### 9. Default Credentials & Verification

Log into the application using the pre-seeded credentials:

| Role | Username | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Full access to POS, Financial Reports, Stock Valuation, Settings, Users |
| **Cashier** | `cashier` | `cashier123` | POS checkout, Khata payments, Quotations, Drawer shifts |

---

### 10. Troubleshooting & FAQ

#### Q: "Unauthorized: Invalid or expired authentication session" right after login
- **Cause:** Apache stripped the `Authorization` header.
- **Fix:** Ensure `php-backend/.htaccess` has `CGIPassAuth On` and `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1`.

#### Q: 404 Not Found on API endpoints like `/api/sales` or `/api/products`
- **Cause:** `mod_rewrite` is disabled or `.htaccess` is not being read.
- **Fix:** Verify `AllowOverride All` in Apache configuration, or ensure `.htaccess` is present in the API directory.

#### Q: Images fail to upload
- **Cause:** `uploads/` directory permissions.
- **Fix:** In cPanel File Manager, right click `php-backend/uploads/` > **Change Permissions** > Set to `755` (or `775`).

#### Q: Database connection error: "SQLSTATE[HY000] [2002] Connection refused"
- **Cause:** Wrong host or port.
- **Fix:** On shared hosting, MySQL host is almost always `localhost` or `127.0.0.1`. Verify database name and user prefix (cPanel usually prefixes usernames like `cpaneluser_dbname`).
