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

// POST /trade/cashop-order-prod/api/order/create
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-order-create.
export type OrderDeliveryType = 'CONSOLIDATION' | 'DIRECT_MAIL';

export interface OrderCreateProduct {
  spuCode: string;
  skuId: string;
  quantity: number;
}

export interface OrderCreateRequest {
  addressId: string;
  orderWay: 0 | 1;               // 0=cart checkout, 1=direct buy
  products: OrderCreateProduct[];
  deliveryType: OrderDeliveryType;
  dmLineCode?: string;            // required when deliveryType=DIRECT_MAIL
  dmShippingFee?: string;         // required when deliveryType=DIRECT_MAIL
  businessOrderNo?: string;       // idempotency key, format biz_{hash}
}

export interface OrderCreateData {
  orderGroupNo: string;
  orderNoList: string[];
  totalAmount: number;
  currency: string;
  orderStatus: string;            // e.g. "PENDING_PAYMENT"
}

// POST /trade/cashop-order-prod/api/order/cancelOrderBeforePay
// Only PENDING_PAYMENT orders; paid/shipped orders must go through the refund flow.
export interface OrderCancelRequest {
  orderGroupNo: string;
  cancelReasonCode: string;       // backend enum; default "OTHER"
  cancelSource: 'USER';           // CLI is always USER
  cancelReasonMessage: string;
}

// Envelope .data is a bare boolean (true when cancelled).
export type OrderCancelData = boolean;

