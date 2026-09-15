# LEGACY BACKEND (Node.js + SQLite) - BACKUP & DEVELOPMENT PREVIEW ONLY

> **IMPORTANT NOTICE: NOT USED IN PRODUCTION**
>
> The production backend for this application is **PHP 8.2+ with MySQL 8+**, located entirely within the `php-backend/` directory.
>
> This `server/` directory is the legacy Node.js/TypeScript Express server. It is retained strictly as:
> 1. A local development preview server for the AI Studio container sandbox.
> 2. An architectural backup.
>
> ### Production Architecture
> - **Frontend**: React 19 + TypeScript + Tailwind CSS (built to `dist/` via `npm run build`)
> - **Backend**: Pure PHP 8.2+ REST API (`php-backend/`)
> - **Database**: MySQL 8+ / MariaDB 10.5+ (`php-backend/database.sql` & `php-backend/seed.sql`)
> - **Deployment Target**: Standard cPanel / Apache shared hosting or VPS
>
> Do **NOT** upload this `server/` folder or any SQLite files to your production cPanel hosting.
