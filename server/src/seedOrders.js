import prisma from './config/db.js';

async function seedRichDashboardData() {
  console.log('⚡ Populating rich merchant dashboard data...');

  const merchants = await prisma.merchant.findMany();
  if (merchants.length === 0) {
    console.log('No merchants found. Please run seed.js first.');
    return;
  }

  const products = await prisma.product.findMany();
  const productsByMerchant = {};
  for (const p of products) {
    if (!productsByMerchant[p.merchantId]) {
      productsByMerchant[p.merchantId] = [];
    }
    productsByMerchant[p.merchantId].push(p);
  }

  const sampleShoppers = [
    { name: 'Arjun Mehta', email: 'arjun.mehta@gmail.com', phone: '+919876543210' },
    { name: 'Neha Sharma', email: 'neha.sharma@outlook.com', phone: '+919812345678' },
    { name: 'Rohan Verma', email: 'rohan.verma@techcorp.in', phone: '+919711223344' },
    { name: 'Pooja Iyer', email: 'pooja.iyer@gmail.com', phone: '+919988776655' },
    { name: 'Vikram Malhotra', email: 'vikram.m@zenith.ai', phone: '+919845012345' },
    { name: 'Ananya Gupta', email: 'ananya.gupta@yahoo.com', phone: '+919822334455' },
    { name: 'Siddharth Rao', email: 'sid.rao@innovate.co', phone: '+919733445566' },
    { name: 'Kavita Patel', email: 'kavita.patel@gmail.com', phone: '+919911223344' }
  ];

  const now = new Date();

  // For each merchant, generate orders across the last 7 days
  for (const merchant of merchants) {
    const merchantProducts = productsByMerchant[merchant.id] || products.slice(0, 3);
    if (merchantProducts.length === 0) continue;

    const campaigns = await prisma.campaign.findMany({ where: { merchantId: merchant.id } });
    const activeCampaign = campaigns.find(c => c.status === 'ACTIVE') || campaigns[0];

    // Days: 6 days ago up to today
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      // 1 to 3 orders per day
      const ordersCountForDay = (dayOffset === 0) ? 3 : (dayOffset % 2 === 0 ? 2 : 1);

      for (let orderIdx = 0; orderIdx < ordersCountForDay; orderIdx++) {
        const orderDate = new Date(now);
        orderDate.setDate(now.getDate() - dayOffset);
        orderDate.setHours(9 + (orderIdx * 4) + Math.floor(Math.random() * 3), Math.floor(Math.random() * 59));

        const shopper = sampleShoppers[(dayOffset * 2 + orderIdx) % sampleShoppers.length];
        const leadProduct = merchantProducts[orderIdx % merchantProducts.length];
        const secondaryProduct = (orderIdx > 0 && merchantProducts.length > 1)
          ? merchantProducts[(orderIdx + 1) % merchantProducts.length]
          : null;

        const isCampaignOrder = (orderIdx % 2 === 0) && activeCampaign;
        const discountPercent = isCampaignOrder ? (activeCampaign.discountPercent || 15) : 0;

        const orderItems = [
          {
            productId: leadProduct.id,
            sku: leadProduct.sku,
            name: leadProduct.name,
            pricePaise: leadProduct.pricePaise,
            priceInr: leadProduct.pricePaise / 100,
            quantity: 1,
            couponCode: isCampaignOrder ? activeCampaign.couponCode : null,
            discountPaise: isCampaignOrder ? Math.round(leadProduct.pricePaise * (discountPercent / 100)) : 0
          }
        ];

        if (secondaryProduct) {
          orderItems.push({
            productId: secondaryProduct.id,
            sku: secondaryProduct.sku,
            name: secondaryProduct.name,
            pricePaise: secondaryProduct.pricePaise,
            priceInr: secondaryProduct.pricePaise / 100,
            quantity: 1,
            couponCode: null,
            discountPaise: 0
          });
        }

        const rawSubtotalPaise = orderItems.reduce((s, i) => s + (i.pricePaise * i.quantity), 0);
        const discountAmountPaise = orderItems.reduce((s, i) => s + (i.discountPaise || 0), 0);
        const totalAmountPaise = rawSubtotalPaise - discountAmountPaise;

        const orderNumber = `ORD-${orderDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
        const razorpayOrderId = `order_${Math.random().toString(36).substring(2, 16)}`;
        const razorpayPaymentId = `pay_${Math.random().toString(36).substring(2, 16)}`;

        const order = await prisma.order.create({
          data: {
            orderNumber,
            merchantId: merchant.id,
            customerName: shopper.name,
            customerEmail: shopper.email,
            customerPhone: shopper.phone,
            totalAmountPaise,
            discountAmountPaise,
            currency: 'INR',
            status: 'PAID',
            razorpayOrderId,
            paymentLinkUrl: `https://rzp.io/i/${Math.random().toString(36).substring(2, 10)}`,
            items: orderItems,
            createdAt: orderDate,
            updatedAt: orderDate
          }
        });

        // Add payment record
        await prisma.payment.create({
          data: {
            orderId: order.id,
            razorpayPaymentId,
            amountPaise: totalAmountPaise,
            currency: 'INR',
            status: 'captured',
            method: 'upi',
            createdAt: orderDate
          }
        });
      }
    }

    console.log(`✅ Seeded historical orders for merchant: ${merchant.storeName}`);
  }

  console.log('🎉 Rich dashboard data seeded successfully!');
}

seedRichDashboardData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
