import { apiRequest } from '../core/client.js';
import type { PageResult, ApiContext } from '../core/types.js';

export type { ApiContext } from '../core/types.js';

// ---------------------------------------------------------------------------
// Base path
// ---------------------------------------------------------------------------

const BASE = '/marketing/cashop-marketing-cms-manager/api/manage/resource';

// ---------------------------------------------------------------------------
// Hero Banner overlay interfaces
// ---------------------------------------------------------------------------

export interface TextButton {
  type: 'text';
  text: string;
  color?: string;
  fontSize?: number;
}

export interface ImageButton {
  type: 'image';
  imgUrl: string;
  width?: number;
  height?: number;
}

export type OverlayButton = TextButton | ImageButton;

export interface TextOverlay {
  type: 'text';
  text: string;
  color?: string;
  fontSize?: number;
  position?: { x?: number; y?: number };
  button?: OverlayButton;
}

export interface ImageOverlay {
  type: 'image';
  imgUrl: string;
  width?: number;
  height?: number;
  position?: { x?: number; y?: number };
  button?: OverlayButton;
}

export type HeroBannerOverlay = TextOverlay | ImageOverlay;

// ---------------------------------------------------------------------------
// Hero Banner interfaces
// ---------------------------------------------------------------------------

export interface HeroBannerImage {
  bannerId?: string;
  themeColor: '#000000' | '#FFFFFF';
  placeholderColor?: string;
  imgUrl: string;
  imgUrlI18n?: string;
  width?: number;
  height?: number;
  /** 1=product detail, 2=brand, 3=category, 4=external url, 5=custom link */
  skipType?: 1 | 2 | 3 | 4 | 5;
  productId?: string;
  itemCode?: string;
  brandId?: string;
  outAppUrl?: string;
  categoryId?: string;
  customLink?: string;
  overlay?: HeroBannerOverlay;
  /** 生效开始时间 (yyyy-MM-dd HH:mm:ss) */
  startTime?: string;
  /** 生效结束时间 (yyyy-MM-dd HH:mm:ss) */
  endTime?: string;
  /** 是否支持点击 1:支持 2:不支持 */
  supportClick?: 1 | 2;
  /** 展示渠道 (逗号分隔: app,h5) */
  showChannel?: string;
  /** 定向展示 all:全部 role:用户角色 */
  showThrong?: string;
  /** 定向展示值 (showThrong=role 时有效，逗号分隔角色) */
  showThrongValue?: string;
}

export interface HeroBannerContent {
  bannerType: string;
  supportClick: 1 | 2;
  imgList: HeroBannerImage[];
}

// ---------------------------------------------------------------------------
// Resource interfaces
// ---------------------------------------------------------------------------

export interface ResourceItem {
  id: string;
  name: string;
  type: string;
  location?: string;
  showChannel?: string;
  showThrong?: string;
  status?: number;
  startTime?: string;
  endTime?: string;
  sortValue?: number;
  version?: number;
  content?: string;
  [key: string]: unknown;
}

export interface ResourceDetail extends ResourceItem {
  /** content is a JSON string in the API response; parsed form is available via getResourceDetail which auto-parses it */
  content: string;
  showThrongValue?: { userType?: string };
  [key: string]: unknown;
}

export interface ParsedResourceDetail extends Omit<ResourceDetail, 'content'> {
  /** Parsed content object */
  content: unknown;
}

