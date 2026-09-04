import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import prisma from '../config/db.js';

export async function requireMerchantAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Missing or invalid Bearer token.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    
    const merchant = await prisma.merchant.findUnique({
      where: { id: decoded.merchantId },
      select: {
        id: true,
        email: true,
        name: true,
        storeName: true,
        currency: true,
        spendingCapPaise: true,
        approvalThresholdPaise: true,
        apiKey: true
      }
    });

    if (!merchant) {
      return res.status(401).json({ error: 'Merchant account not found.' });
    }

    req.merchant = merchant;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export async function optionalMerchantAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwtSecret);
      const merchant = await prisma.merchant.findUnique({
        where: { id: decoded.merchantId },
        select: { id: true, email: true, name: true, storeName: true, spendingCapPaise: true, approvalThresholdPaise: true }
      });
      if (merchant) {
        req.merchant = merchant;
      }
    }
  } catch {}
  next();
}
