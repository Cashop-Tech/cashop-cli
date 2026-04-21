import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EnvironmentName } from '../core/environments.js';
import { setStaticAccessToken } from '../core/client.js';
import { uploadFile, getPresignedUploadUrl } from '../api/upload.js';
import {
  listSalesProducts,
  getSalesProductDetail,
  getSalesProductPrice,
  getSalesProductStock,
  updateSaleStatus,
  updatePrices,
  clearManualPricing,
  calculatePromotionFeePrice,
  getSiteAllConfig,
} from '../api/sales-product.js';
import {
  listResources,
  getResourceDetail,
  saveOrUpdateResource,
  effectResource,
  loseEffectResource,
  deleteResource,
  sortResource,
  getComponentTypeTree,
  heroBannerListImages,
  heroBannerAddImage,
  heroBannerRemoveImage,
  heroBannerUpdateImage,
  createHeroBanner,
} from '../api/resource.js';
import {
  listBrands,
  getBrandDetail,
  listBrandStories,
  getBrandStoryDetail,
  saveBrandStory,
  updateBrandStory,
  getSupportedLanguages,
} from '../api/brand.js';

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

interface McpAuthContext {
  env: EnvironmentName;
}

/**
 * Resolve env and install a static accessToken override if the caller set
 * CASHOP_ACCESS_TOKEN (or legacy CASHOP_TOKEN). When no env-supplied token is
 * present, requests fall back to the normal config-backed auth (which
 * requires the user to have run `cashop-console auth login`).
 */
function getMcpContext(): McpAuthContext {
  const env = (process.env['CASHOP_ENV'] ?? 'prod') as EnvironmentName;
  const token = process.env['CASHOP_ACCESS_TOKEN'] ?? process.env['CASHOP_TOKEN'];
  setStaticAccessToken(token);
  return { env };
}

// ---------------------------------------------------------------------------
// Shared helper to wrap API calls uniformly
// ---------------------------------------------------------------------------

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: true;
};