export interface ComponentTypeNode {
  type: string;
  label?: string;
  children?: ComponentTypeNode[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Request param interfaces
// ---------------------------------------------------------------------------

export interface ListResourcesParams {
  pageIndex?: number;
  pageSize?: number;
  type?: string;
  location?: string;
  statusList?: number[];
  showChannel?: string;
  name?: string;
  startTime?: string;
  endTime?: string;
}

export interface GetResourceDetailParams {
  id: string;
}

export interface SaveOrUpdateResourceParams {
  id?: string;
  location: string;
  locationTier?: string;
  type: string;
  typeTier?: string;
  name: string;
  showChannel: string;
  showThrong: string;
  showThrongValue?: { userType?: string };
  startTime: string;
  endTime: string;
  /** JSON string – callers are responsible for serialising */
  content: string;
  version?: number;
  sortValue?: number;
}

export interface EffectResourceParams {
  id: string;
  version: number;
}

export interface LoseEffectResourceParams {
  id: string;
  version: number;
}

export interface DeleteResourceParams {
  id: string;
  version: number;
}

export interface SortResourceParams {
  id: string;
  sortValue: number;
  version: number;
}

// ---------------------------------------------------------------------------
// Basic resource operations
// ---------------------------------------------------------------------------

/**
 * List resources with pagination and optional filters.
 */
export async function listResources(
  ctx: ApiContext,
  params: ListResourcesParams,
): Promise<PageResult<ResourceItem>> {
  return apiRequest<PageResult<ResourceItem>>({
    env: ctx.env,
    token: ctx.token,
    method: 'POST',
    url: `${BASE}/pageList`,
    data: params,
  });
}

/**
 * Get resource detail by ID.
 * The `content` field returned by the server is a JSON string; this function
 * parses it automatically and returns it as a typed object.
 */
export async function getResourceDetail(
  ctx: ApiContext,
  params: GetResourceDetailParams,
): Promise<ParsedResourceDetail> {
  const raw = await apiRequest<ResourceDetail>({
    env: ctx.env,
    token: ctx.token,
    method: 'POST',
    url: `${BASE}/detail`,
    params: { id: params.id },
  });

  const parsedContent: unknown =
    typeof raw.content === 'string' && raw.content.length > 0
      ? (JSON.parse(raw.content) as unknown)
      : raw.content;

  return { ...raw, content: parsedContent };
}

/**
 * Create or update a resource. Pass a JSON-serialised string for `content`.
 */
export async function saveOrUpdateResource(
  ctx: ApiContext,
  params: SaveOrUpdateResourceParams,
): Promise<ResourceDetail> {
  return apiRequest<ResourceDetail>({
    env: ctx.env,
    token: ctx.token,
    method: 'POST',
    url: `${BASE}/saveOrUpdate`,
    data: params,
  });
}

/**
 * Put a resource into effect (publish).
 */
export async function effectResource(
  ctx: ApiContext,
  params: EffectResourceParams,
): Promise<boolean> {
  return apiRequest<boolean>({
    env: ctx.env,
    token: ctx.token,
    method: 'POST',
    url: `${BASE}/effect`,
    params: {
      id: params.id,
      version: String(params.version),
    },
  });
}

/**
 * Take a resource out of effect (unpublish).
 */
export async function loseEffectResource(
  ctx: ApiContext,
  params: LoseEffectResourceParams,
): Promise<boolean> {
  return apiRequest<boolean>({
    env: ctx.env,
    token: ctx.token,
    method: 'POST',
    url: `${BASE}/loseEffect`,
    params: {
      id: params.id,
      version: String(params.version),
    },
  });
}

/**
 * Delete a resource by ID and version.
 */
export async function deleteResource(
  ctx: ApiContext,
  params: DeleteResourceParams,
): Promise<boolean> {
  return apiRequest<boolean>({
    env: ctx.env,
    token: ctx.token,
    method: 'POST',
    url: `${BASE}/delete`,
    params: {
      id: params.id,
      version: String(params.version),
    },
  });
}

/**
 * Update the display sort order of a resource.
 */
export async function sortResource(
  ctx: ApiContext,
  params: SortResourceParams,
): Promise<boolean> {
  return apiRequest<boolean>({
    env: ctx.env,
    token: ctx.token,
    method: 'POST',
    url: `${BASE}/sort/edit`,
    params: {
      id: params.id,
      sortValue: String(params.sortValue),
      version: String(params.version),
    },
  });
}

/**
 * Retrieve the component type tree used to classify resources.
 */
export async function getComponentTypeTree(
  ctx: ApiContext,
): Promise<ComponentTypeNode[]> {
  return apiRequest<ComponentTypeNode[]>({
    env: ctx.env,
    token: ctx.token,
    method: 'GET',
    url: `${BASE}/buildComponentTypeTree`,
  });
}

// ---------------------------------------------------------------------------
// Internal helpers for Hero Banner composite operations
// ---------------------------------------------------------------------------

async function fetchHeroBannerDetail(
  ctx: ApiContext,
  id: string,
): Promise<{ detail: ResourceDetail; content: HeroBannerContent }> {
  const raw = await apiRequest<ResourceDetail>({
    env: ctx.env,
    token: ctx.token,
    method: 'POST',
    url: `${BASE}/detail`,
    params: { id },
  });

  const content = JSON.parse(raw.content) as HeroBannerContent;
  return { detail: raw, content };
}

async function persistHeroBanner(
  ctx: ApiContext,
  detail: ResourceDetail,
  content: HeroBannerContent,
): Promise<ResourceDetail> {
  const params: SaveOrUpdateResourceParams = {
    id: detail.id,
    location: detail.location ?? '',
    type: detail.type,
    name: detail.name,
    showChannel: detail.showChannel ?? '',
    showThrong: detail.showThrong ?? '',
    showThrongValue: detail.showThrongValue,
    startTime: detail.startTime ?? '',
    endTime: detail.endTime ?? '',
    content: JSON.stringify(content),
    version: detail.version,
    sortValue: detail.sortValue,
  };

  return saveOrUpdateResource(ctx, params);
}

// ---------------------------------------------------------------------------
// Hero Banner composite operations
// ---------------------------------------------------------------------------

export interface HeroBannerListImagesParams {
  id: string;
}

export interface HeroBannerAddImageParams {
  id: string;
  image: HeroBannerImage;
}

export interface HeroBannerRemoveImageParams {
  id: string;
  index: number;
}

export interface HeroBannerUpdateImageParams {
  id: string;
  index: number;
  image: Partial<HeroBannerImage>;
}

// ---------------------------------------------------------------------------
// Hero Banner creation with smart defaults
// ---------------------------------------------------------------------------

export interface CreateHeroBannerParams {
  /** Resource name (auto-generated if omitted) */
  name?: string;
  /** Show channel: "app", "h5", or "app,h5" (default "app,h5") */
  showChannel?: string;
  /** Audience: "all" or "role" (default "all") */
  showThrong?: string;
  showThrongValue?: { userType?: string };
  /** Effective start time ISO 8601 (default: latest active hero banner endTime + 1s) */
  startTime?: string;
  /** Effective end time ISO 8601 (default: startTime + 2 months) */
  endTime?: string;
  /** Banner content */
  content: HeroBannerContent;
  sortValue?: number;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addSeconds(dateStr: string, seconds: number): string {
  const d = new Date(dateStr);
  d.setTime(d.getTime() + seconds * 1000);
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

/**
 * Create a new Hero Banner resource with smart defaults:
 * - location = "home_all_resource"
 * - type = "insert_heroBanner"
 * - showChannel defaults to "app,h5"
 * - showThrong defaults to "all"
 * - name auto-generated if omitted
 * - startTime defaults to latest active hero banner's endTime + 1 second
 * - endTime defaults to startTime + 2 months
 */
export async function createHeroBanner(
  ctx: ApiContext,
  params: CreateHeroBannerParams,
): Promise<ResourceDetail> {
  let startTime = params.startTime;

  // If startTime not provided, find the latest endTime of active hero banners
  if (!startTime) {
    const activeList = await listResources(ctx, {
      type: 'insert_heroBanner',
      location: 'home_all_resource',
      statusList: [2], // 生效中
      pageIndex: 1,
      pageSize: 100,
    });
    const items = activeList.data ?? [];
    let latestEnd = '';
    for (const item of items) {
      if (item.endTime && item.endTime > latestEnd) {
        latestEnd = item.endTime;
      }
    }
    if (latestEnd) {
      startTime = addSeconds(latestEnd, 1);
    } else {
      startTime = formatDate(new Date());
    }
  }

  // Auto-calculate resource-level time from per-item startTime/endTime
  const imgList = params.content?.imgList ?? [];
  let minItemStart: string | undefined;
  let maxItemEnd: string | undefined;
  for (const img of imgList) {
    if (img.startTime && (!minItemStart || img.startTime < minItemStart)) {
      minItemStart = img.startTime;
    }
    if (img.endTime && (!maxItemEnd || img.endTime > maxItemEnd)) {
      maxItemEnd = img.endTime;
    }
  }

  // Per-item times override resource-level if present
  const effectiveStartTime = minItemStart ?? startTime;
  const endTime = maxItemEnd ?? params.endTime ?? formatDate(addMonths(new Date(effectiveStartTime), 2));
  const rawName = params.name ?? `Banner ${effectiveStartTime.slice(0, 10)}`;
  const name = rawName.slice(0, 20);

  return saveOrUpdateResource(ctx, {
    location: 'home_all_resource',
    locationTier: '首页/全部/资源位',
    type: 'insert_heroBanner',
    typeTier: '插入式/Hero Banner',
    name,
    // 向前兼容：资源级恒为最宽松值
    showChannel: 'app,h5',
    showThrong: 'all',
    startTime: effectiveStartTime,
    endTime,
    content: JSON.stringify(params.content),
    sortValue: params.sortValue,
  });
}

// ---------------------------------------------------------------------------
// Hero Banner composite operations
// ---------------------------------------------------------------------------

/**
 * Fetch the image list from a Hero Banner resource.
 */
export async function heroBannerListImages(
  ctx: ApiContext,
  params: HeroBannerListImagesParams,
): Promise<HeroBannerImage[]> {
  const { content } = await fetchHeroBannerDetail(ctx, params.id);
  return content.imgList ?? [];
}

/**
 * Append an image to a Hero Banner resource's image list.
 * Generates a `bannerId` from `Date.now()` if the image does not already have one.
 */
export async function heroBannerAddImage(
  ctx: ApiContext,
  params: HeroBannerAddImageParams,
): Promise<ResourceDetail> {
  const { detail, content } = await fetchHeroBannerDetail(ctx, params.id);

  const image: HeroBannerImage = {
    bannerId: params.image.bannerId ?? Date.now().toString(),
    ...params.image,
  };

  const updatedContent: HeroBannerContent = {
    ...content,
    imgList: [...(content.imgList ?? []), image],
  };

  return persistHeroBanner(ctx, detail, updatedContent);
}

/**
 * Remove the image at `index` from a Hero Banner resource's image list.
 */
export async function heroBannerRemoveImage(
  ctx: ApiContext,
  params: HeroBannerRemoveImageParams,
): Promise<ResourceDetail> {
  const { detail, content } = await fetchHeroBannerDetail(ctx, params.id);

  const imgList = content.imgList ?? [];
  if (params.index < 0 || params.index >= imgList.length) {
    throw new RangeError(
      `Index ${params.index} is out of bounds for imgList of length ${imgList.length}`,
    );
  }

  const updatedContent: HeroBannerContent = {
    ...content,
    imgList: imgList.filter((_, i) => i !== params.index),
  };

  return persistHeroBanner(ctx, detail, updatedContent);
}

/**
 * Merge partial image data into the image at `index` in a Hero Banner resource.
 */
export async function heroBannerUpdateImage(
  ctx: ApiContext,
  params: HeroBannerUpdateImageParams,
): Promise<ResourceDetail> {
  const { detail, content } = await fetchHeroBannerDetail(ctx, params.id);

  const imgList = content.imgList ?? [];
  if (params.index < 0 || params.index >= imgList.length) {
    throw new RangeError(
      `Index ${params.index} is out of bounds for imgList of length ${imgList.length}`,
    );
  }

  const updatedImgList = imgList.map((img, i) =>
    i === params.index ? { ...img, ...params.image } : img,
  );

  const updatedContent: HeroBannerContent = {
    ...content,
    imgList: updatedImgList,
  };

  return persistHeroBanner(ctx, detail, updatedContent);
}
