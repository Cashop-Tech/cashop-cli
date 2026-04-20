import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import {
  listResources,
  getResourceDetail,
  saveOrUpdateResource,
  effectResource,
  loseEffectResource,
  deleteResource,
  sortResource,
  getComponentTypeTree,
  createHeroBanner,
  heroBannerListImages,
  heroBannerAddImage,
  heroBannerRemoveImage,
  heroBannerUpdateImage,
} from '../../src/api/resource.js';
import type { ResourceDetail, HeroBannerContent } from '../../src/api/resource.js';

// ---------------------------------------------------------------------------
// Test context and constants
// ---------------------------------------------------------------------------

const ctx = { env: 'stable' as const, token: 'test-token' };
const BASE = '/marketing/cashop-marketing-cms-manager/api/manage/resource';
const HOST = 'https://api.castable.hk';

function ok<T>(data: T) {
  return { success: true, code: 200, message: 'ok', data };
}

// ---------------------------------------------------------------------------
// Shared hero banner fixtures
// ---------------------------------------------------------------------------

const heroBannerContent: HeroBannerContent = {
  bannerType: 'insert_heroBanner',
  supportClick: 1,
  imgList: [
    {
      bannerId: '1',
      themeColor: '#000000',
      imgUrl: 'https://example.com/img1.jpg',
      startTime: '2026-01-01 00:00:00',
      endTime: '2026-06-30 23:59:59',
      supportClick: 1,
      showChannel: 'app,h5',
      showThrong: 'all',
    },
    {
      bannerId: '2',
      themeColor: '#FFFFFF',
      imgUrl: 'https://example.com/img2.jpg',
      startTime: '2026-03-01 00:00:00',
      endTime: '2026-12-31 23:59:59',
      supportClick: 2,
      showChannel: 'app',
      showThrong: 'role',
      showThrongValue: 'Seller,VIP',
    },
  ],
};

const mockDetail: ResourceDetail = {
  id: '12345',
  name: 'Test Banner',
  type: 'insert_heroBanner',
  location: 'home_all_resource',
  showChannel: 'app',
  showThrong: 'all',
  startTime: '2026-01-01',
  endTime: '2026-12-31',
  version: 1,
  content: JSON.stringify(heroBannerContent),
};

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
// listResources
// ---------------------------------------------------------------------------

describe('listResources', () => {
  it('POSTs to pageList and returns a PageResult', async () => {
    const mockData = {
      pageIndex: 1,
      pageSize: 10,
      total: 2,
      pages: 1,
      data: [
        { id: '1', name: 'Banner A', type: 'insert_heroBanner' },
        { id: '2', name: 'Banner B', type: 'insert_heroBanner' },
      ],
    };

    nock(HOST)
      .post(`${BASE}/pageList`, (body) => {
        expect(body.pageIndex).toBe(1);
        expect(body.pageSize).toBe(10);
        expect(body.type).toBe('insert_heroBanner');
        return true;
      })
      .reply(200, ok(mockData));

    const result = await listResources(ctx, { pageIndex: 1, pageSize: 10, type: 'insert_heroBanner' });
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('1');
    expect(result.data[1].name).toBe('Banner B');
  });
});

// ---------------------------------------------------------------------------
// getResourceDetail
// ---------------------------------------------------------------------------

describe('getResourceDetail', () => {
  it('POSTs to detail with id as query param and auto-parses content JSON', async () => {
    const rawContent = { bannerType: 'insert_heroBanner', supportClick: 1, imgList: [] };
    const rawDetail = { ...mockDetail, content: JSON.stringify(rawContent) };

    nock(HOST)
      .post(`${BASE}/detail`)
      .query({ id: '12345' })
      .reply(200, ok(rawDetail));

    const result = await getResourceDetail(ctx, { id: '12345' });
    expect(result.id).toBe('12345');
    expect(result.name).toBe('Test Banner');
    // content should be parsed from JSON string to object
    expect(typeof result.content).toBe('object');
    expect(result.content).toEqual(rawContent);
  });

  it('leaves content as-is when it is empty', async () => {
    const rawDetail = { ...mockDetail, content: '' };

    nock(HOST)
      .post(`${BASE}/detail`)
      .query({ id: '12345' })
      .reply(200, ok(rawDetail));

    const result = await getResourceDetail(ctx, { id: '12345' });
    expect(result.content).toBe('');
  });
});

// ---------------------------------------------------------------------------
// saveOrUpdateResource
// ---------------------------------------------------------------------------

describe('saveOrUpdateResource', () => {
  it('POSTs to saveOrUpdate with the full resource payload', async () => {
    const params = {
      id: '12345',
      location: 'home_all_resource',
      type: 'insert_heroBanner',
      name: 'Updated Banner',
      showChannel: 'app',
      showThrong: 'all',
      startTime: '2026-01-01',
      endTime: '2026-12-31',
      content: JSON.stringify(heroBannerContent),
      version: 1,
    };

    nock(HOST)
      .post(`${BASE}/saveOrUpdate`, (body) => {
        expect(body.id).toBe('12345');
        expect(body.name).toBe('Updated Banner');
        expect(body.version).toBe(1);
        expect(typeof body.content).toBe('string');
        return true;
      })
      .reply(200, ok({ ...mockDetail, name: 'Updated Banner' }));

    const result = await saveOrUpdateResource(ctx, params);
    expect(result.id).toBe('12345');
    expect(result.name).toBe('Updated Banner');
  });
});

