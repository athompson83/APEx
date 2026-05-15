/**
 * Storage abstraction for APEx Hub.
 *
 * Supports:
 *   - "local"  — writes to STORAGE_LOCAL_PATH (default: ./uploads)
 *   - "s3"     — AWS S3 using the AWS SDK v3
 *
 * Usage:
 *   import { saveFile, deleteFile, getFileUrl } from '@/lib/storage';
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StorageResult {
  storageKey: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_TYPE = (process.env.STORAGE_TYPE ?? 'local') as 'local' | 's3';
const LOCAL_PATH = process.env.STORAGE_LOCAL_PATH ?? './uploads';

function generateKey(originalName: string): string {
  const ext = path.extname(originalName);
  const hash = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}-${hash}${ext}`;
}

// ---------------------------------------------------------------------------
// Local storage
// ---------------------------------------------------------------------------

async function saveLocal(buffer: Buffer, key: string): Promise<StorageResult> {
  const dir = path.resolve(process.cwd(), LOCAL_PATH);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, key);
  await fs.writeFile(filePath, buffer);
  return {
    storageKey: key,
    url: `/api/files/${key}`,
  };
}

async function deleteLocal(key: string): Promise<void> {
  const filePath = path.join(path.resolve(process.cwd(), LOCAL_PATH), key);
  try {
    await fs.unlink(filePath);
  } catch {
    // File already gone — silently ignore
  }
}

// ---------------------------------------------------------------------------
// S3 storage (lazily loaded to avoid import errors in local mode)
// ---------------------------------------------------------------------------

async function saveS3(buffer: Buffer, key: string, mimeType?: string): Promise<StorageResult> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const client = new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
  });

  const bucket = process.env.AWS_BUCKET_NAME ?? '';

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType ?? 'application/octet-stream',
    }),
  );

  const cdn = process.env.AWS_CLOUDFRONT_URL;
  const url = cdn
    ? `${cdn}/${key}`
    : `https://${bucket}.s3.${process.env.AWS_REGION ?? 'us-east-1'}.amazonaws.com/${key}`;

  return { storageKey: key, url };
}

async function deleteS3(key: string): Promise<void> {
  const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

  const client = new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
  });

  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME ?? '',
      Key: key,
    }),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function saveFile(
  buffer: Buffer,
  originalName: string,
  mimeType?: string,
): Promise<StorageResult> {
  const key = generateKey(originalName);
  if (STORAGE_TYPE === 's3') return saveS3(buffer, key, mimeType);
  return saveLocal(buffer, key);
}

export async function deleteFile(storageKey: string): Promise<void> {
  if (STORAGE_TYPE === 's3') return deleteS3(storageKey);
  return deleteLocal(storageKey);
}

export function getFileUrl(storageKey: string): string {
  if (STORAGE_TYPE === 's3') {
    const cdn = process.env.AWS_CLOUDFRONT_URL;
    const bucket = process.env.AWS_BUCKET_NAME ?? '';
    const region = process.env.AWS_REGION ?? 'us-east-1';
    return cdn
      ? `${cdn}/${storageKey}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${storageKey}`;
  }
  return `/api/files/${storageKey}`;
}
