import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import nock from 'nock';
import { registerTools } from '../../src/mcp/tools.js';
import { setStaticAccessToken } from '../../src/core/client.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STABLE_API = 'https://api.castable.hk';
const SALES_BASE = '/marketing/cashop-marketing-cms-manager/api/manage/product/site/product';
const RESOURCE_BASE = '/marketing/cashop-marketing-cms-manager/api/manage/resource';

const ALL_TOOL_NAMES = [
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
  // Upload tools (2)
  'cashop-console_upload_file',
  'cashop-console_upload_presign',
] as const;

async function createConnectedPair(): Promise<{ client: Client; server: McpServer }> {
  const server = new McpServer({ name: 'cashop-console', version: '0.1.0' });
  registerTools(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.1.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

describe('MCP Tools Registration', () => {
  let client: Client;
  let server: McpServer;

  beforeEach(async () => {
    process.env['CASHOP_ENV'] = 'stable';
    process.env['CASHOP_ACCESS_TOKEN'] = 'test-access-token';
    ({ client, server } = await createConnectedPair());
  });

  afterEach(async () => {
    delete process.env['CASHOP_ENV'];
    delete process.env['CASHOP_ACCESS_TOKEN'];
    delete process.env['CASHOP_TOKEN'];
    setStaticAccessToken(undefined);
    nock.cleanAll();
    nock.enableNetConnect();
    await client.close();
  });

  it(`registers exactly ${ALL_TOOL_NAMES.length} tools`, async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(ALL_TOOL_NAMES.length);
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

  it('every tool has a non-empty description', async () => {
    const result = await client.listTools();
    for (const tool of result.tools) {
      expect(tool.description).toBeTruthy();
    }
  });

  it('every tool has an input schema', async () => {
    const result = await client.listTools();
    for (const tool of result.tools) {
      expect(tool.inputSchema).toBeDefined();
    }
  });

  // -----------------------------------------------------------------------
  // Tool input schema shapes
  // -----------------------------------------------------------------------

  it('sales_product_list schema requires siteId', async () => {
    const result = await client.listTools();
    const tool = result.tools.find((t) => t.name === 'cashop-console_sales_product_list');
    const required: string[] = (tool!.inputSchema as { required?: string[] }).required ?? [];
    expect(required).toContain('siteId');
  });

  it('resource_detail schema requires id', async () => {
    const result = await client.listTools();
    const tool = result.tools.find((t) => t.name === 'cashop-console_resource_detail');
    const required: string[] = (tool!.inputSchema as { required?: string[] }).required ?? [];
    expect(required).toContain('id');
  });

  // -----------------------------------------------------------------------
  // Tool execution — success path (CASHOP_ACCESS_TOKEN)
  // -----------------------------------------------------------------------

  it('sales_product_list returns paginated data using CASHOP_ACCESS_TOKEN', async () => {
    nock(STABLE_API)
      .post(`${SALES_BASE}/query-by-page`)
      .matchHeader('authorization', 'Bearer test-access-token')
      .reply(200, {
        success: true,
        code: 0,
        message: 'ok',
        data: { pageIndex: 1, pageSize: 20, total: 2, pages: 1, data: [] },
      });

    const result = await client.callTool({
      name: 'cashop-console_sales_product_list',
      arguments: { siteId: 'JP' },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text) as { total: number };
    expect(parsed.total).toBe(2);
  });

  it('resource_list returns paginated data on success', async () => {
    nock(STABLE_API)
      .post(`${RESOURCE_BASE}/pageList`)
      .reply(200, {
        success: true,
        code: 0,
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

  // -----------------------------------------------------------------------
  // Env switching
  // -----------------------------------------------------------------------

  it('uses the prod API base URL when CASHOP_ENV is prod', async () => {
    const prodScope = nock('https://api.cashop.com')
      .post(`${SALES_BASE}/query-by-page`)
      .reply(200, {
        success: true,
        code: 0,
        message: 'ok',
        data: { pageIndex: 1, pageSize: 20, total: 5, pages: 1, data: [] },
      });

    process.env['CASHOP_ENV'] = 'prod';
    const result = await client.callTool({
      name: 'cashop-console_sales_product_list',
      arguments: { siteId: 'JP' },
    });

    expect(result.isError).toBeFalsy();
    expect(prodScope.isDone()).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Error paths
  // -----------------------------------------------------------------------

  it('returns isError=true when API responds with non-success envelope', async () => {
    nock(STABLE_API)
      .post(`${SALES_BASE}/query-by-page`)
      .reply(200, { success: false, code: 500, message: 'boom', data: null });

    const result = await client.callTool({
      name: 'cashop-console_sales_product_list',
      arguments: { siteId: 'JP' },
    });
    expect(result.isError).toBe(true);
  });

  it('returns isError=true when API returns HTTP 5xx', async () => {
    nock(STABLE_API)
      .post(`${SALES_BASE}/query-by-page`)
      .reply(503, { message: 'Service unavailable' });

    const result = await client.callTool({
      name: 'cashop-console_sales_product_list',
      arguments: { siteId: 'JP' },
    });
    expect(result.isError).toBe(true);
  });

  it('returns isError=true when no CASHOP_ACCESS_TOKEN and no config bundle', async () => {
    delete process.env['CASHOP_ACCESS_TOKEN'];
    delete process.env['CASHOP_TOKEN'];
    setStaticAccessToken(undefined);

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
    const parsed = JSON.parse(content.text) as { error: string };
    expect(parsed.error).toMatch(/未登录/);
  });
});
