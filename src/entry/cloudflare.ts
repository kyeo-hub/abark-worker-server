import type { Env, Hono } from 'hono';
import { KVAdapter } from '../core/db/kv-adapter';
import { createHono } from '../core/hono';
import type { BasicEnv } from '../core/type';

interface CFHonoEnv extends Env {
  Bindings: BasicEnv;
}

let hono: Hono<CFHonoEnv>;

export default {
  fetch(request: Request, env: BasicEnv, ctx: any) {
    if (!hono) {
      hono = createHono({
        db: new KVAdapter((env as any)[env.DB_NAME || 'BARK_KV']),
        allowNewDevice: env.ALLOW_NEW_DEVICE !== 'false',
        allowQueryNums: env.ALLOW_QUERY_NUMS !== 'false',
        maxBatchPushCount: Number(env.MAX_BATCH_PUSH_COUNT),
        urlPrefix: env.URL_PREFIX || '/',
        basicAuth: env.BASIC_AUTH,
        apnsUrl: env.APNS_URL,
      });
    }
    return hono.fetch(request, env, ctx);
  },
};
