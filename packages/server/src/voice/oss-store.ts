import { createHmac } from 'node:crypto';
import { env } from '../config.js';

function ossHost(): string {
  const region = env.aliyunOssRegion.replace(/^oss-/, '');
  return `${env.aliyunOssBucket}.oss-${region}.aliyuncs.com`;
}

function signOss(method: string, objectKey: string, contentType: string, date: string): string {
  const canonicalizedResource = `/${env.aliyunOssBucket}/${objectKey}`;
  const stringToSign = `${method}\n\n${contentType}\n${date}\n${canonicalizedResource}`;
  const signature = createHmac('sha1', env.aliyunAccessKeySecret).update(stringToSign).digest('base64');
  return `OSS ${env.aliyunAccessKeyId}:${signature}`;
}

export function isOssEnabled(): boolean {
  return Boolean(
    env.aliyunAccessKeyId &&
      env.aliyunAccessKeySecret &&
      env.aliyunOssBucket &&
      env.aliyunOssRegion,
  );
}

export function getOssPublicUrl(objectKey: string): string {
  return `https://${ossHost()}/${objectKey}`;
}

export async function ossObjectExists(objectKey: string): Promise<boolean> {
  if (!isOssEnabled()) return false;

  const date = new Date().toUTCString();
  const authorization = signOss('HEAD', objectKey, '', date);
  const res = await fetch(`https://${ossHost()}/${objectKey}`, {
    method: 'HEAD',
    headers: {
      Date: date,
      Authorization: authorization,
    },
  });

  return res.ok;
}

export async function uploadToOss(objectKey: string, data: Buffer, contentType: string): Promise<string> {
  if (!isOssEnabled()) {
    throw new Error('OSS not configured');
  }

  const date = new Date().toUTCString();
  const authorization = signOss('PUT', objectKey, contentType, date);
  const res = await fetch(`https://${ossHost()}/${objectKey}`, {
    method: 'PUT',
    headers: {
      Date: date,
      Authorization: authorization,
      'Content-Type': contentType,
      'Content-Length': String(data.length),
    },
    body: data,
  });

  if (!res.ok) {
    throw new Error(`OSS upload failed: ${res.status}`);
  }

  return getOssPublicUrl(objectKey);
}

export function ttsObjectKey(cacheKey: string): string {
  return `werewolf/tts/${cacheKey}.mp3`;
}
