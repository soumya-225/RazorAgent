import bcrypt from 'bcryptjs';
import prisma from './config/db.js';

async function seed() {
  console.log('🌱 Seeding database with 4 Multi-Tenant Merchants & Registry...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Seed 4 Distinct Merchants
  const merchantDefs = [
    {
      email: 'merchant@razoragent.demo',
      name: 'Rajesh Kumar',
      storeName: 'AeroTech Gadgets India',
      spendingCapPaise: 1000000, // ₹10,000
      approvalThresholdPaise: 500000 // ₹5,000
    },
    {
      email: 'voltx@razoragent.demo',
      name: 'Priya Sharma',
      storeName: 'VoltX Power & Fast-Charge Labs',
      spendingCapPaise: 1500000, // ₹15,000
      approvalThresholdPaise: 600000 // ₹6,000
    },
    {
      email: 'nexus@razoragent.demo',
      name: 'Vikram Sengupta',
      storeName: 'Nexus Gaming & Mech Accessories',
      spendingCapPaise: 2000000, // ₹20,000
      approvalThresholdPaise: 750000 // ₹7,500
    },
    {
      email: 'ambient@razoragent.demo',
      name: 'Ananya Roy',
      storeName: 'Ambient Workspace & Lighting Studio',
      spendingCapPaise: 1200000, // ₹12,000
      approvalThresholdPaise: 500000 // ₹5,000
    }
  ];

  const merchantMap = {};

  for (const mDef of merchantDefs) {
    const merchant = await prisma.merchant.upsert({
      where: { email: mDef.email },
      update: {
        name: mDef.name,
        storeName: mDef.storeName,
        spendingCapPaise: mDef.spendingCapPaise,
        approvalThresholdPaise: mDef.approvalThresholdPaise
      },
      create: {
        email: mDef.email,
        passwordHash,
        name: mDef.name,
        storeName: mDef.storeName,
        spendingCapPaise: mDef.spendingCapPaise,
        approvalThresholdPaise: mDef.approvalThresholdPaise
      }
    });
    merchantMap[mDef.email] = merchant;
    console.log(`✅ Merchant Registered: [${merchant.storeName}] (${merchant.email})`);
  }

  // 2. Seed Products assigned to respective Merchants
  const products = [
    // --- Merchant 1: AeroTech Gadgets India ---
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
      merchantId: merchantMap['merchant@razoragent.demo'].id
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
      merchantId: merchantMap['merchant@razoragent.demo'].id
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
      merchantId: merchantMap['merchant@razoragent.demo'].id
    },
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
      merchantId: merchantMap['merchant@razoragent.demo'].id
    },

    // --- Merchant 2: VoltX Power & Fast-Charge Labs ---
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
      merchantId: merchantMap['voltx@razoragent.demo'].id
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
      merchantId: merchantMap['voltx@razoragent.demo'].id
    },
    {
      sku: 'CH-010',
      name: 'VoltFast 120W GaN 4-Port Turbo Charger',
      description: 'Ultra-compact Gallium Nitride wall charger with 3 USB-C and 1 USB-A ports.',
      pricePaise: 299900, // ₹2,999.00
      costPaise: 150000,  // ₹1,500 (50% margin)
      category: 'Accessories > Chargers',
      inventory: 30,
      salesCount30Days: 20,
      imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500&q=80',
      merchantId: merchantMap['voltx@razoragent.demo'].id
    },
    {
      sku: 'PB-011',
      name: 'VoltSlim 10,000mAh Magnetic Wireless Power Bank',
      description: 'MagSafe compatible magnetic wireless charger with kickstand for iPhone & Android.',
      pricePaise: 159900, // ₹1,599.00
      costPaise: 80000,   // ₹800 (50% margin)
      category: 'Accessories > Power',
      inventory: 25,
      salesCount30Days: 18,
      imageUrl: 'https://images.unsplash.com/photo-1609592426505-18155998f48a?w=500&q=80',
      merchantId: merchantMap['voltx@razoragent.demo'].id
    },

    // --- Merchant 3: Nexus Gaming & Mech Accessories ---
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
      merchantId: merchantMap['nexus@razoragent.demo'].id
    },
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
      merchantId: merchantMap['nexus@razoragent.demo'].id
    },
    {
      sku: 'GM-012',
      name: 'Nexus Precision Pro Wireless Gaming Mouse 26k DPI',
      description: 'Ultralight 58g ergonomic gaming mouse with optical switches and sub-1ms latency.',
      pricePaise: 229900, // ₹2,299.00
      costPaise: 115000,  // ₹1,150 (50% margin)
      category: 'Gaming > Mice',
      inventory: 22,
      salesCount30Days: 15,
      imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=500&q=80',
      merchantId: merchantMap['nexus@razoragent.demo'].id
    },

    // --- Merchant 4: Ambient Workspace & Lighting Studio ---
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
      merchantId: merchantMap['ambient@razoragent.demo'].id
    },
    {
      sku: 'WS-013',
      name: 'Ambient Aluminum Dual Laptop Vertical Stand',
      description: 'CNC machined anodized aluminum vertical stand for dual laptops and tablets.',
      pricePaise: 129900, // ₹1,299.00
      costPaise: 60000,   // ₹600 (53% margin)
      category: 'Workspace > Accessories',
      inventory: 40,
      salesCount30Days: 19,
      imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80',
      merchantId: merchantMap['ambient@razoragent.demo'].id
    },
    {
      sku: 'WS-014',
      name: 'Ambient Executive Felt Leather Desk Pad',
      description: 'Waterproof PU leather and merino wool felt desk mat for workspace aesthetics.',
      pricePaise: 89900,  // ₹899.00
      costPaise: 40000,   // ₹400 (55% margin)
      category: 'Workspace > Accessories',
      inventory: 60,
      salesCount30Days: 33,
      imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&q=80',
      merchantId: merchantMap['ambient@razoragent.demo'].id
    }
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { sku: prod.sku },
      update: prod,
      create: prod
    });
  }
  console.log(`✅ Seeded ${products.length} products across 4 merchant catalogs`);

  // 3. Seed Campaigns / Discount Coupons for Each Merchant
  const campaigns = [
    {
      couponCode: 'WELCOME10',
      merchantId: merchantMap['merchant@razoragent.demo'].id,
      name: 'AeroTech Welcome Boost',
      type: 'FLASH_SALE',
      discountPercent: 10,
      targetSkus: [{ sku: 'WH-001', name: 'AeroSound Pro Wireless ANC Headphones' }],
      reasoning: 'Storefront default campaign: 10% discount on AeroTech gadgets.',
      status: 'ACTIVE'
    },
    {
      couponCode: 'VOLT20',
      merchantId: merchantMap['voltx@razoragent.demo'].id,
      name: 'VoltX Power Sale',
      type: 'INVENTORY_CLEARANCE',
      discountPercent: 20,
      targetSkus: [{ sku: 'PB-006', name: 'VoltMax 20,000mAh Power Bank' }],
      reasoning: 'VoltX power campaign: 20% discount on fast power banks and chargers.',
      status: 'ACTIVE'
    },
    {
      couponCode: 'NEXUS15',
      merchantId: merchantMap['nexus@razoragent.demo'].id,
      name: 'Nexus Gaming Unleashed',
      type: 'FLASH_SALE',
      discountPercent: 15,
      targetSkus: [{ sku: 'GM-005', name: 'Vortex RGB Mechanical Gaming Keyboard' }],
      reasoning: 'Nexus campaign: 15% discount on gaming peripherals.',
      status: 'ACTIVE'
    },
    {
      couponCode: 'DESK10',
      merchantId: merchantMap['ambient@razoragent.demo'].id,
      name: 'Ambient Workspace Elevation',
      type: 'BUNDLE_PROMO',
      discountPercent: 10,
      targetSkus: [{ sku: 'LS-008', name: 'AeroGlow Smart RGB Desk Light Bar' }],
      reasoning: 'Ambient workspace campaign: 10% discount on desk lighting and accessories.',
      status: 'ACTIVE'
    }
  ];

  for (const camp of campaigns) {
    await prisma.campaign.upsert({
      where: { couponCode: camp.couponCode },
      update: camp,
      create: camp
    });
  }
  console.log(`✅ Seeded ${campaigns.length} merchant campaigns with custom discount codes`);

  // 4. Seed Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        sessionId: 'session_init',
        agentName: 'SAFETY_GATE',
        actionType: 'initialize_safety_policies',
        actionPayload: { merchantsCount: 4, registryStatus: 'ACTIVE' },
        explanation: 'RazorAgent Merchant Registry initialized with 4 active multi-tenant merchants.',
        status: 'SUCCESS',
        amountInr: 10000
      },
      {
        sessionId: 'session_init',
        agentName: 'CATALOG_AGENT',
        actionType: 'merchant_registry_sync',
        actionPayload: { totalMerchants: 4, totalProducts: products.length },
        explanation: 'Synchronized 4 merchant catalogs with ACP agent cards and cross-merchant registry.',
        status: 'SUCCESS',
        amountInr: 0
      }
    ]
  });

  console.log('🎉 Multi-Merchant Registry Seeding complete! 4 Merchants Ready.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
