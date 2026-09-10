import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './db/database.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { settingsRouter } from './routes/settings.js';
import { categoriesRouter } from './routes/categories.js';
import { productsRouter } from './routes/products.js';
import { inventoryRouter } from './routes/inventory.js';
import { suppliersRouter } from './routes/suppliers.js';
import { customersRouter } from './routes/customers.js';
import { salesRouter } from './routes/sales.js';
import { purchasesRouter } from './routes/purchases.js';
import { expensesRouter } from './routes/expenses.js';
import { reportsRouter } from './routes/reports.js';
import { zakatRouter } from './routes/zakat.js';
import { auditLogsRouter } from './routes/auditLogs.js';
import { quotationsRouter } from './routes/quotations.js';
import { branchesRouter } from './routes/branches.js';
import { cashDrawerRouter } from './routes/cashDrawer.js';

async function startServer() {
  // Initialize SQLite database and seed demo records
  initDatabase();

  const app = express();
  const PORT = 3000;

  // JSON Body Parser
  app.use(express.json());

  // API Routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', system: 'Hardware & Sanitary Shop Management System' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/expenses', expensesRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/zakat', zakatRouter);
  app.use('/api/audit-logs', auditLogsRouter);
  app.use('/api/quotations', quotationsRouter);
  app.use('/api/branches', branchesRouter);
  app.use('/api/cash-drawer', cashDrawerRouter);

  // Vite middleware for development vs. static dist serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
