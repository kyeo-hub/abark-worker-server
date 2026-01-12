import type { Env } from 'hono';
import { type BasicKV, KVAdapter } from '../core/db/kv-adapter';
import { createHono } from '../core/hono';
import type { BasicEnv } from '../core/type';

// @see https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/edge-storage-api
declare class EdgeKV implements BasicKV {
  constructor(params: { namespace: string });
  get(key: string, options?: { type: 'json' | 'text' }): Promise<any>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface ESAHonoEnv extends Env {
  Bindings: BasicEnv;
}

// inject in build
const env = {
  DB_NAME: process.env.DB_NAME || 'bark',
  ALLOW_NEW_DEVICE: process.env.ALLOW_NEW_DEVICE || 'true',
  ALLOW_QUERY_NUMS: process.env.ALLOW_QUERY_NUMS || 'true',
  BASIC_AUTH: process.env.BASIC_AUTH || '',
  URL_PREFIX: process.env.URL_PREFIX || '/',
  MAX_BATCH_PUSH_COUNT: process.env.MAX_BATCH_PUSH_COUNT,
  APNS_URL: process.env.APNS_URL,
};

const hono = createHono<ESAHonoEnv>({
  db: new KVAdapter(new EdgeKV({ namespace: env.DB_NAME || 'bark' })),
  allowNewDevice: env.ALLOW_NEW_DEVICE !== 'false',
  allowQueryNums: env.ALLOW_QUERY_NUMS !== 'false',
  maxBatchPushCount: Number(env.MAX_BATCH_PUSH_COUNT),
  urlPrefix: env.URL_PREFIX || '/',
  basicAuth: env.BASIC_AUTH,
  apnsUrl: env.APNS_URL,
});

export default {
  fetch(request: Request) {
    return hono.fetch(request, env);
  },
};
