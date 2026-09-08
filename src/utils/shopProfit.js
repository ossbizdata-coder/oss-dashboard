export const SHOP_PROFIT_MARGINS = {
  CAFE: 0.12,
  BOOKSHOP: 0.15,
  FOODHUT: 0.20,
}

export const getShopMarginRate = (shopCode) => {
  const code = String(shopCode || '').toUpperCase()
  return SHOP_PROFIT_MARGINS[code] ?? 0.10
}

export const getShopProfit = (sales, shopCode) => {
  return Number(sales || 0) * getShopMarginRate(shopCode)
}
