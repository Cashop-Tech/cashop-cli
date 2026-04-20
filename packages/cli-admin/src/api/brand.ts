import { apiRequest } from '../core/client.js';
import type { PageResult, ApiContext } from '../core/types.js';

export type { ApiContext } from '../core/types.js';

// ---------------------------------------------------------------------------
// Base paths
// ---------------------------------------------------------------------------

const BRAND_BASE = '/marketing/cashop-marketing-cms-manager/api/manage/merchant/brand-info';
const STORY_BASE = '/marketing/cashop-marketing-cms-manager/api/manage/merchant/brand-story';
const COMMON_BASE = '/marketing/cashop-marketing-cms-manager/api/manage/merchant/common';

// ---------------------------------------------------------------------------
// Brand interfaces
// ---------------------------------------------------------------------------

export interface BrandItem {
  brandId: string;
  brandName: string;
  logoUrl?: string;
  channelType?: number;
  brandScore?: string;
  enable?: number;
  hasStory?: number;
  description?: string;
  createdTime?: string;
  brandChannelCodeDesc?: string;
  brandAffiliatedGroup?: string;
  tagNames?: string;
  categoryNames?: string;
  trademarkNames?: string;
  mainSaleSeasonDesc?: string;
  brandNatureDesc?: string;
  storyAuditStatus?: number;
  storyStatus?: number;
  [key: string]: unknown;
}

export interface BrandDetail {
  brandId: string;
  brandName: string;
  brandNameChs?: string;
  brandNameEn?: string;
  logoUrl?: string;
  logoUrl53?: string;
  brandScore?: string;
  brandScoreDesc?: string;
  brandChannelCode?: string;
  brandChannelCodeDesc?: string;
  description?: string;
  brandAffiliatedGroup?: string;
  enable?: number;
  channelType?: number;
  mainSaleSeason?: string;
  mainSaleSeasonDesc?: string;
  brandNature?: string;
  brandNatureDesc?: string;
  storyId?: string;
  remark?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Brand Story interfaces
// ---------------------------------------------------------------------------

export interface BrandStoryItem {
  id: string;
  brandId: string;
  language: string;
  languageName: string;
  localName?: string;
  phoneticName?: string;
  updateTime?: string;
  [key: string]: unknown;
}

export interface BrandStoryAward {
  awardName: string;
  awardYear: string;
  awardOrg: string;
  awardLevel: string;
}

export interface BrandStoryDetail extends BrandStoryItem {
  establishYear?: string;
  headquarters?: string;
  annualRevenue?: string;
  mainCategories?: string;
  mainProducts?: string;
  coreConcept?: string;
  brandSlogan?: string;
  brandPosition?: string;
  coreMarket?: string;
  milestones?: string;
  brandTagline?: string;
  brandIntro?: string;
  brandImageUrl?: string;
  brandVideoUrl?: string;
  awardsList?: BrandStoryAward[];
}

export interface BrandStorySaveData {
  brandId: string;
  language: string;
  localName?: string;
  phoneticName?: string;
  establishYear?: string;
  headquarters?: string;
  annualRevenue?: string;
  mainCategories?: string;
  mainProducts?: string;
  coreConcept?: string;
  brandSlogan?: string;
  brandPosition?: string;
  coreMarket?: string;
  milestones?: string;
  brandTagline?: string;
  brandIntro?: string;
  brandImageUrl?: string;
  brandVideoUrl?: string;
  awardsList?: BrandStoryAward[];
  [key: string]: unknown;
}

export interface BrandStoryUpdateData extends BrandStorySaveData {
  id: string;
}

// ---------------------------------------------------------------------------
// Language interface
// ---------------------------------------------------------------------------

export interface LanguageItem {
  code: string;
  name: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Request param interfaces
// ---------------------------------------------------------------------------

export interface ListBrandsParams {
  pageIndex?: number;
  pageSize?: number;
  brandName?: string;
  brandScore?: string;
  channelType?: number;
  enable?: number;
  hasStory?: number;
}

export interface ListBrandStoriesParams {
  pageIndex?: number;
  pageSize?: number;
  brandId: string;
  language?: string;
}

// ---------------------------------------------------------------------------
// Brand Story list response (non-standard pagination)
// ---------------------------------------------------------------------------

interface BrandStoryListResponse {
  list: BrandStoryItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * List brands with pagination and optional filters.
 */
export async function listBrands(
  ctx: ApiContext,
  params: ListBrandsParams,
): Promise<PageResult<BrandItem>> {
  return apiRequest<PageResult<BrandItem>>({
    env: ctx.env,
    token: ctx.token,
    method: 'POST',
    url: `${BRAND_BASE}/query-page`,
    data: params,
  });
}

/**
 * Get brand detail by ID.
 */
export async function getBrandDetail(
  ctx: ApiContext,
  brandId: string,
): Promise<BrandDetail> {
  return apiRequest<BrandDetail>({
    env: ctx.env,
    token: ctx.token,
    method: 'GET',
    url: `${BRAND_BASE}/detail/${brandId}`,
  });
}

/**
 * List brand stories with pagination.
 * Note: backend returns { list, total } instead of standard PageResult.
 */
export async function listBrandStories(
  ctx: ApiContext,
  params: ListBrandStoriesParams,
): Promise<PageResult<BrandStoryItem>> {
  const raw = await apiRequest<BrandStoryListResponse | null>({
    env: ctx.env,
    token: ctx.token,
    method: 'POST',
    url: `${STORY_BASE}/query-page`,
    data: params,
  });

  const list = raw?.list ?? [];
  const total = raw?.total ?? 0;

  return {
    pageIndex: params.pageIndex ?? 1,
    pageSize: params.pageSize ?? 20,
    total,
    pages: Math.ceil(total / (params.pageSize ?? 20)),
    data: list,
  };
}

/**
 * Get brand story detail by ID.
 */
export async function getBrandStoryDetail(
  ctx: ApiContext,
  brandStoryId: string,
): Promise<BrandStoryDetail> {
  return apiRequest<BrandStoryDetail>({
    env: ctx.env,
    token: ctx.token,
    method: 'GET',
    url: `${STORY_BASE}/detail/${brandStoryId}`,
  });
}

/**
 * Create a new brand story.
 */
export async function saveBrandStory(
  ctx: ApiContext,
  data: BrandStorySaveData,
): Promise<unknown> {
  return apiRequest<unknown>({
    env: ctx.env,
    token: ctx.token,
    method: 'POST',
    url: `${STORY_BASE}/save`,
    data,
  });
}

/**
 * Update an existing brand story.
 */
export async function updateBrandStory(
  ctx: ApiContext,
  data: BrandStoryUpdateData,
): Promise<unknown> {
  return apiRequest<unknown>({
    env: ctx.env,
    token: ctx.token,
    method: 'POST',
    url: `${STORY_BASE}/update/${data.id}`,
    data,
  });
}

/**
 * Get supported languages list.
 */
export async function getSupportedLanguages(
  ctx: ApiContext,
): Promise<LanguageItem[]> {
  return apiRequest<LanguageItem[]>({
    env: ctx.env,
    token: ctx.token,
    method: 'GET',
    url: `${COMMON_BASE}/languages`,
  });
}
