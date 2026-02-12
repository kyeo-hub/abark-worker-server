/**
 * WebSocket Hub - 管理 Android 设备的 WebSocket 连接
 */

import type { Device, OfflineMessage, WSMessage } from './type';

export interface WSClient {
  deviceKey: string;
  ws: WebSocket;
}

export class WebSocketHub {
  private clients: Map<string, WSClient> = new Map();
  private db: any; // DBAdapter

  constructor(db: any) {
    this.db = db;
  }

  /**
   * 注册客户端连接
   */
  registerClient(deviceKey: string, ws: WebSocket): void {
    // 如果已有连接，关闭旧连接
    if (this.clients.has(deviceKey)) {
      const oldClient = this.clients.get(deviceKey);
      if (oldClient) {
        oldClient.ws.close();
      }
    }

    // 注册新连接
    const client: WSClient = { deviceKey, ws };
    this.clients.set(deviceKey, client);
    console.log(`WebSocket client registered: ${deviceKey}`);

    // 发送离线消息
    this.sendOfflineMessages(deviceKey, ws);
  }

  /**
   * 注销客户端连接
   */
  unregisterClient(deviceKey: string): void {
    if (this.clients.has(deviceKey)) {
      this.clients.delete(deviceKey);
      console.log(`WebSocket client unregistered: ${deviceKey}`);
    }
  }

  /**
   * 发送消息到指定设备
   */
  sendToDevice(deviceKey: string, message: WSMessage): boolean {
    const client = this.clients.get(deviceKey);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * 检查设备是否在线
   */
  isOnline(deviceKey: string): boolean {
    const client = this.clients.get(deviceKey);
    return client !== undefined && client.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 发送离线消息
   */
  private async sendOfflineMessages(deviceKey: string, ws: WebSocket): Promise<void> {
    try {
      const messages = await this.db.getOfflineMessages(deviceKey);
      for (const msg of messages) {
        const wsMessage: WSMessage = {
          type: 'message',
          id: msg.id,
          timestamp: msg.created_at,
          data: msg.encrypted ? { encrypted_content: msg.encrypted } : msg.data,
        };
        ws.send(JSON.stringify(wsMessage));
      }
    } catch (error) {
      console.error('Failed to send offline messages:', error);
    }
  }

  /**
   * 获取在线设备数量
   */
  getOnlineCount(): number {
    return this.clients.size;
  }

  /**
   * 获取所有在线设备的 key
   */
  getOnlineDevices(): string[] {
    return Array.from(this.clients.keys());
  }
}

/**
 * 创建 WebSocket 消息
 */
export function createWSMessage(
  type: 'message' | 'ping' | 'pong' | 'ack',
  id?: string,
  data?: any
): WSMessage {
  return {
    type,
    id: id || crypto.randomUUID(),
    timestamp: Date.now(),
    data,
  };
}
