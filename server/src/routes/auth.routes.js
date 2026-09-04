import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import config from '../config/env.js';
import { requireMerchantAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

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

export default router;
