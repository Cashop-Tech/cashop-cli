import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import nock from 'nock';
import { registerTools } from '../../src/mcp/tools.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STABLE_API = 'https://api.castable.hk';
const SALES_BASE = '/marketing/cashop-marketing-cms-manager/api/manage/product/site/product';
const RESOURCE_BASE = '/marketing/cashop-marketing-cms-manager/api/manage/resource';

const ALL_TOOL_NAMES = [
  // User / Station tools (3)
  'cashop-console_user_info',
  'cashop-console_station_current',
  'cashop-console_station_switch',
  // Sales product tools (8)
  'cashop-console_sales_product_list',
  'cashop-console_sales_product_detail',
  'cashop-console_sales_product_price',
  'cashop-console_sales_product_stock',
  'cashop-console_sales_product_update_status',
  'cashop-console_sales_product_update_price',
  'cashop-console_sales_product_clear_pricing',
  'cashop-console_sales_product_calc_price',
  // Resource tools (8 basic)
  'cashop-console_resource_list',
  'cashop-console_resource_detail',
  'cashop-console_resource_save',
  'cashop-console_resource_effect',
  'cashop-console_resource_lose_effect',
  'cashop-console_resource_delete',
  'cashop-console_resource_sort',
  'cashop-console_resource_component_tree',
  // Hero banner tools (5)
  'cashop-console_resource_hero_banner_create',
  'cashop-console_resource_hero_banner_list_images',
  'cashop-console_resource_hero_banner_add_image',
  'cashop-console_resource_hero_banner_remove_image',
  'cashop-console_resource_hero_banner_update_image',
  // Brand tools (7)
  'cashop-console_brand_list',
  'cashop-console_brand_detail',
  'cashop-console_brand_story_list',
  'cashop-console_brand_story_detail',
  'cashop-console_brand_story_save',
  'cashop-console_brand_story_update',
  'cashop-console_brand_languages',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createConnectedPair(): Promise<{ client: Client; server: McpServer }> {
  const server = new McpServer({ name: 'cashop-console', version: '0.1.0' });
  registerTools(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.1.0' });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { client, server };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MCP Tools Registration', () => {
  let client: Client;
  let server: McpServer;

  beforeEach(async () => {
    process.env['CASHOP_ENV'] = 'stable';
    process.env['CASHOP_TOKEN'] = 'test-token';

    ({ client, server } = await createConnectedPair());
  });

  afterEach(async () => {
    delete process.env['CASHOP_ENV'];
    delete process.env['CASHOP_TOKEN'];
    nock.cleanAll();
    nock.enableNetConnect();
    await client.close();
  });

  // -------------------------------------------------------------------------
  // Tool registration
  // -------------------------------------------------------------------------

  it('registers exactly 33 tools', async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(33);
  });

  it('all tool names follow the cashop-console_ prefix convention', async () => {
    const result = await client.listTools();
    for (const tool of result.tools) {
      expect(tool.name).toMatch(/^cashop-console_/);
    }
  });

  it('registers all expected tool names', async () => {
    const result = await client.listTools();
    const registered = result.tools.map((t) => t.name);
    for (const expected of ALL_TOOL_NAMES) {
      expect(registered).toContain(expected);
    }
  });

  it('includes all sales product tools', async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);
    expect(names).toContain('cashop-console_sales_product_list');
    expect(names).toContain('cashop-console_sales_product_detail');
    expect(names).toContain('cashop-console_sales_product_price');
    expect(names).toContain('cashop-console_sales_product_stock');
    expect(names).toContain('cashop-console_sales_product_update_status');
    expect(names).toContain('cashop-console_sales_product_update_price');
    expect(names).toContain('cashop-console_sales_product_clear_pricing');
    expect(names).toContain('cashop-console_sales_product_calc_price');
  });

  it('includes all resource tools', async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);
    expect(names).toContain('cashop-console_resource_list');
    expect(names).toContain('cashop-console_resource_detail');
    expect(names).toContain('cashop-console_resource_save');
    expect(names).toContain('cashop-console_resource_effect');
    expect(names).toContain('cashop-console_resource_lose_effect');
    expect(names).toContain('cashop-console_resource_delete');
    expect(names).toContain('cashop-console_resource_sort');
    expect(names).toContain('cashop-console_resource_component_tree');
  });

  it('includes all hero banner tools', async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);
    expect(names).toContain('cashop-console_resource_hero_banner_list_images');
    expect(names).toContain('cashop-console_resource_hero_banner_add_image');
    expect(names).toContain('cashop-console_resource_hero_banner_remove_image');
    expect(names).toContain('cashop-console_resource_hero_banner_update_image');
  });

  it('every tool has a non-empty description', async () => {
    const result = await client.listTools();
    for (const tool of result.tools) {
      expect(tool.description, `Tool "${tool.name}" must have a description`).toBeTruthy();
    }
  });

  it('every tool has an input schema', async () => {
    const result = await client.listTools();
    for (const tool of result.tools) {
      expect(tool.inputSchema, `Tool "${tool.name}" must have an inputSchema`).toBeDefined();
    }
  });

  // -------------------------------------------------------------------------
  // Tool input schema shapes
  // -------------------------------------------------------------------------

  it('sales_product_list schema requires siteId', async () => {
    const result = await client.listTools();
    const tool = result.tools.find((t) => t.name === 'cashop-console_sales_product_list');
    expect(tool).toBeDefined();
    const required: string[] = (tool!.inputSchema as { required?: string[] }).required ?? [];
    expect(required).toContain('siteId');
  });

  it('sales_product_detail schema requires itemCode and siteId', async () => {
    const result = await client.listTools();
    const tool = result.tools.find((t) => t.name === 'cashop-console_sales_product_detail');
    expect(tool).toBeDefined();
    const required: string[] = (tool!.inputSchema as { required?: string[] }).required ?? [];
    expect(required).toContain('itemCode');
    expect(required).toContain('siteId');
  });

  it('resource_detail schema requires id', async () => {
    const result = await client.listTools();
    const tool = result.tools.find((t) => t.name === 'cashop-console_resource_detail');
    expect(tool).toBeDefined();
    const required: string[] = (tool!.inputSchema as { required?: string[] }).required ?? [];
    expect(required).toContain('id');
  });

  it('resource_component_tree has an empty (no required properties) schema', async () => {
    const result = await client.listTools();
    const tool = result.tools.find((t) => t.name === 'cashop-console_resource_component_tree');
    expect(tool).toBeDefined();
    const schema = tool!.inputSchema as { required?: string[]; properties?: Record<string, unknown> };
    // No required fields — the tool takes zero arguments
    expect(schema.required ?? []).toHaveLength(0);
  });

  it('resource_hero_banner_add_image schema requires id and image', async () => {
    const result = await client.listTools();
    const tool = result.tools.find(
      (t) => t.name === 'cashop-console_resource_hero_banner_add_image',
    );
    expect(tool).toBeDefined();
    const required: string[] = (tool!.inputSchema as { required?: string[] }).required ?? [];
    expect(required).toContain('id');
    expect(required).toContain('image');
  });

  // -------------------------------------------------------------------------
  // Tool execution — success path (mocked HTTP via nock)
  // -------------------------------------------------------------------------

  it('sales_product_list returns paginated data on success', async () => {
    nock(STABLE_API)
      .post(`${SALES_BASE}/query-by-page`)
      .reply(200, {
        success: true,
        code: 200,
        message: 'ok',
        data: { pageIndex: 1, pageSize: 20, total: 2, pages: 1, data: [] },
      });

    const result = await client.callTool({
      name: 'cashop-console_sales_product_list',
      arguments: { siteId: 'JP' },
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    const content = result.content[0] as { type: string; text: string };
    expect(content.type).toBe('text');
    const parsed = JSON.parse(content.text) as { total: number };
    expect(parsed.total).toBe(2);
  });

  it('sales_product_detail returns product data on success', async () => {
    // Mock getSiteAllConfig (called before query-detail to resolve currency/language)
    nock(STABLE_API)
      .get('/marketing/cashop-marketing-cms-manager/api/manage/product/exchange-rate/site-config/getSiteAllConfig')
      .query({ siteId: 'JP' })
      .reply(200, {
        success: true,
        code: '00000',
        message: 'ok',
        data: {
          siteId: 'JP',
          siteRates: [{ currency: 'JPY', rate: 24, enabled: true }],
          defaultLanguage: 'zh',
          allLanguages: { '简体中文': 'zh', English: 'en' },
        },
      });

    nock(STABLE_API)
      .post(`${SALES_BASE}/query-detail`)
      .reply(200, {
        success: true,
        code: 200,
        message: 'ok',
        data: { itemCode: 'ITEM001', siteId: 'JP', productName: 'Test Product' },
      });

    const result = await client.callTool({
      name: 'cashop-console_sales_product_detail',
      arguments: { itemCode: 'ITEM001', siteId: 'JP' },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content[0] as { type: string; text: string };
    expect(content.type).toBe('text');
    const parsed = JSON.parse(content.text) as { itemCode: string };
    expect(parsed.itemCode).toBe('ITEM001');
  });

  it('resource_list returns paginated data on success', async () => {
    nock(STABLE_API)
      .post(`${RESOURCE_BASE}/pageList`)
      .reply(200, {
        success: true,
        code: 200,
        message: 'ok',
        data: { pageIndex: 1, pageSize: 20, total: 0, pages: 0, data: [] },
      });

    const result = await client.callTool({
      name: 'cashop-console_resource_list',
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text) as { total: number };
    expect(parsed.total).toBe(0);
  });

  it('resource_component_tree returns tree data on success', async () => {
    nock(STABLE_API)
      .get(`${RESOURCE_BASE}/buildComponentTypeTree`)
      .reply(200, {
        success: true,
        code: 200,
        message: 'ok',
        data: [{ id: '1', name: 'Banner', children: [] }],
      });

    const result = await client.callTool({
      name: 'cashop-console_resource_component_tree',
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text) as Array<{ id: string }>;
    expect(parsed[0]?.id).toBe('1');
  });

  it('tool call result content type is always "text"', async () => {
    nock(STABLE_API)
      .post(`${SALES_BASE}/query-by-page`)
      .reply(200, {
        success: true,
        code: 200,
        message: 'ok',
        data: { pageIndex: 1, pageSize: 20, total: 0, pages: 0, data: [] },
      });

    const result = await client.callTool({
      name: 'cashop-console_sales_product_list',
      arguments: { siteId: 'JP' },
    });

    for (const item of result.content) {
      expect((item as { type: string }).type).toBe('text');
    }
  });

  it('tool call result text is valid JSON', async () => {
    nock(STABLE_API)
      .post(`${SALES_BASE}/query-by-page`)
      .reply(200, {
        success: true,
        code: 200,
        message: 'ok',
        data: { pageIndex: 1, pageSize: 20, total: 0, pages: 0, data: [] },
      });

    const result = await client.callTool({
      name: 'cashop-console_sales_product_list',
      arguments: { siteId: 'JP' },
    });

    const content = result.content[0] as { type: string; text: string };
    expect(() => JSON.parse(content.text)).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Tool execution — error path
  // -------------------------------------------------------------------------

  it('returns isError=true when CASHOP_TOKEN is missing', async () => {
    // Build a fresh pair without the token env var
    delete process.env['CASHOP_TOKEN'];

    const server2 = new McpServer({ name: 'cashop-console', version: '0.1.0' });
    registerTools(server2);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client2 = new Client({ name: 'test-client-2', version: '0.1.0' });
    await Promise.all([server2.connect(st), client2.connect(ct)]);

    const result = await client2.callTool({
      name: 'cashop-console_sales_product_list',
      arguments: { siteId: 'JP' },
    });

    await client2.close();

    expect(result.isError).toBe(true);
    const content = result.content[0] as { type: string; text: string };
    expect(content.type).toBe('text');
    const parsed = JSON.parse(content.text) as { error: string };
    expect(parsed.error).toMatch(/CASHOP_TOKEN/);
  });

  it('returns isError=true when the API responds with a non-success body', async () => {
    nock(STABLE_API)
      .post(`${SALES_BASE}/query-by-page`)
      .reply(200, {
        success: false,
        code: 500,
        message: 'Internal server error',
        data: null,
      });

    const result = await client.callTool({
      name: 'cashop-console_sales_product_list',
      arguments: { siteId: 'JP' },
    });

    expect(result.isError).toBe(true);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text) as { error: string };
    expect(parsed.error).toBeTruthy();
  });

  it('returns isError=true when the API call returns HTTP 4xx', async () => {
    nock(STABLE_API)
      .post(`${SALES_BASE}/query-by-page`)
      .reply(401, { message: 'Unauthorized' });

    const result = await client.callTool({
      name: 'cashop-console_sales_product_list',
      arguments: { siteId: 'JP' },
    });

    expect(result.isError).toBe(true);
  });

  it('returns isError=true when the API call returns HTTP 5xx', async () => {
    nock(STABLE_API)
      .post(`${SALES_BASE}/query-by-page`)
      .reply(503, { message: 'Service unavailable' });

    const result = await client.callTool({
      name: 'cashop-console_sales_product_list',
      arguments: { siteId: 'JP' },
    });

    expect(result.isError).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Multiple registrations with different environments
  // -------------------------------------------------------------------------

  it('uses the prod API base URL when CASHOP_ENV is prod', async () => {
    const prodScope = nock('https://api.cashop.com')
      .post(`${SALES_BASE}/query-by-page`)
      .reply(200, {
        success: true,
        code: 200,
        message: 'ok',
        data: { pageIndex: 1, pageSize: 20, total: 5, pages: 1, data: [] },
      });

    // Switch env for this call — getMcpContext reads env at call time
    process.env['CASHOP_ENV'] = 'prod';

    const result = await client.callTool({
      name: 'cashop-console_sales_product_list',
      arguments: { siteId: 'JP' },
    });

    expect(result.isError).toBeFalsy();
    expect(prodScope.isDone()).toBe(true);
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text) as { total: number };
    expect(parsed.total).toBe(5);
  });
});