async function callApi<T>(fn: () => Promise<T>): Promise<ToolResult> {
  try {
    const result = await fn();
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Zod schemas for reusable nested types
// ---------------------------------------------------------------------------

const overlayButtonSchema = z.union([
  z.object({
    type: z.literal('text'),
    text: z.string(),
    color: z.string().optional(),
    fontSize: z.number().optional(),
  }),
  z.object({
    type: z.literal('image'),
    imgUrl: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
]);

const overlaySchema = z.union([
  z.object({
    type: z.literal('text'),
    text: z.string(),
    color: z.string().optional(),
    fontSize: z.number().optional(),
    position: z
      .object({ x: z.number().optional(), y: z.number().optional() })
      .optional(),
    button: overlayButtonSchema.optional(),
  }),
  z.object({
    type: z.literal('image'),
    imgUrl: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
    position: z
      .object({ x: z.number().optional(), y: z.number().optional() })
      .optional(),
    button: overlayButtonSchema.optional(),
  }),
]);

const heroBannerImageSchema = z.object({
  bannerId: z.string().optional().describe('Banner ID (auto-generated if omitted)'),
  themeColor: z.enum(['#000000', '#FFFFFF']).describe('Theme color of the banner'),
  placeholderColor: z.string().optional().describe('Placeholder color while image loads'),
  imgUrl: z.string().describe('Image URL'),
  imgUrlI18n: z.string().optional().describe('Internationalised image URL'),
  width: z.number().optional().describe('Image width in pixels'),
  height: z.number().optional().describe('Image height in pixels'),
  skipType: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ])
    .optional()
    .describe('Link type: 1=product detail, 2=brand, 3=category, 4=external url, 5=custom link'),
  productId: z.string().optional(),
  itemCode: z.string().optional(),
  brandId: z.string().optional(),
  outAppUrl: z.string().optional(),
  categoryId: z.string().optional(),
  customLink: z.string().optional(),
  overlay: overlaySchema.optional().describe('Overlay config (text or image overlay)'),
  startTime: z.string().optional().describe('Effective start time (yyyy-MM-dd HH:mm:ss)'),
  endTime: z.string().optional().describe('Effective end time (yyyy-MM-dd HH:mm:ss)'),
  supportClick: z.union([z.literal(1), z.literal(2)]).optional().describe('Click support: 1=clickable, 2=not clickable'),
  showChannel: z.string().optional().describe('Display channel (comma-separated: app,h5)'),
  showThrong: z.string().optional().describe('Target display: all=everyone, role=by user role'),
  showThrongValue: z.string().optional().describe('Target role values (comma-separated, when showThrong=role)'),
});

const heroBannerImagePartialSchema = heroBannerImageSchema.partial();

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // Sales Product tools (8)
  // -------------------------------------------------------------------------

  server.tool(
    'cashop-console_sales_product_list',
    'List sales products with pagination and filters',
    {
      siteId: z.string().describe('Site ID (required)'),
      pageIndex: z.number().optional().describe('Page number (default: 1)'),
      pageSize: z.number().optional().describe('Page size (default: 20)'),
      brandIds: z.array(z.string()).optional().describe('Filter by brand IDs'),
      categoryCodes: z.array(z.string()).optional().describe('Filter by category codes'),
      status: z.enum(['ONLINE', 'OFFLINE']).optional().describe('Sale status filter'),
      productName: z.string().optional().describe('Fuzzy match on product name'),
      merStyleNos: z.string().optional().describe('Comma-separated merchant style numbers'),
      productNums: z.string().optional().describe('Comma-separated product numbers'),
      isBanned: z.boolean().optional().describe('Filter banned/non-banned products'),
      minPrice: z.number().optional().describe('Minimum price filter'),
      maxPrice: z.number().optional().describe('Maximum price filter'),
      minPromotionFeeRate: z.number().optional().describe('Minimum promotion fee rate'),
      maxPromotionFeeRate: z.number().optional().describe('Maximum promotion fee rate'),
    },
    async (params) => {
      return callApi(() => listSalesProducts(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_sales_product_detail',
    'Get full detail for a single sales product',
    {
      itemCode: z.string().describe('Product item code (required)'),
      siteId: z.string().describe('Site ID, e.g. US, JP, KR (required)'),
      languageCode: z.string().optional().default('zh').describe('Language code, e.g. zh, en'),
      currencyType: z.string().optional().describe('Currency code, e.g. USD, JPY. Defaults based on siteId'),
    },
    async (params) => {
      const ctx = getMcpContext();
      const siteConfig = await getSiteAllConfig(ctx, params.siteId);
      const defaultCurrency = siteConfig.siteRates?.[0]?.currency ?? 'USD';
      return callApi(() => getSalesProductDetail(ctx, {
        ...params,
        languageCode: params.languageCode ?? siteConfig.defaultLanguage ?? 'zh',
        currencyType: params.currencyType ?? defaultCurrency,
      }));
    },
  );

  server.tool(
    'cashop-console_sales_product_price',
    'Get price detail including per-SKU promotion fee rates for a product',
    {
      itemCode: z.string().describe('Product item code (required)'),
      siteId: z.string().describe('Site ID (required)'),
    },
    async (params) => {
      return callApi(() => getSalesProductPrice(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_sales_product_stock',
    'Get stock information for all SKUs of a product',
    {
      itemCode: z.string().describe('Product item code (required)'),
      siteId: z.string().describe('Site ID (required)'),
    },
    async (params) => {
      return callApi(() => getSalesProductStock(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_sales_product_update_status',
    'Batch update the online/offline sale status for one or more products',
    {
      siteId: z.string().describe('Site ID (required)'),
      itemCodes: z.array(z.string()).describe('List of item codes to update (required)'),
      saleStatus: z.enum(['ONLINE', 'OFFLINE']).describe('Target sale status (required)'),
      reason: z.string().optional().describe('Reason for status change (optional)'),
    },
    async (params) => {
      return callApi(() => updateSaleStatus(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_sales_product_update_price',
    'Update per-SKU promotion fee rates for a product',
    {
      itemCode: z.string().describe('Product item code (required)'),
      siteId: z.string().describe('Site ID (required)'),
      skuPriceInfoList: z
        .array(
          z.object({
            skuCode: z.string().describe('SKU code'),
            promotionFeeRate: z.number().describe('Promotion fee rate (0–1)'),
          }),
        )
        .describe('List of SKU price updates (required)'),
    },
    async (params) => {
      return callApi(() => updatePrices(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_sales_product_clear_pricing',
    'Clear manual pricing overrides for a product, reverting to automatic pricing',
    {
      itemCode: z.string().describe('Product item code (required)'),
      siteId: z.string().describe('Site ID (required)'),
      confirm: z
        .boolean()
        .optional()
        .describe('Explicit confirmation flag (optional, defaults to false)'),
    },
    async (params) => {
      return callApi(async () => {
        const ctx = getMcpContext();
        try {
          return await clearManualPricing(ctx, params);
        } catch (err) {
          const apiErr = err as { code?: string };
          if (apiErr.code === 'BEC001') {
            return await clearManualPricing(ctx, { ...params, confirm: true });
          }
          throw err;
        }
      });
    },
  );

  server.tool(
    'cashop-console_sales_product_calc_price',
    'Calculate the resulting price for a list of SKUs given a promotion fee rate',
    {
      skuCodeList: z.array(z.string()).describe('List of SKU codes (required)'),
      siteId: z.string().describe('Site ID (required)'),
      promotionFeeRate: z.number().optional().describe('Promotion fee rate to apply (0–1)'),
    },
    async (params) => {
      return callApi(() => calculatePromotionFeePrice(getMcpContext(), params));
    },
  );

  // -------------------------------------------------------------------------
  // Resource tools (8 basic)
  // -------------------------------------------------------------------------

  server.tool(
    'cashop-console_resource_list',
    'List CMS resources with optional pagination and filters',
    {
      pageIndex: z.number().optional().describe('Page number (default: 1)'),
      pageSize: z.number().optional().describe('Page size (default: 20)'),
      type: z.string().optional().describe('Resource type filter'),
      location: z.string().optional().describe('Resource location filter, e.g. "home_all_resource"'),
      statusList: z.array(z.number()).optional().describe('Status values to include'),
      showChannel: z.string().optional().describe('Show channel filter (e.g. "APP", "H5")'),
      name: z.string().optional().describe('Fuzzy match on resource name'),
      startTime: z.string().optional().describe('Effective start time filter (ISO 8601)'),
      endTime: z.string().optional().describe('Effective end time filter (ISO 8601)'),
    },
    async (params) => {
      return callApi(() => listResources(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_resource_detail',
    'Get resource detail by ID (content field is auto-parsed from JSON string)',
    {
      id: z.string().describe('Resource ID (required)'),
    },
    async (params) => {
      return callApi(() => getResourceDetail(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_resource_save',
    'Create or update a CMS resource',
    {
      id: z.string().optional().describe('Resource ID (omit to create, provide to update)'),
      location: z.string().describe('Resource location/slot identifier (required)'),
      type: z.string().describe('Resource type (required)'),
      name: z.string().describe('Resource display name (required)'),
      showChannel: z.string().describe('Channel where the resource is shown, e.g. "APP" (required)'),
      showThrong: z.string().describe('Audience group configuration key (required)'),
      showThrongValue: z
        .object({ userType: z.string().optional() })
        .optional()
        .describe('Audience group value'),
      startTime: z.string().describe('Effective start time in ISO 8601 format (required)'),
      endTime: z.string().describe('Effective end time in ISO 8601 format (required)'),
      content: z
        .string()
        .describe('Resource content serialised as a JSON string (required)'),
      version: z.number().optional().describe('Optimistic-lock version (required when updating)'),
      sortValue: z.number().optional().describe('Display sort order'),
    },
    async (params) => {
      return callApi(() => saveOrUpdateResource(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_resource_effect',
    'Publish (put into effect) a CMS resource',
    {
      id: z.string().describe('Resource ID (required)'),
      version: z.number().describe('Current optimistic-lock version (required)'),
    },
    async (params) => {
      return callApi(() => effectResource(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_resource_lose_effect',
    'Unpublish (take out of effect) a CMS resource',
    {
      id: z.string().describe('Resource ID (required)'),
      version: z.number().describe('Current optimistic-lock version (required)'),
    },
    async (params) => {
      return callApi(() => loseEffectResource(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_resource_delete',
    'Delete a CMS resource by ID and version',
    {
      id: z.string().describe('Resource ID (required)'),
      version: z.number().describe('Current optimistic-lock version (required)'),
    },
    async (params) => {
      return callApi(() => deleteResource(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_resource_sort',
    'Update the display sort order of a CMS resource',
    {
      id: z.string().describe('Resource ID (required)'),
      sortValue: z.number().describe('New sort value (required)'),
      version: z.number().describe('Current optimistic-lock version (required)'),
    },
    async (params) => {
      return callApi(() => sortResource(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_resource_component_tree',
    'Retrieve the component type tree used to classify CMS resources',
    {},
    async () => {
      return callApi(() => getComponentTypeTree(getMcpContext()));
    },
  );

  // -------------------------------------------------------------------------
  // Hero Banner tools (5)
  // -------------------------------------------------------------------------

  server.tool(
    'cashop-console_resource_hero_banner_create',
    'Create a new Hero Banner with smart defaults. location=home_all_resource, showChannel defaults to app,h5, showThrong defaults to all, startTime defaults to latest active hero banner endTime+1s, endTime defaults to startTime+2months.',
    {
      content: z.object({
        bannerType: z.string().describe('Banner type, e.g. "insert_heroBanner"'),
        supportClick: z.union([z.literal(1), z.literal(2)]).describe('1=clickable, 2=not clickable'),
        imgList: z.array(heroBannerImageSchema).describe('List of banner images'),
      }).describe('Hero banner content (required)'),
      name: z.string().optional().describe('Resource name (auto-generated if omitted)'),
      showChannel: z.string().optional().describe('Show channel: "app", "h5", or "app,h5" (default "app,h5")'),
      showThrong: z.string().optional().describe('Audience: "all" or "role" (default "all")'),
      startTime: z.string().optional().describe('Start time ISO 8601 (default: latest active endTime + 1s)'),
      endTime: z.string().optional().describe('End time ISO 8601 (default: startTime + 2 months)'),
      sortValue: z.number().optional().describe('Display sort order'),
    },
    async (params) => {
      return callApi(() => createHeroBanner(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_resource_hero_banner_list_images',
    'List all images in a Hero Banner resource',
    {
      id: z.string().describe('Hero Banner resource ID (required)'),
    },
    async (params) => {
      return callApi(() => heroBannerListImages(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_resource_hero_banner_add_image',
    'Append an image to a Hero Banner resource',
    {
      id: z.string().describe('Hero Banner resource ID (required)'),
      image: heroBannerImageSchema.describe('Image configuration to append (required)'),
    },
    async (params) => {
      return callApi(() => heroBannerAddImage(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_resource_hero_banner_remove_image',
    'Remove the image at a given index from a Hero Banner resource',
    {
      id: z.string().describe('Hero Banner resource ID (required)'),
      index: z.number().int().min(0).describe('Zero-based index of the image to remove (required)'),
    },
    async (params) => {
      return callApi(() => heroBannerRemoveImage(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_resource_hero_banner_update_image',
    'Merge partial image data into the image at a given index in a Hero Banner resource',
    {
      id: z.string().describe('Hero Banner resource ID (required)'),
      index: z.number().int().min(0).describe('Zero-based index of the image to update (required)'),
      image: heroBannerImagePartialSchema.describe('Partial image fields to merge (required)'),
    },
    async (params) => {
      return callApi(() => heroBannerUpdateImage(getMcpContext(), params));
    },
  );

  // -------------------------------------------------------------------------
  // Brand tools (7)
  // -------------------------------------------------------------------------

  server.tool(
    'cashop-console_brand_list',
    'List brands with pagination and optional filters (brandName, brandScore, channelType, enable, hasStory)',
    {
      pageIndex: z.number().optional().describe('Page number (default: 1)'),
      pageSize: z.number().optional().describe('Page size (default: 20)'),
      brandName: z.string().optional().describe('Brand name fuzzy search'),
      brandScore: z.string().optional().describe('Brand tone score: A, B, C, or D'),
      channelType: z.number().optional().describe('Source channel type: 1, 2, or 3'),
      enable: z.number().optional().describe('Enable status: 0=disabled, 1=enabled'),
      hasStory: z.number().optional().describe('Has brand story: 0=no, 1=yes'),
    },
    async (params) => {
      return callApi(() => listBrands(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_brand_detail',
    'Get brand detail by brand ID',
    {
      brandId: z.string().describe('Brand ID (required)'),
    },
    async (params) => {
      return callApi(() => getBrandDetail(getMcpContext(), params.brandId));
    },
  );

  server.tool(
    'cashop-console_brand_story_list',
    'List brand stories for a brand with pagination',
    {
      brandId: z.string().describe('Brand ID (required)'),
      language: z.string().optional().describe('Language code filter'),
      pageIndex: z.number().optional().describe('Page number (default: 1)'),
      pageSize: z.number().optional().describe('Page size (default: 20)'),
    },
    async (params) => {
      return callApi(() => listBrandStories(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_brand_story_detail',
    'Get brand story detail by story ID',
    {
      brandStoryId: z.string().describe('Brand story ID (required)'),
    },
    async (params) => {
      return callApi(() => getBrandStoryDetail(getMcpContext(), params.brandStoryId));
    },
  );

  server.tool(
    'cashop-console_brand_story_save',
    'Create a new brand story for a brand in a specific language',
    {
      brandId: z.string().describe('Brand ID (required)'),
      language: z.string().describe('Language code (required)'),
      localName: z.string().optional().describe('Brand local name'),
      phoneticName: z.string().optional().describe('Brand phonetic name'),
      establishYear: z.string().optional().describe('Year of establishment'),
      headquarters: z.string().optional().describe('Headquarters location'),
      annualRevenue: z.string().optional().describe('Annual revenue'),
      mainCategories: z.string().optional().describe('Main categories'),
      mainProducts: z.string().optional().describe('Main products'),
      coreConcept: z.string().optional().describe('Core concept'),
      brandSlogan: z.string().optional().describe('Brand slogan'),
      brandPosition: z.string().optional().describe('Brand positioning'),
      coreMarket: z.string().optional().describe('Core market'),
      milestones: z.string().optional().describe('Brand milestones'),
      brandTagline: z.string().optional().describe('Brand tagline'),
      brandIntro: z.string().optional().describe('Brand introduction'),
      brandImageUrl: z.string().optional().describe('Brand image URL'),
      brandVideoUrl: z.string().optional().describe('Brand video URL'),
      awardsList: z.array(z.object({
        awardName: z.string(),
        awardYear: z.string(),
        awardOrg: z.string(),
        awardLevel: z.string(),
      })).optional().describe('List of awards'),
    },
    async (params) => {
      return callApi(() => saveBrandStory(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_brand_story_update',
    'Update an existing brand story',
    {
      id: z.string().describe('Brand story ID (required)'),
      brandId: z.string().describe('Brand ID (required)'),
      language: z.string().describe('Language code (required)'),
      localName: z.string().optional().describe('Brand local name'),
      phoneticName: z.string().optional().describe('Brand phonetic name'),
      establishYear: z.string().optional().describe('Year of establishment'),
      headquarters: z.string().optional().describe('Headquarters location'),
      annualRevenue: z.string().optional().describe('Annual revenue'),
      mainCategories: z.string().optional().describe('Main categories'),
      mainProducts: z.string().optional().describe('Main products'),
      coreConcept: z.string().optional().describe('Core concept'),
      brandSlogan: z.string().optional().describe('Brand slogan'),
      brandPosition: z.string().optional().describe('Brand positioning'),
      coreMarket: z.string().optional().describe('Core market'),
      milestones: z.string().optional().describe('Brand milestones'),
      brandTagline: z.string().optional().describe('Brand tagline'),
      brandIntro: z.string().optional().describe('Brand introduction'),
      brandImageUrl: z.string().optional().describe('Brand image URL'),
      brandVideoUrl: z.string().optional().describe('Brand video URL'),
      awardsList: z.array(z.object({
        awardName: z.string(),
        awardYear: z.string(),
        awardOrg: z.string(),
        awardLevel: z.string(),
      })).optional().describe('List of awards'),
    },
    async (params) => {
      return callApi(() => updateBrandStory(getMcpContext(), params));
    },
  );

  server.tool(
    'cashop-console_brand_languages',
    'Get the list of supported languages for brand stories',
    {},
    async () => {
      return callApi(() => getSupportedLanguages(getMcpContext()));
    },
  );

  // -------------------------------------------------------------------------
  // Upload tools (2)
  // -------------------------------------------------------------------------

  server.tool(
    'cashop-console_upload_file',
    'Upload a local file to R2 and return the CDN URL. Use this before adding/updating hero banner images.',
    {
      filePath: z.string().describe('Absolute path to the local file to upload (required)'),
    },
    async (params) => {
      return callApi(() => uploadFile(getMcpContext(), params.filePath));
    },
  );

  server.tool(
    'cashop-console_upload_presign',
    'Get a presigned upload URL for a file. Returns the presign URL and the final CDN access URL.',
    {
      fileName: z.string().describe('File name with extension (required)'),
      fileType: z.string().optional().describe('MIME type (e.g. image/png)'),
      expireTime: z.number().optional().describe('Presign URL expiry in seconds (default 3600)'),
    },
    async (params) => {
      return callApi(() => getPresignedUploadUrl(getMcpContext(), params));
    },
  );
}