// ---------------------------------------------------------------------------
// effectResource
// ---------------------------------------------------------------------------

describe('effectResource', () => {
  it('POSTs to effect with id and version as query params', async () => {
    nock(HOST)
      .post(`${BASE}/effect`)
      .query({ id: '12345', version: '1' })
      .reply(200, ok(true));

    const result = await effectResource(ctx, { id: '12345', version: 1 });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loseEffectResource
// ---------------------------------------------------------------------------

describe('loseEffectResource', () => {
  it('POSTs to loseEffect with id and version as query params', async () => {
    nock(HOST)
      .post(`${BASE}/loseEffect`)
      .query({ id: '12345', version: '2' })
      .reply(200, ok(true));

    const result = await loseEffectResource(ctx, { id: '12345', version: 2 });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deleteResource
// ---------------------------------------------------------------------------

describe('deleteResource', () => {
  it('POSTs to delete with id and version as query params', async () => {
    nock(HOST)
      .post(`${BASE}/delete`)
      .query({ id: '12345', version: '1' })
      .reply(200, ok(true));

    const result = await deleteResource(ctx, { id: '12345', version: 1 });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sortResource
// ---------------------------------------------------------------------------

describe('sortResource', () => {
  it('POSTs to sort/edit with id, sortValue, and version as query params', async () => {
    nock(HOST)
      .post(`${BASE}/sort/edit`)
      .query({ id: '12345', sortValue: '5', version: '1' })
      .reply(200, ok(true));

    const result = await sortResource(ctx, { id: '12345', sortValue: 5, version: 1 });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getComponentTypeTree
// ---------------------------------------------------------------------------

describe('getComponentTypeTree', () => {
  it('GETs buildComponentTypeTree and returns the component type tree', async () => {
    const mockTree = [
      {
        type: 'insert_heroBanner',
        label: 'Hero Banner',
        children: [
          { type: 'insert_heroBanner_single', label: 'Single Banner' },
        ],
      },
      { type: 'insert_carousel', label: 'Carousel' },
    ];

    nock(HOST)
      .get(`${BASE}/buildComponentTypeTree`)
      .reply(200, ok(mockTree));

    const result = await getComponentTypeTree(ctx);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('insert_heroBanner');
    expect(result[0].children).toHaveLength(1);
    expect(result[1].type).toBe('insert_carousel');
  });
});

// ---------------------------------------------------------------------------
// heroBannerListImages
// ---------------------------------------------------------------------------

describe('heroBannerListImages', () => {
  it('fetches detail and returns imgList from parsed content', async () => {
    nock(HOST)
      .post(`${BASE}/detail`)
      .query({ id: '12345' })
      .reply(200, ok(mockDetail));

    const result = await heroBannerListImages(ctx, { id: '12345' });
    expect(result).toHaveLength(2);
    expect(result[0].bannerId).toBe('1');
    expect(result[0].imgUrl).toBe('https://example.com/img1.jpg');
    expect(result[1].bannerId).toBe('2');
    expect(result[1].themeColor).toBe('#FFFFFF');
  });
});

// ---------------------------------------------------------------------------
// heroBannerAddImage
// ---------------------------------------------------------------------------

describe('heroBannerAddImage', () => {
  it('fetches detail then saves with the new image appended to imgList', async () => {
    const newImage = { themeColor: '#000000' as const, imgUrl: 'https://example.com/img3.jpg' };

    nock(HOST)
      .post(`${BASE}/detail`)
      .query({ id: '12345' })
      .reply(200, ok(mockDetail));

    nock(HOST)
      .post(`${BASE}/saveOrUpdate`, (body) => {
        const content = JSON.parse(body.content as string) as HeroBannerContent;
        expect(content.imgList).toHaveLength(3);
        expect(content.imgList[2].imgUrl).toBe('https://example.com/img3.jpg');
        expect(content.imgList[2].themeColor).toBe('#000000');
        // bannerId should be auto-generated since we did not supply one
        expect(typeof content.imgList[2].bannerId).toBe('string');
        expect(content.imgList[2].bannerId!.length).toBeGreaterThan(0);
        return true;
      })
      .reply(200, ok(mockDetail));

    const result = await heroBannerAddImage(ctx, { id: '12345', image: newImage });
    expect(result.id).toBe('12345');
  });

  it('preserves the supplied bannerId when one is provided', async () => {
    const newImage = { bannerId: 'CUSTOM-ID', themeColor: '#000000' as const, imgUrl: 'https://example.com/img4.jpg' };

    nock(HOST)
      .post(`${BASE}/detail`)
      .query({ id: '12345' })
      .reply(200, ok(mockDetail));

    nock(HOST)
      .post(`${BASE}/saveOrUpdate`, (body) => {
        const content = JSON.parse(body.content as string) as HeroBannerContent;
        expect(content.imgList[2].bannerId).toBe('CUSTOM-ID');
        return true;
      })
      .reply(200, ok(mockDetail));

    await heroBannerAddImage(ctx, { id: '12345', image: newImage });
  });
});

// ---------------------------------------------------------------------------
// heroBannerRemoveImage
// ---------------------------------------------------------------------------

describe('heroBannerRemoveImage', () => {
  it('fetches detail then saves with the image at the given index removed', async () => {
    nock(HOST)
      .post(`${BASE}/detail`)
      .query({ id: '12345' })
      .reply(200, ok(mockDetail));

    nock(HOST)
      .post(`${BASE}/saveOrUpdate`, (body) => {
        const content = JSON.parse(body.content as string) as HeroBannerContent;
        // Removing index 0 should leave only the second image
        expect(content.imgList).toHaveLength(1);
        expect(content.imgList[0].bannerId).toBe('2');
        return true;
      })
      .reply(200, ok(mockDetail));

    const result = await heroBannerRemoveImage(ctx, { id: '12345', index: 0 });
    expect(result.id).toBe('12345');
  });

  it('throws RangeError when index is out of bounds', async () => {
    nock(HOST)
      .post(`${BASE}/detail`)
      .query({ id: '12345' })
      .reply(200, ok(mockDetail));

    await expect(heroBannerRemoveImage(ctx, { id: '12345', index: 99 })).rejects.toThrow(
      'Index 99 is out of bounds for imgList of length 2',
    );
  });

  it('throws a RangeError instance when index is out of bounds', async () => {
    nock(HOST)
      .post(`${BASE}/detail`)
      .query({ id: '12345' })
      .reply(200, ok(mockDetail));

    await expect(heroBannerRemoveImage(ctx, { id: '12345', index: 99 })).rejects.toThrow(RangeError);
  });

  it('throws RangeError when index is negative', async () => {
    nock(HOST)
      .post(`${BASE}/detail`)
      .query({ id: '12345' })
      .reply(200, ok(mockDetail));

    await expect(heroBannerRemoveImage(ctx, { id: '12345', index: -1 })).rejects.toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// heroBannerUpdateImage
// ---------------------------------------------------------------------------

describe('heroBannerUpdateImage', () => {
  it('fetches detail then saves with the image at index merged with partial data', async () => {
    nock(HOST)
      .post(`${BASE}/detail`)
      .query({ id: '12345' })
      .reply(200, ok(mockDetail));

    nock(HOST)
      .post(`${BASE}/saveOrUpdate`, (body) => {
        const content = JSON.parse(body.content as string) as HeroBannerContent;
        expect(content.imgList).toHaveLength(2);
        // Index 1 should be merged: original bannerId/themeColor preserved, imgUrl updated
        const updated = content.imgList[1];
        expect(updated.bannerId).toBe('2');
        expect(updated.themeColor).toBe('#FFFFFF');
        expect(updated.imgUrl).toBe('https://example.com/img2-updated.jpg');
        // Index 0 should be untouched
        expect(content.imgList[0].bannerId).toBe('1');
        return true;
      })
      .reply(200, ok(mockDetail));

    const result = await heroBannerUpdateImage(ctx, {
      id: '12345',
      index: 1,
      image: { imgUrl: 'https://example.com/img2-updated.jpg' },
    });
    expect(result.id).toBe('12345');
  });

  it('throws RangeError when index is out of bounds', async () => {
    nock(HOST)
      .post(`${BASE}/detail`)
      .query({ id: '12345' })
      .reply(200, ok(mockDetail));

    await expect(
      heroBannerUpdateImage(ctx, { id: '12345', index: 5, image: { imgUrl: 'https://example.com/new.jpg' } }),
    ).rejects.toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// createHeroBanner — per-item time auto-calculation
// ---------------------------------------------------------------------------

describe('createHeroBanner', () => {
  it('auto-calculates resource-level startTime/endTime from per-item times', async () => {
    // Mock listResources (for finding latest active banner)
    nock(HOST)
      .post(`${BASE}/pageList`)
      .reply(200, ok({ data: [], total: 0 }));

    nock(HOST)
      .post(`${BASE}/saveOrUpdate`, (body) => {
        // Resource-level time should be min(startTime) ~ max(endTime) of items
        expect(body.startTime).toBe('2026-01-01 00:00:00');
        expect(body.endTime).toBe('2026-12-31 23:59:59');
        // Resource-level showChannel/showThrong should be forced to widest values
        expect(body.showChannel).toBe('app,h5');
        expect(body.showThrong).toBe('all');
        return true;
      })
      .reply(200, ok(mockDetail));

    await createHeroBanner(ctx, {
      content: heroBannerContent,
    });
  });
});
