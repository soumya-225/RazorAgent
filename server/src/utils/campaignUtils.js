/**
 * Utility functions for matching products with active campaigns and computing discounts
 */

export function extractTargetSkus(targetSkus) {
  if (!targetSkus) return [];
  if (Array.isArray(targetSkus)) {
    return targetSkus.map(item => {
      if (typeof item === 'string') return item.toUpperCase();
      if (item && typeof item === 'object') return (item.sku || item.id || '').toUpperCase();
      return '';
    }).filter(Boolean);
  }
  if (typeof targetSkus === 'string') {
    try {
      const parsed = JSON.parse(targetSkus);
      return extractTargetSkus(parsed);
    } catch {
      return [targetSkus.toUpperCase()];
    }
  }
  return [];
}

/**
 * Returns active campaign discount details for a given product if applicable
 */
export function getProductActiveCampaign(product, activeCampaigns = []) {
  if (!product || !activeCampaigns || activeCampaigns.length === 0) return null;

  for (const camp of activeCampaigns) {
    if (camp.status !== 'ACTIVE') continue;

    // If campaign is merchant-specific, ensure product belongs to same merchant
    if (camp.merchantId && product.merchantId && camp.merchantId !== product.merchantId) {
      continue;
    }

    const targetedSkus = extractTargetSkus(camp.targetSkus);
    const productSku = (product.sku || '').toUpperCase();
    const productId = (product.id || '').toUpperCase();

    const isTargeted = targetedSkus.length === 0 ||
      targetedSkus.includes(productSku) ||
      targetedSkus.includes(productId);

    if (isTargeted) {
      const pricePaise = product.pricePaise || (product.priceInr ? Math.round(product.priceInr * 100) : 0);
      const priceInr = pricePaise / 100;
      const discountPercent = camp.discountPercent || 10;
      const discountedPriceInr = Math.round((priceInr * (100 - discountPercent))) / 100;
      const savingsInr = Math.round((priceInr - discountedPriceInr) * 100) / 100;

      return {
        campaignId: camp.id,
        campaignName: camp.name,
        couponCode: camp.couponCode,
        discountPercent,
        discountedPriceInr,
        savingsInr,
        originalPriceInr: priceInr,
        type: camp.type
      };
    }
  }

  return null;
}
