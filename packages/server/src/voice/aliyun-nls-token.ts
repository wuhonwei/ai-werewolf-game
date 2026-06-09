import { createHmac, randomUUID } from 'node:crypto';

function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

export async function createNlsToken(
  accessKeyId: string,
  accessKeySecret: string,
): Promise<{ token: string; expireTime: number }> {
  const params: Record<string, string> = {
    Action: 'CreateToken',
    Version: '2019-02-28',
    Format: 'JSON',
    RegionId: 'cn-shanghai',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };

  const sortedKeys = Object.keys(params).sort();
  const canonicalized = sortedKeys
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');
  const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonicalized)}`;
  const signature = createHmac('sha1', `${accessKeySecret}&`)
    .update(stringToSign)
    .digest('base64');

  const url = `https://nls-meta.cn-shanghai.aliyuncs.com/?${canonicalized}&Signature=${percentEncode(signature)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CreateToken failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    Token?: { Id?: string; ExpireTime?: number };
    Message?: string;
  };

  const token = data.Token?.Id;
  if (!token) {
    throw new Error(data.Message ?? 'Invalid CreateToken response');
  }

  return {
    token,
    expireTime: (data.Token?.ExpireTime ?? 0) * 1000,
  };
}
