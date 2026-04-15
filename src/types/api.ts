// Matches the captured shape of /business/cashop-business-aggr-prod/open/product/list `data`.
export interface ProductSummary {
  uniqueId: string;
  spuCode: string;
  productNum: string;
  suppInfoVO: { title: string; sellOut: boolean; spuOnline: boolean };
  skuMainImageUrls: string[];
  skuCurrentPriceInfo: {
    tagPrice: number;
    standPrice: number;
    memberPrice: number;
    promoStatus: number;
    taxIncludedPrice: number;
  };
  brandInfo?: { brandName: string; brandLogo?: string };
  slug?: string;
}

export interface ProductSearchData {
  total: number | null;
  pages: number | null;
  data: ProductSummary[] | null;
  hasNext: boolean | null;
  extra?: { currencyType?: string; traceId?: string; language?: string; searchRequestId?: string };
}

// product/v2 returns a full product document; opaque for P1.
export type ProductDetail = Record<string, unknown> & { spuCode: string };

export interface CartData {
  effectiveCartGroupList: unknown[];
  invalidCartLineList: unknown[];
  totalProductCount: number;
  totalProductAmount: number;
  totalFreightAmount: number;
  totalDiscountAmount: number;
  totalSettleAmount: number;
  cartCount: number;
  currency: string | null;
  ddpEnabled: boolean;
  ddpCountryCode?: string | null;
  totalTaxIncludedAmount?: number;
  totalTaxAmount?: number;
}

// Order summary — matches /trade/cashop-order-prod/api/order/list response item shape.
// Real API uses `orderNo` (not `orderId`), and status is a numeric code (not string enum).
export interface OrderSummary {
  orderNo: string;
  orderGroupNo?: string;
  orderStatus: number;          // e.g. 2 = 待发货
  orderStatusName?: string;
  brandId?: string;
  brandName?: string;
  productCount?: number;
  totalProductAmount?: number;
  paymentAmount?: number;
  currency?: string;
  payOverTime?: string;
  paymentCountDown?: number;
  [key: string]: unknown;
}

// /trade/cashop-order-prod/api/order/list returns PageDTO envelope with nested `data` array.
export interface OrderListData {
  pageIndex: number;
  pageSize: number;
  total: number;
  totalCount?: number;
  pages?: number;
  currentPageSize?: number;
  hasNext?: boolean;
  data: OrderSummary[];
  extra?: unknown;
}

// order detail — GET /api/order/{orderNo}; shape kept opaque per plan.
export type OrderDetail = Record<string, unknown> & { orderNo?: string };

// ---- P5 api-key ----

export type ApiKeyTtl = '30d' | '90d' | '1y' | 'never';

export interface ApiKeyCreateRequest {
  name: string;
  ttl: ApiKeyTtl;
}

export interface ApiKeyCreateResponse {
  kid: string;
  key: string;
  name: string;
  createdAt: number;
  /** null = never expires */
  expiresAt: number | null;
}

export interface ApiKeyListItem {
  kid: string;
  name: string;
  createdAt: number;
  expiresAt: number | null;
  lastUsedAt: number | null;
}

export interface ApiKeyListResponse {
  items: ApiKeyListItem[];
}

export interface ApiKeyRevokeRequest {
  kid: string;
}

export interface ApiKeyRevokeResponse {
  revoked: boolean;
}
