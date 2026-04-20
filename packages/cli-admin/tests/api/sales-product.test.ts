import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import {
  listSalesProducts,
  getSalesProductDetail,
  getSalesProductPrice,
  getSalesProductStock,
  updateSaleStatus,
  updatePrices,
  clearManualPricing,
  calculatePromotionFeePrice,
} from '../../src/api/sales-product.js';

// ---------------------------------------------------------------------------
// Test context and constants
// ---------------------------------------------------------------------------

const ctx = { env: 'stable' as const, token: 'test-token' };
const BASE = '/marketing/cashop-marketing-cms-manager/api/manage/product/site/product';
const HOST = 'https://api.castable.hk';

function ok<T>(data: T) {
  return { success: true, code: 200, message: 'ok', data };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  nock.cleanAll();
});

afterEach(() => {
  nock.cleanAll();
});

// ---------------------------------------------------------------------------
// listSalesProducts
// ---------------------------------------------------------------------------

describe('listSalesProducts', () => {
  it('POSTs to the correct endpoint and returns a PageResult', async () => {
    const mockData = {
      pageIndex: 1,
      pageSize: 20,
      total: 1,
      pages: 1,
      data: [{ itemCode: 'ITEM001', siteId: 'JP', productName: 'Test Product', status: 'ONLINE' as const }],
    };

    nock(HOST)
      .post(`${BASE}/query-by-page`, (body) => {
        expect(body.siteId).toBe('JP');
        expect(body.pageIndex).toBe(1);
        expect(body.pageSize).toBe(20);
        return true;
      })
      .reply(200, ok(mockData));

    const result = await listSalesProducts(ctx, { siteId: 'JP', pageIndex: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.data[0].itemCode).toBe('ITEM001');
    expect(result.data[0].productName).toBe('Test Product');
  });

  it('sends optional filter fields when provided', async () => {
    const mockData = { pageIndex: 1, pageSize: 10, total: 0, pages: 0, data: [] };

    nock(HOST)
      .post(`${BASE}/query-by-page`, (body) => {
        expect(body.siteId).toBe('US');
        expect(body.status).toBe('OFFLINE');
        expect(body.brandIds).toEqual(['B1', 'B2']);
        expect(body.isBanned).toBe(true);
        expect(body.minPrice).toBe(100);
        expect(body.maxPrice).toBe(500);
        return true;
      })
      .reply(200, ok(mockData));

    const result = await listSalesProducts(ctx, {
      siteId: 'US',
      pageIndex: 1,
      pageSize: 10,
      status: 'OFFLINE',
      brandIds: ['B1', 'B2'],
      isBanned: true,
      minPrice: 100,
      maxPrice: 500,
    });
    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getSalesProductDetail
// ---------------------------------------------------------------------------

describe('getSalesProductDetail', () => {
  it('POSTs to query-detail and returns the product detail', async () => {
    const mockDetail = {
      itemCode: 'ITEM001',
      siteId: 'JP',
      productName: 'Test Product',
      status: 'ONLINE' as const,
      description: 'A test product',
      skuList: [{ skuCode: 'SKU001', price: 1000 }],
    };

    nock(HOST)
      .post(`${BASE}/query-detail`, (body) => {
        expect(body.itemCode).toBe('ITEM001');
        expect(body.siteId).toBe('JP');
        return true;
      })
      .reply(200, ok(mockDetail));

    const result = await getSalesProductDetail(ctx, { itemCode: 'ITEM001', siteId: 'JP' });
    expect(result.itemCode).toBe('ITEM001');
    expect(result.description).toBe('A test product');
    expect(result.skuList).toHaveLength(1);
    expect(result.skuList![0].skuCode).toBe('SKU001');
  });
});

// ---------------------------------------------------------------------------
// getSalesProductPrice
// ---------------------------------------------------------------------------

describe('getSalesProductPrice', () => {
  it('POSTs to query-price-detail and returns SKU price info', async () => {
    const mockPrice = {
      itemCode: 'ITEM001',
      siteId: 'JP',
      skuPriceInfoList: [
        { skuCode: 'SKU001', price: 980, promotionFeeRate: 0.05, isManualPricing: false },
        { skuCode: 'SKU002', price: 1200, promotionFeeRate: 0.08, isManualPricing: true },
      ],
    };

    nock(HOST)
      .post(`${BASE}/query-price-detail`, (body) => {
        expect(body.itemCode).toBe('ITEM001');
        expect(body.siteId).toBe('JP');
        return true;
      })
      .reply(200, ok(mockPrice));

    const result = await getSalesProductPrice(ctx, { itemCode: 'ITEM001', siteId: 'JP' });
    expect(result.itemCode).toBe('ITEM001');
    expect(result.skuPriceInfoList).toHaveLength(2);
    expect(result.skuPriceInfoList[0].skuCode).toBe('SKU001');
    expect(result.skuPriceInfoList[0].price).toBe(980);
    expect(result.skuPriceInfoList[1].isManualPricing).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getSalesProductStock
// ---------------------------------------------------------------------------

describe('getSalesProductStock', () => {
  it('POSTs to query-stock and returns SKU stock info', async () => {
    const mockStock = {
      itemCode: 'ITEM001',
      siteId: 'JP',
      skuStockList: [
        { skuCode: 'SKU001', stock: 50 },
        { skuCode: 'SKU002', stock: 0 },
      ],
    };

    nock(HOST)
      .post(`${BASE}/query-stock`, (body) => {
        expect(body.itemCode).toBe('ITEM001');
        expect(body.siteId).toBe('JP');
        return true;
      })
      .reply(200, ok(mockStock));

    const result = await getSalesProductStock(ctx, { itemCode: 'ITEM001', siteId: 'JP' });
    expect(result.itemCode).toBe('ITEM001');
    expect(result.skuStockList).toHaveLength(2);
    expect(result.skuStockList[0].stock).toBe(50);
    expect(result.skuStockList[1].stock).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updateSaleStatus
// ---------------------------------------------------------------------------

describe('updateSaleStatus', () => {
  it('sends ONLINE request without a reason field', async () => {
    nock(HOST)
      .post(`${BASE}/update-sale-status`, (body) => {
        expect(body.siteId).toBe('JP');
        expect(body.itemCodes).toEqual(['ITEM001', 'ITEM002']);
        expect(body.saleStatus).toBe('ONLINE');
        expect(body.reason).toBeUndefined();
        return true;
      })
      .reply(200, ok(true));

    const result = await updateSaleStatus(ctx, {
      siteId: 'JP',
      itemCodes: ['ITEM001', 'ITEM002'],
      saleStatus: 'ONLINE',
    });
    expect(result).toBe(true);
  });

  it('sends OFFLINE request with a reason field', async () => {
    nock(HOST)
      .post(`${BASE}/update-sale-status`, (body) => {
        expect(body.siteId).toBe('JP');
        expect(body.itemCodes).toEqual(['ITEM001']);
        expect(body.saleStatus).toBe('OFFLINE');
        expect(body.reason).toBe('Out of season');
        return true;
      })
      .reply(200, ok(true));

    const result = await updateSaleStatus(ctx, {
      siteId: 'JP',
      itemCodes: ['ITEM001'],
      saleStatus: 'OFFLINE',
      reason: 'Out of season',
    });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updatePrices
// ---------------------------------------------------------------------------

describe('updatePrices', () => {
  it('POSTs to update-prices with the correct skuPriceInfoList structure', async () => {
    nock(HOST)
      .post(`${BASE}/update-prices`, (body) => {
        expect(body.itemCode).toBe('ITEM001');
        expect(body.siteId).toBe('JP');
        expect(body.skuPriceInfoList).toHaveLength(2);
        expect(body.skuPriceInfoList[0].skuCode).toBe('SKU001');
        expect(body.skuPriceInfoList[0].promotionFeeRate).toBe(0.05);
        expect(body.skuPriceInfoList[1].skuCode).toBe('SKU002');
        expect(body.skuPriceInfoList[1].promotionFeeRate).toBe(0.1);
        return true;
      })
      .reply(200, ok(true));

    const result = await updatePrices(ctx, {
      itemCode: 'ITEM001',
      siteId: 'JP',
      skuPriceInfoList: [
        { skuCode: 'SKU001', promotionFeeRate: 0.05 },
        { skuCode: 'SKU002', promotionFeeRate: 0.1 },
      ],
    });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// clearManualPricing
// ---------------------------------------------------------------------------

describe('clearManualPricing', () => {
  it('sends request without confirm flag by default', async () => {
    nock(HOST)
      .post(`${BASE}/clear-manual-pricing`, (body) => {
        expect(body.itemCode).toBe('ITEM001');
        expect(body.siteId).toBe('JP');
        expect(body.confirm).toBeUndefined();
        return true;
      })
      .reply(200, ok(false));

    const result = await clearManualPricing(ctx, { itemCode: 'ITEM001', siteId: 'JP' });
    // Without confirm=true, server may return false indicating confirmation needed
    expect(result).toBe(false);
  });

  it('sends request with confirm=true on second call', async () => {
    nock(HOST)
      .post(`${BASE}/clear-manual-pricing`, (body) => {
        expect(body.itemCode).toBe('ITEM001');
        expect(body.siteId).toBe('JP');
        expect(body.confirm).toBe(true);
        return true;
      })
      .reply(200, ok(true));

    const result = await clearManualPricing(ctx, { itemCode: 'ITEM001', siteId: 'JP', confirm: true });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculatePromotionFeePrice
// ---------------------------------------------------------------------------

describe('calculatePromotionFeePrice', () => {
  it('POSTs to calculate-promotion-fee-price with skuCodeList and promotionFeeRate', async () => {
    const mockCalculated = [
      { skuCode: 'SKU001', price: 1050, promotionFeePrice: 52.5 },
      { skuCode: 'SKU002', price: 840, promotionFeePrice: 42 },
    ];

    nock(HOST)
      .post(`${BASE}/calculate-promotion-fee-price`, (body) => {
        expect(body.skuCodeList).toEqual(['SKU001', 'SKU002']);
        expect(body.siteId).toBe('JP');
        expect(body.promotionFeeRate).toBe(0.05);
        return true;
      })
      .reply(200, ok(mockCalculated));

    const result = await calculatePromotionFeePrice(ctx, {
      skuCodeList: ['SKU001', 'SKU002'],
      siteId: 'JP',
      promotionFeeRate: 0.05,
    });
    expect(result).toHaveLength(2);
    expect(result[0].skuCode).toBe('SKU001');
    expect(result[0].promotionFeePrice).toBe(52.5);
    expect(result[1].skuCode).toBe('SKU002');
  });

  it('omits promotionFeeRate when not provided', async () => {
    nock(HOST)
      .post(`${BASE}/calculate-promotion-fee-price`, (body) => {
        expect(body.skuCodeList).toEqual(['SKU001']);
        expect(body.siteId).toBe('JP');
        expect(body.promotionFeeRate).toBeUndefined();
        return true;
      })
      .reply(200, ok([{ skuCode: 'SKU001', price: 1000 }]));

    const result = await calculatePromotionFeePrice(ctx, {
      skuCodeList: ['SKU001'],
      siteId: 'JP',
    });
    expect(result[0].skuCode).toBe('SKU001');
  });
});
