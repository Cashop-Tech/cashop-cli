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
