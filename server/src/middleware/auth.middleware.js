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

    if (!decoded.merchantId) {
      return res.status(401).json({ error: 'Invalid token type.' });
    }

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
        apiKey: true   // needed so /api/auth/me returns it to the frontend
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

      // Only process if this is a merchant token (has merchantId claim)
      if (decoded.merchantId) {
        const merchant = await prisma.merchant.findUnique({
          where: { id: decoded.merchantId },
          select: {
            id: true, email: true, name: true, storeName: true,
            spendingCapPaise: true, approvalThresholdPaise: true,
            apiKey: true  // needed by Overview for /api/marketplace/analytics
          }
        });
        if (merchant) {
          req.merchant = merchant;
        }
      }
    }
  } catch {}
  next();
}
