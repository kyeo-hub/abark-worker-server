import type { Env, Hono } from 'hono';
import { KVAdapter } from '../core/db/kv-adapter';
import { createHono } from '../core/hono';
import type { BasicEnv } from '../core/type';

interface EOEventContext {
  params: any;
  request: Request;
  env: BasicEnv;
}

interface EOHonoEnv extends Env {
  Bindings: BasicEnv;
}

let hono: Hono<EOHonoEnv>;

export const onRequest = (ctx: EOEventContext) => {
  if (!hono) {
    hono = createHono({
      db: new KVAdapter((globalThis as any)[ctx.env.DB_NAME || 'BARK_KV']),
      allowNewDevice: ctx.env.ALLOW_NEW_DEVICE !== 'false',
      allowQueryNums: ctx.env.ALLOW_QUERY_NUMS !== 'false',
      maxBatchPushCount: Number(ctx.env.MAX_BATCH_PUSH_COUNT),
      urlPrefix: ctx.env.URL_PREFIX || '/',
      basicAuth: ctx.env.BASIC_AUTH,
      apnsUrl: ctx.env.APNS_URL,
    });
  }
  return hono.fetch(ctx.request, ctx.env);
};
