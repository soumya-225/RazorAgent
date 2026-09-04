import bcrypt from 'bcryptjs';
import prisma from './config/db.js';

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create or update Default Merchant
  const passwordHash = await bcrypt.hash('password123', 10);
  const merchant = await prisma.merchant.upsert({
    where: { email: 'merchant@razoragent.demo' },
    update: {
      spendingCapPaise: 1000000, // ₹10,000
      approvalThresholdPaise: 500000 // ₹5,000
    },
    create: {
      email: 'merchant@razoragent.demo',
      passwordHash,
      name: 'Rajesh Kumar',
      storeName: 'AeroTech Gadgets India',
      spendingCapPaise: 1000000,
      approvalThresholdPaise: 500000
    }
  });

  console.log(`✅ Merchant seeded: ${merchant.email}`);

  // 2. Seed Products
  const products = [
    {
      sku: 'WH-001',
      name: 'AeroSound Pro Wireless ANC Headphones',
      description: 'Active Noise Cancelling over-ear headphones with 40h battery life and spatial audio.',
      pricePaise: 249900, // ₹2,499.00
      costPaise: 120000,  // ₹1,200 (52% margin)
      category: 'Electronics > Audio',
      inventory: 35,
      salesCount30Days: 28,
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
      merchantId: merchant.id
    },
    {
      sku: 'EB-002',
      name: 'AeroBuds Ultra True Wireless Earbuds',
      description: 'Compact IPX7 waterproof earbuds with bass boost and low-latency gaming mode.',
      pricePaise: 149900, // ₹1,499.00
      costPaise: 75000,   // ₹750 (50% margin)
      category: 'Electronics > Audio',
      inventory: 50,
      salesCount30Days: 42,
      imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&q=80',
      merchantId: merchant.id
    },
    {
      sku: 'CB-003',
      name: 'TitanBraided USB-C to USB-C 100W Cable (2m)',
      description: 'Kevlar-reinforced fast-charging USB-C cable supporting Power Delivery 3.0.',
      pricePaise: 49900,  // ₹499.00
      costPaise: 18000,   // ₹180 (64% margin)
      category: 'Accessories > Cables',
      inventory: 120,
      salesCount30Days: 85,
      imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&q=80',
      merchantId: merchant.id
    },
    {
      sku: 'SW-004',
      name: 'AeroTrack Horizon AMOLED Smartwatch',
      description: 'Continuous SpO2, ECG monitoring, and 14-day standby in a sleek titanium frame.',
      pricePaise: 399900, // ₹3,999.00
      costPaise: 220000,  // ₹2,200 (45% margin)
      category: 'Wearables > Smartwatches',
      inventory: 18,
      salesCount30Days: 14,
      imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
      merchantId: merchant.id
    },
    {
      sku: 'GM-005',
      name: 'Vortex RGB Mechanical Gaming Keyboard',
      description: 'Hot-swappable linear red switches with per-key RGB backlighting and wrist rest.',
      pricePaise: 329900, // ₹3,299.00
      costPaise: 180000,  // ₹1,800 (45% margin)
      category: 'Gaming > Keyboards',
      inventory: 12,
      salesCount30Days: 9,
      imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&q=80',
      merchantId: merchant.id
    },
    {
      sku: 'PB-006',
      name: 'VoltMax 20,000mAh 65W Fast Power Bank',
      description: 'High-capacity power bank capable of fast-charging laptops and phones concurrently.',
      pricePaise: 199900, // ₹1,999.00
      costPaise: 110000,  // ₹1,100 (45% margin)
      category: 'Accessories > Power',
      inventory: 40,
      salesCount30Days: 31,
      imageUrl: 'https://images.unsplash.com/photo-1609592426505-18155998f48a?w=500&q=80',
      merchantId: merchant.id
    },
    // Slow-moving SKUs (Target for AI Campaign Agent!)
    {
      sku: 'VR-007',
      name: 'OmniView Lite Mobile VR Headset',
      description: 'Immersive 360 virtual reality headset for 4.7-6.5 inch smartphones.',
      pricePaise: 189900, // ₹1,899.00
      costPaise: 95000,   // ₹950 (50% margin)
      category: 'Gaming > VR',
      inventory: 45,      // Trapped inventory!
      salesCount30Days: 2, // Slow moving (<5)
      imageUrl: 'https://images.unsplash.com/photo-1622979135225-d2ba269bc1df?w=500&q=80',
      merchantId: merchant.id
    },
    {
      sku: 'LS-008',
      name: 'AeroGlow Smart RGB Desk Light Bar',
      description: 'Screen-mounted anti-glare light bar with ambient back-lighting and wireless dial.',
      pricePaise: 219900, // ₹2,199.00
      costPaise: 110000,  // ₹1,100 (50% margin)
      category: 'Workspace > Lighting',
      inventory: 30,
      salesCount30Days: 3, // Slow moving (<5)
      imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&q=80',
      merchantId: merchant.id
    },
    // High-value item for threshold testing
    {
      sku: 'ST-009',
      name: 'StudioPro 8K Ultra-Wide Curved Monitor (34")',
      description: 'Color-accurate 144Hz IPS display tailored for digital creators and gamers.',
      pricePaise: 5499900, // ₹54,999.00 (triggers high-value approval gate!)
      costPaise: 3800000,  // ₹38,000
      category: 'Electronics > Displays',
      inventory: 8,
      salesCount30Days: 5,
      imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80',
      merchantId: merchant.id
    }
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { sku: prod.sku },
      update: prod,
      create: prod
    });
  }
  console.log(`✅ Seeded ${products.length} products with margin and inventory data`);

  // 3. Seed Initial Campaign
  await prisma.campaign.upsert({
    where: { couponCode: 'WELCOME10' },
    update: {},
    create: {
      merchantId: merchant.id,
      name: 'Welcome Shopper Boost',
      type: 'FLASH_SALE',
      discountPercent: 10,
      couponCode: 'WELCOME10',
      targetSkus: [{ sku: 'WH-001', name: 'AeroSound Pro Wireless ANC Headphones' }],
      reasoning: 'Baseline welcome campaign providing 10% discount on first-time storefront orders.',
      status: 'ACTIVE'
    }
  });

  // 4. Seed Initial Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        sessionId: 'session_init',
        agentName: 'SAFETY_GATE',
        actionType: 'initialize_safety_policies',
        actionPayload: { spendingCapInr: 10000, approvalThresholdInr: 5000 },
        explanation: 'RazorAgent safety kernel loaded: Spending Cap ₹10,000 | Human Approval Threshold ₹5,000.',
        status: 'SUCCESS',
        amountInr: 10000
      },
      {
        sessionId: 'session_init',
        agentName: 'CATALOG_AGENT',
        actionType: 'catalog_sync',
        actionPayload: { totalProducts: products.length },
        explanation: 'Synchronized merchant catalog to ACP agent card and JSON-LD schema endpoint.',
        status: 'SUCCESS',
        amountInr: 0
      }
    ]
  });

  console.log('🎉 Seeding complete! Database is ready.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
