import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { apiRequest } from '../core/client.js';
import { lookup } from '../core/mime.js';
import type { ApiContext } from '../core/types.js';

export type { ApiContext } from '../core/types.js';

// ---------------------------------------------------------------------------
// Presign response
// ---------------------------------------------------------------------------

export interface PresignResult {
  presign_url: string;
  access_url: string;
  file_id: string;
  file_key: string;
  expire_time: string;
}

// ---------------------------------------------------------------------------
// Get presigned upload URL
// ---------------------------------------------------------------------------

export async function getPresignedUploadUrl(
  ctx: ApiContext,
  params: { fileName: string; fileType?: string; expireTime?: number },
): Promise<PresignResult> {
  return apiRequest<PresignResult>({
    env: ctx.env,
    method: 'POST',
    url: '/marketing/cashop-marketing-cms-manager/api/manage/biz/upload/presign',
    params: params as unknown as Record<string, unknown>,
  });
}

// ---------------------------------------------------------------------------
// Upload file via presigned URL
// ---------------------------------------------------------------------------

export async function uploadFileToR2(
  presignUrl: string,
  fileBuffer: Buffer,
  contentType: string,
): Promise<void> {
  // Use native fetch instead of axios to correctly follow redirects
  // while preserving the PUT method (axios downgrades PUT→GET on redirect)
  const response = await fetch(presignUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: fileBuffer,
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed: ${response.status} ${response.statusText}`);
  }
}

// ---------------------------------------------------------------------------
// High-level: upload a local file and return the CDN URL
// ---------------------------------------------------------------------------

export interface UploadResult {
  accessUrl: string;
  fileId: string;
  fileKey: string;
}

export async function uploadFile(
  ctx: ApiContext,
  filePath: string,
): Promise<UploadResult> {
  const fileName = basename(filePath);
  const fileBuffer = readFileSync(filePath);
  const contentType = lookup(fileName);

  const presign = await getPresignedUploadUrl(ctx, {
    fileName,
    fileType: contentType,
  });

  await uploadFileToR2(presign.presign_url, fileBuffer, contentType);

  return {
    accessUrl: presign.access_url,
    fileId: presign.file_id,
    fileKey: presign.file_key,
  };
}
