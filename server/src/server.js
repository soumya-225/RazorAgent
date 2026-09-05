import express from 'express';
import cors from 'cors';
import config from './config/env.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import productsRoutes from './routes/products.routes.js';
import merchantsRoutes from './routes/merchants.routes.js';
import protocolRoutes from './routes/protocol.routes.js';
import agentsRoutes from './routes/agents.routes.js';
import safetyRoutes from './routes/safety.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import webhooksRoutes from './routes/webhooks.routes.js';
import marketplaceRoutes from './routes/marketplace.routes.js';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Razorpay-Signature', 'X-Payment-Order-Id', 'X-Payment-Required']
}));

// Body parsing (preserve raw body for webhook verification)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'RazorAgent',
    timestamp: new Date().toISOString(),
    razorpayMode: config.isRazorpayLive ? 'live_test_keys' : 'sandbox_simulator',
    openaiModel: config.openaiModel
  });
});

// Mount Protocol Routes (ACP & x402)
app.use(protocolRoutes);

// Mount Application Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/merchants', merchantsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/marketplace', marketplaceRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'SERVER_ERROR'
  });
});

// Start Server — with EADDRINUSE retry so --watch restarts don't crash
function startServer(port, retries = 5) {
  const server = app.listen(port, () => {
    console.log(`
  ======================================================
  🚀 RazorAgent API Server running on port ${port}
  📍 Health:     http://localhost:${port}/api/health
  🤖 ACP Card:   http://localhost:${port}/.well-known/agent.json
  📦 Catalog:    http://localhost:${port}/api/catalog
  🛡️ Safety & Audit Gateway: ACTIVE
  ======================================================
  `);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && retries > 0) {
      console.warn(`⚠️  Port ${port} busy — retrying in 1s... (${retries} attempts left)`);
      setTimeout(() => startServer(port, retries - 1), 1000);
    } else {
      console.error('❌ Server failed to start:', err.message);
      process.exit(1);
    }
  });

  // Graceful shutdown so --watch can reclaim the port cleanly
  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  return server;
}

startServer(config.port);

export default app;
