import type { Env } from 'hono';
import { KVAdapter } from '../core/db/kv-adapter';
import { createHono } from '../core/hono';
import type { BasicEnv } from '../core/type';
import type { WebSocketHub } from '../core/websocket';

interface CFHonoEnv extends Env {
  Bindings: BasicEnv;
}

let app: ReturnType<typeof createHono>['app'];
let wsHub: WebSocketHub;

export default {
  fetch(request: Request, env: BasicEnv, ctx: any) {
    if (!app) {
      const db = new KVAdapter((env as any)[env.DB_NAME || 'BARK_KV']);
      const result = createHono({
        db,
        allowNewDevice: env.ALLOW_NEW_DEVICE !== 'false',
        allowQueryNums: env.ALLOW_QUERY_NUMS !== 'false',
        maxBatchPushCount: Number(env.MAX_BATCH_PUSH_COUNT),
        urlPrefix: env.URL_PREFIX || '/',
        basicAuth: env.BASIC_AUTH,
        apnsUrl: env.APNS_URL,
      });
      app = result.app;
      wsHub = result.wsHub;
    }

    // 处理 WebSocket 升级请求
    const url = new URL(request.url);
    if (url.pathname === '/ws' || url.pathname.startsWith('/ws/')) {
      return handleWebSocket(request, url);
    }

    return app.fetch(request, env, ctx);
  },
};

/**
 * 处理 WebSocket 连接
 */
function handleWebSocket(request: Request, url: URL): Response {
  // 检查是否是 WebSocket 升级请求
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  // 从 URL 获取 device_key
  const deviceKey = url.searchParams.get('device_key') || url.pathname.replace('/ws/', '').replace('/ws', '');
  
  if (!deviceKey) {
    return new Response('device_key is required', { status: 400 });
  }

  // 创建 WebSocket 对
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  // 接受连接
  server.accept();
  
  // 注册客户端
  wsHub.registerClient(deviceKey, server as unknown as WebSocket);
  
  console.log(`WebSocket connected: ${deviceKey}`);

  // 处理消息
  server.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data as string);
      
      // 处理心跳
      if (data.type === 'ping') {
        server.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
      
      // 处理确认消息
      if (data.type === 'ack' && data.id) {
        console.log(`Message ${data.id} acknowledged by ${deviceKey}`);
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  });

  // 处理关闭
  server.addEventListener('close', () => {
    wsHub.unregisterClient(deviceKey);
    console.log(`WebSocket disconnected: ${deviceKey}`);
  });

  // 处理错误
  server.addEventListener('error', (error) => {
    console.error(`WebSocket error for ${deviceKey}:`, error);
    wsHub.unregisterClient(deviceKey);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