// POST /trade/cashop-order-prod/api/order/payment/prepay
// Initiates payment for a PENDING_PAYMENT order; returns a URL to complete the charge.
// Default returnUrl/cancelUrl are `cashop://payment/*` (deep links), not HTTPS — the CLI
// forwards whatever the caller passes; operators pointing at a web sandbox should override both.
export interface PrepayRequest {
  orderGroupNo: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PrepayData {
  paymentTradeNo: string;
  paymentUrl: string;
}

// GET /fin/cashop-fin-prod/api/finance/cashier/getPayMethods
// Upstream cashop-fin PayMethodDTO (captured 2026-04-17 from
// PaymentMethodsParserTest#parsesRealUpstreamWithMixedAvailability).
// CLI passes through verbatim; agent-side normalization to {key,label,...} stays in cashop-ai.
export interface PayMethod {
  payMethodCode: string;         // e.g. "GMO_PAY", "BALANCE_PAYMENT", "KONBINI"
  payMethodShowName: string;     // user-facing display name
  payMethodDesc?: string;        // channel description shown when available
  payRemark?: string;            // supplemental remark / supported sub-methods
  payMethodIcon?: string;        // icon URL or filename
  isAvailable: boolean;
  unavailableReason?: string;    // populated when isAvailable=false (e.g. "¥30,000 以上不可用")
}

export type PayMethodsData = PayMethod[];

// POST /trade/cashop-order-prod/api/inventory/fee-trial
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-fee-trial.
// Shape of `data` kept opaque — confirm_delivery cards only read totals we don't yet
// mirror in the CLI; avoid inventing fields until we have a captured fixture.
export interface FeeTrialRequest {
  batchNos: string[];
  addressId: string;
  outerPackageCode: string;     // "DEFAULT" unless caller knows otherwise
  sortType: number;             // always 1 per upstream contract
  lineCode?: string;
}

export type FeeTrialData = Record<string, unknown>;

// POST /trade/cashop-order-prod/api/cart/direct-split
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-direct-split.
// Two-pass flow:
//   1) Without addressId/deliveryType → returns delivery options (hasAvailableLines,
//      directMailShipping, effectiveCartGroupList) for the caller to pick from.
//   2) With addressId + deliveryType   → returns the same shape plus resolved totals
//      (totalFreightAmount, totalSettleAmount, etc).
// Shape kept opaque — downstream agents parse selectively (SplitResultParser.java).
export interface DirectSplitProduct {
  spuCode: string;
  skuId: string;
  quantity: number;
  sizeFormat?: string;
}

export interface DirectSplitRequest {
  products: DirectSplitProduct[];
  targetCountryCode: string;     // "JP" default
  addressId?: string;
  deliveryType?: OrderDeliveryType;
  sizeFormat?: string;           // top-level mirror of product sizeFormat (shell parity)
}

export type DirectSplitData = Record<string, unknown>;

// POST /trade/cashop-order-prod/api/cart/split
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-cart-split.
// All fields optional — bare `{}` returns an all-cart preview without freight.
// Second pass with addressId + deliveryType yields the full breakdown.
export interface CartSplitRequest {
  addressId?: string;
  cartNos?: string[];
  deliveryType?: OrderDeliveryType;
}

export type CartSplitData = Record<string, unknown>;

// GET /trade/cashop-order-prod/api/cart/count
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-cart-count.
export interface CartCountData { count: number; }

// POST /trade/cashop-order-prod/trade/order/v2/modifyAddress
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-order-address.
// Only unshipped orders are modifiable; shipped orders reject at the gateway.
export interface OrderModifyAddressRequest {
  orderNo: string;
  addressId: string;
}

// Envelope .data is a bare boolean (true when updated).
export type OrderModifyAddressData = boolean;

// ---- Address ----

// POST /business/cashop-business-aggr-prod/api/member/address/list
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-address-list.
// Upstream envelope nests an inner `data` array, mirroring other aggr-prod paged endpoints.
export interface AddressSummary {
  addressId: string;
  receiverFirstName: string;
  receiverLastName: string;
  receiverPhone: string;
  phoneAreaCode?: string;
  countryName?: string;
  provinceName?: string;
  cityName?: string;
  detailAddress?: string;
  postalCode?: string;
  isDefault?: boolean;
  [key: string]: unknown;
}

export interface AddressListData {
  data: AddressSummary[];
  total?: number;
  pageIndex?: number;
  pageSize?: number;
  hasNext?: boolean;
  [key: string]: unknown;
}

// POST /business/cashop-business-aggr-prod/api/member/address/save
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-address-save.
// Pass addressId to update; omit to create. `country` is the ISO code (JP/US/HK).
export interface AddressSaveRequest {
  receiverFirstName: string;
  receiverLastName: string;
  receiverPhone: string;
  phoneAreaCode: string;
  country: string;
  province: string;
  city: string;
  detailAddress: string;
  postalCode: string;
  isDefault: boolean;
  addressId?: string;
}

export interface AddressSaveData { addressId: string; }

// ---- Aftersale / Refund ----

// POST /trade/cashop-aftersale/operation-support/cashop-aftersale/api/aftersale/apply
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-refund-apply.
// Note the dual-prefix path: `/trade/cashop-aftersale` + `/operation-support/...` per gateway wiring.

// 2=仅退款(已发货), 4=退货退款, 9=仅退款(未发货)
export type AftersaleType = 2 | 4 | 9;

// 0=不想要了, 1=买错/多买, 2=运费太贵, 3=无质量问题,
// 4=发错货, 5=质量问题, 6=运输破损
export type AftersaleReason = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RefundApplyRequest {
  orderNo: string;
  asType: AftersaleType;
  applyReason: AftersaleReason;
  applyQuantity: number;
  skuOrderNo?: string;
  applyRemark?: string;
}

// data is a bare string — the aftersale service number (e.g. "AS202604100012").
export type RefundApplyData = string;

// ---- Logistics / Tracking ----

// GET /trade/cashop-order-prod/api/order/{orderNo}/tracking
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-logistics.
// Shape kept opaque — tracking payloads vary per carrier.
export type TrackingData = Record<string, unknown>;

// POST /marketing/cashop-marketing/cms/v2/activity/queryActivityList
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-promo-list.
// CLI always calls the authenticated variant (provider injects token). The shell's
// open fallback is only for unauthenticated browsing; CLI sessions always have a provider.
export interface PromoListRequest {
  pageIndex: number;
  pageSize: number;
}

export type PromoListData = Record<string, unknown>;

// POST /marketing/cashop-marketing/cms/v2/coupon/claimCoupon
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-coupon-claim.
// couponId comes from promo list results.
export interface CouponClaimRequest {
  couponId: string;
}

export type CouponClaimData = Record<string, unknown>;

// POST /business/cashop-business-aggr-prod/open/product/size-assistant
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-size-assistant.
// Open endpoint (no auth) — returns size recommendation payload per SPU.
// Shape kept opaque — body varies per category (apparel size chart vs shoe length vs N/A).
export type SizeAssistantData = Record<string, unknown>;

// POST /trade/cashop-order-prod/api/inventory/shipping-fee-query
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-shipping-compare.
// Returns available shipping lines with freight estimates for the given dimensions.
// Shape kept opaque — downstream carriers vary per country; agent parses selectively.
export interface ShippingCompareRequest {
  destinationCountry: string;    // ISO 2-letter (e.g. "JP")
  weight: number;                // grams
  length: number;                // cm
  width: number;                 // cm
  height: number;                // cm
  sortType: number;              // always 1 per upstream contract
}

export type ShippingCompareData = Record<string, unknown>;

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
