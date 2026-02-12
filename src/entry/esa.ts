import type { Env } from 'hono';
import { type BasicKV, KVAdapter } from '../core/db/kv-adapter';
import { createHono } from '../core/hono';
import type { BasicEnv } from '../core/type';

// @see https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/edge-storage-api
declare class EdgeKV implements BasicKV {
  constructor(params: { namespace: string });
  get(key: string, options?: { type: 'json' | 'text' }): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
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

const db = new KVAdapter(new EdgeKV({ namespace: env.DB_NAME || 'bark' }));
const { app: hono, wsHub } = createHono<ESAHonoEnv>({
  db,
  allowNewDevice: env.ALLOW_NEW_DEVICE !== 'false',
  allowQueryNums: env.ALLOW_QUERY_NUMS !== 'false',
  maxBatchPushCount: Number(env.MAX_BATCH_PUSH_COUNT),
  urlPrefix: env.URL_PREFIX || '/',
  basicAuth: env.BASIC_AUTH,
  apnsUrl: env.APNS_URL,
});

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    
    // 处理 WebSocket 升级请求
    if (url.pathname === (env.URL_PREFIX || '/') + 'ws' || 
        url.pathname === '/ws') {
      return handleWebSocket(request);
    }
    
    return hono.fetch(request, env);
  },
};

/**
 * 处理 WebSocket 连接（ESA 环境）
 * 注意：ESA 的 WebSocket 支持可能需要特殊配置
 */
async function handleWebSocket(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const deviceKey = url.searchParams.get('key');
  
  if (!deviceKey) {
    return new Response('Missing device key', { status: 400 });
  }
  
  // 验证设备
  const device = await db.getDevice(deviceKey);
  if (!device || device.device_type !== 'android') {
    return new Response('Invalid device', { status: 401 });
  }
  
  // ESA 环境的 WebSocket 升级
  // 注意：需要检查 ESA 是否支持 WebSocket
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }
  
  try {
    // 创建 WebSocket 对
    const { 0: client, 1: server } = new WebSocketPair();
    
    // 注册到 Hub
    wsHub.registerClient(deviceKey, server);
    
    // 设置消息处理
    server.accept();
    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        // 处理 ACK 消息
        if (data.type === 'ack' && data.id) {
          await db.deleteOfflineMessage(data.id);
        }
      } catch (error) {
        console.error('Failed to handle WebSocket message:', error);
      }
    });
    
    server.addEventListener('close', () => {
      wsHub.unregisterClient(deviceKey);
    });
    
    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      wsHub.unregisterClient(deviceKey);
    });
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  } catch (error) {
    console.error('WebSocket upgrade failed:', error);
    return new Response('WebSocket upgrade failed', { status: 500 });
  }
}
