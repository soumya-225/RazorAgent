import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import config from '../config/env.js';
import { requireMerchantAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// In-memory customer store (JWT-only, no DB migration needed)
// Customers are identified by email, profile encoded in JWT.
const customerStore = new Map(); // email -> { passwordHash, profile }

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, storeName } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }

    const existing = await prisma.merchant.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Merchant with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const merchant = await prisma.merchant.create({
      data: {
        email,
        passwordHash,
        name,
        storeName: storeName || `${name}'s Store`,
        spendingCapPaise: 1000000, // ₹10,000
        approvalThresholdPaise: 500000 // ₹5,000
      }
    });

    const token = jwt.sign({ merchantId: merchant.id }, config.jwtSecret, { expiresIn: '7d' });

    return res.status(201).json({
      message: 'Merchant registered successfully',
      token,
      merchant: {
        id: merchant.id,
        email: merchant.email,
        name: merchant.name,
        storeName: merchant.storeName,
        spendingCapPaise: merchant.spendingCapPaise,
        approvalThresholdPaise: merchant.approvalThresholdPaise,
        spendingCapInr: merchant.spendingCapPaise / 100,
        approvalThresholdInr: merchant.approvalThresholdPaise / 100
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const merchant = await prisma.merchant.findUnique({ where: { email } });
    if (!merchant) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, merchant.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ merchantId: merchant.id }, config.jwtSecret, { expiresIn: '7d' });

    return res.json({
      message: 'Login successful',
      token,
      merchant: {
        id: merchant.id,
        email: merchant.email,
        name: merchant.name,
        storeName: merchant.storeName,
        spendingCapPaise: merchant.spendingCapPaise,
        approvalThresholdPaise: merchant.approvalThresholdPaise,
        spendingCapInr: merchant.spendingCapPaise / 100,
        approvalThresholdInr: merchant.approvalThresholdPaise / 100,
        apiKey: merchant.apiKey
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireMerchantAuth, async (req, res) => {
  return res.json({
    merchant: {
      ...req.merchant,
      spendingCapInr: req.merchant.spendingCapPaise / 100,
      approvalThresholdInr: req.merchant.approvalThresholdPaise / 100
    }
  });
});

/**
 * PATCH /api/auth/settings
 */
router.patch('/settings', requireMerchantAuth, async (req, res) => {
  try {
    const { storeName, spendingCapInr, approvalThresholdInr } = req.body;
    const updateData = {};

    if (storeName) updateData.storeName = storeName;
    if (spendingCapInr !== undefined) updateData.spendingCapPaise = Math.round(Number(spendingCapInr) * 100);
    if (approvalThresholdInr !== undefined) updateData.approvalThresholdPaise = Math.round(Number(approvalThresholdInr) * 100);

    const updated = await prisma.merchant.update({
      where: { id: req.merchant.id },
      data: updateData
    });

    return res.json({
      message: 'Merchant settings updated',
      merchant: {
        ...updated,
        spendingCapInr: updated.spendingCapPaise / 100,
        approvalThresholdInr: updated.approvalThresholdPaise / 100
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// CUSTOMER AUTH — JWT only, no DB model required
// =============================================================================

/**
 * POST /api/auth/customer/register
 * Customer registration — profile stored in JWT + in-memory map
 */
router.post('/customer/register', async (req, res) => {
  try {
    const {
      email, password, name, phone,
      preferredPayment, autopayThresholdInr, address
    } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }
    if (customerStore.has(email)) {
      return res.status(400).json({ error: 'A customer account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const profile = {
      email,
      name,
      phone: phone || '',
      preferredPayment: preferredPayment || 'card',
      autopayThresholdInr: Number(autopayThresholdInr) || 2000,
      address: address || ''
    };
    customerStore.set(email, { passwordHash, profile });

    const token = jwt.sign(
      { role: 'customer', customer: profile },
      config.jwtSecret,
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      message: 'Customer account created successfully',
      token,
      customer: profile
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/customer/login
 */
router.post('/customer/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const record = customerStore.get(email);
    if (!record) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, record.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { role: 'customer', customer: record.profile },
      config.jwtSecret,
      { expiresIn: '30d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      customer: record.profile
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/customer/me
 * Decode customer JWT and return profile
 */
router.get('/customer/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.role !== 'customer') {
      return res.status(403).json({ error: 'Not a customer token.' });
    }
    return res.json({ customer: decoded.customer });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

export default router;
