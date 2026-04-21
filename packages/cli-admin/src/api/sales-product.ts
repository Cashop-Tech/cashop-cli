import { apiRequest } from '../core/client.js';
import type { PageResult, ApiContext } from '../core/types.js';

export type { ApiContext } from '../core/types.js';

// ---------------------------------------------------------------------------
// Base path
// ---------------------------------------------------------------------------

const BASE = '/marketing/cashop-marketing-cms-manager/api/manage/product/site/product';

// ---------------------------------------------------------------------------
// Shared enums / value types
// ---------------------------------------------------------------------------

export type SaleStatus = 'ONLINE' | 'OFFLINE';

// ---------------------------------------------------------------------------
// Request / Response interfaces
// ---------------------------------------------------------------------------

export interface ListSalesProductsParams {
  siteId: string;
  pageIndex?: number;
  pageSize?: number;
  brandIds?: string[];
  categoryCodes?: string[];
  status?: SaleStatus;
  productName?: string;
  merStyleNos?: string;
  productNums?: string;
  isBanned?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minPromotionFeeRate?: number;
  maxPromotionFeeRate?: number;
}

export interface SalesProductItem {
  itemCode: string;
  siteId: string;
  productName: string;
  brandId?: string;
  brandName?: string;
  categoryCode?: string;
  categoryName?: string;
  status: SaleStatus;
  price?: number;
  promotionFeeRate?: number;
  isBanned?: boolean;
  merStyleNo?: string;
  productNum?: string;
  [key: string]: unknown;
}

export interface GetSalesProductDetailParams {
  itemCode: string;
  siteId: string;
  languageCode?: string;
  currencyType?: string;
}

export interface SalesProductDetail extends SalesProductItem {
  description?: string;
  images?: string[];
  skuList?: SalesProductSku[];
  [key: string]: unknown;
}

export interface SalesProductSku {
  skuCode: string;
  skuName?: string;
  price?: number;
  promotionFeeRate?: number;
  stock?: number;
  [key: string]: unknown;
}

export interface GetSalesProductPriceParams {
  itemCode: string;
  siteId: string;
}

export interface SalesProductPriceDetail {
  itemCode: string;
  siteId: string;
  skuPriceInfoList: SkuPriceInfo[];
  [key: string]: unknown;
}

export interface SkuPriceInfo {
  skuCode: string;
  price?: number;
  promotionFeeRate?: number;
  isManualPricing?: boolean;
  [key: string]: unknown;
}

export interface GetSalesProductStockParams {
  itemCode: string;
  siteId: string;
}

export interface SalesProductStockDetail {
  itemCode: string;
  siteId: string;
  skuStockList: SkuStockInfo[];
  [key: string]: unknown;
}

export interface SkuStockInfo {
  skuCode: string;
  stock: number;
  [key: string]: unknown;
}

export interface UpdateSaleStatusParams {
  siteId: string;
  itemCodes: string[];
  saleStatus: SaleStatus;
  reason?: string;
}

export interface UpdatePricesParams {
  itemCode: string;
  siteId: string;
  skuPriceInfoList: Array<{
    skuCode: string;
    promotionFeeRate: number;
  }>;
}

export interface ClearManualPricingParams {
  itemCode: string;
  siteId: string;
  confirm?: boolean;
}

export interface CalculatePromotionFeePriceParams {
  skuCodeList: string[];
  siteId: string;
  promotionFeeRate?: number;
}

export interface CalculatedSkuPrice {
  skuCode: string;
  price?: number;
  promotionFeePrice?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * List sales products with pagination and filters.
 */
export async function listSalesProducts(
  ctx: ApiContext,
  params: ListSalesProductsParams,
): Promise<PageResult<SalesProductItem>> {
  return apiRequest<PageResult<SalesProductItem>>({
    env: ctx.env,
    method: 'POST',
    url: `${BASE}/query-by-page`,
    data: params,
  });
}

/**
 * Get full detail for a single sales product.
 */
export async function getSalesProductDetail(
  ctx: ApiContext,
  params: GetSalesProductDetailParams,
): Promise<SalesProductDetail> {
  return apiRequest<SalesProductDetail>({
    env: ctx.env,
    method: 'POST',
    url: `${BASE}/query-detail`,
    data: params,
  });
}

/**
 * Get price detail (including per-SKU promotion fee rates) for a product.
 */
export async function getSalesProductPrice(
  ctx: ApiContext,
  params: GetSalesProductPriceParams,
): Promise<SalesProductPriceDetail> {
  return apiRequest<SalesProductPriceDetail>({
    env: ctx.env,
    method: 'POST',
    url: `${BASE}/query-price-detail`,
    data: params,
  });
}

/**
 * Get stock information for all SKUs of a product.
 */
export async function getSalesProductStock(
  ctx: ApiContext,
  params: GetSalesProductStockParams,
): Promise<SalesProductStockDetail> {
  return apiRequest<SalesProductStockDetail>({
    env: ctx.env,
    method: 'POST',
    url: `${BASE}/query-stock`,
    data: params,
  });
}

/**
 * Batch update the online/offline sale status for one or more products.
 */
export async function updateSaleStatus(
  ctx: ApiContext,
  params: UpdateSaleStatusParams,
): Promise<boolean> {
  return apiRequest<boolean>({
    env: ctx.env,
    method: 'POST',
    url: `${BASE}/update-sale-status`,
    data: params,
  });
}

/**
 * Update per-SKU promotion fee rates for a product.
 */
export async function updatePrices(
  ctx: ApiContext,
  params: UpdatePricesParams,
): Promise<boolean> {
  return apiRequest<boolean>({
    env: ctx.env,
    method: 'POST',
    url: `${BASE}/update-prices`,
    data: params,
  });
}

/**
 * Clear manual pricing overrides for a product, reverting to automatic pricing.
 */
export async function clearManualPricing(
  ctx: ApiContext,
  params: ClearManualPricingParams,
): Promise<boolean> {
  return apiRequest<boolean>({
    env: ctx.env,
    method: 'POST',
    url: `${BASE}/clear-manual-pricing`,
    data: params,
  });
}

/**
 * Calculate the resulting price for a list of SKUs given a promotion fee rate.
 */
export async function calculatePromotionFeePrice(
  ctx: ApiContext,
  params: CalculatePromotionFeePriceParams,
): Promise<CalculatedSkuPrice[]> {
  return apiRequest<CalculatedSkuPrice[]>({
    env: ctx.env,
    method: 'POST',
    url: `${BASE}/calculate-promotion-fee-price`,
    data: params,
  });
}

// ---------------------------------------------------------------------------
// Site config
// ---------------------------------------------------------------------------

export interface SiteConfig {
  siteId: string;
  siteName: string;
  baseCurrency: string;
  siteRates: { currency: string; rate: number; enabled: boolean }[];
  defaultLanguage: string;
  allLanguages: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Get site configuration including currencies, languages, and exchange rates.
 */
export async function getSiteAllConfig(
  ctx: ApiContext,
  siteId: string,
): Promise<SiteConfig> {
  return apiRequest<SiteConfig>({
    env: ctx.env,
    method: 'GET',
    url: '/marketing/cashop-marketing-cms-manager/api/manage/product/exchange-rate/site-config/getSiteAllConfig',
    params: { siteId },
  });
}
