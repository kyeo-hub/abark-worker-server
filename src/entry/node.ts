import { serve } from '@hono/node-server';
import { type BasicKV, KVAdapter } from '../core/db/kv-adapter';
import { createHono } from '../core/hono';

class NodeKV implements BasicKV {
  kv: Record<string, string> = {};
  async get(key: string, options?: { type: 'json' | 'text' }) {
    const res = this.kv[key];
    if (!res) {
      return undefined;
    }
    return options?.type === 'json' ? JSON.parse(res) : res;
  }

  async put(key: string, value: string) {
    this.kv[key] = value;
  }

  async delete(key: string) {
    delete this.kv[key];
  }
}

const hono = createHono({
  db: new KVAdapter(new NodeKV()),
  allowNewDevice: process.env.ALLOW_NEW_DEVICE !== 'false',
  allowQueryNums: process.env.ALLOW_QUERY_NUMS !== 'false',
  maxBatchPushCount: Number(process.env.MAX_BATCH_PUSH_COUNT),
  urlPrefix: process.env.URL_PREFIX || '/',
  basicAuth: process.env.BASIC_AUTH,
  apnsUrl: process.env.APNS_URL,
});

serve(hono, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});
