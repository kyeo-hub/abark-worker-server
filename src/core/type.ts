import type { Context } from 'hono';

export type BasicEnv = Partial<{
  DB_NAME: string;
  ALLOW_NEW_DEVICE: string;
  ALLOW_QUERY_NUMS: string;
  MAX_BATCH_PUSH_COUNT: string;
  BASIC_AUTH: string;
  URL_PREFIX: string;
  APNS_URL: string;
  PROXY_TOKEN: string;
}>;

export type NullLike = null | undefined;

export type DeviceType = 'ios' | 'android';

export interface Device {
  device_key: string;
  device_type: DeviceType;
  
  // iOS 设备需要
  device_token?: string;  // APNs token
  
  // Android 设备需要
  public_key?: string;    // RSA 公钥
  
  created_at: number;
  last_seen: number;
}

export interface OfflineMessage {
  id: string;
  device_key: string;
  data: any;
  encrypted?: string;
  created_at: number;
}

export interface WSMessage {
  type: 'message' | 'ping' | 'pong' | 'ack';
  id?: string;
  timestamp: number;
  data?: any;
}

export interface DBAdapter {
  countAll(): Promise<number>;
  deviceTokenByKey(key: string): Promise<string | NullLike>;
  saveDeviceTokenByKey(key: string, token: string): Promise<void>;
  deleteDeviceByKey(key: string): Promise<void>;
  saveAuthorizationToken(token: string, ttl: number): Promise<void>;
  getAuthorizationToken(): Promise<string | NullLike>;
  
  // 新增：设备管理
  getDevice(key: string): Promise<Device | NullLike>;
  saveDevice(device: Device): Promise<void>;
  
  // 新增：离线消息
  saveOfflineMessage(msg: OfflineMessage): Promise<void>;
  getOfflineMessages(deviceKey: string): Promise<OfflineMessage[]>;
  deleteOfflineMessage(messageId: string): Promise<void>;
}

export interface APNsResponse {
  status: number;
  message: string;
}

export interface APNsProxyResponse extends APNsResponse {
  id: string;
}

export interface APNsProxyItem {
  id: string;
  deviceToken: string;
  headers: Record<string, string>;
  aps: any;
}

export interface Options {
  db: DBAdapter;
  allowNewDevice: boolean;
  allowQueryNums: boolean;
  maxBatchPushCount: number;
  basicAuth?: string;
  urlPrefix?: string;
  apnsUrl?: string;
  requestAPNs?: (
    deviceToken: string,
    headers: Record<string, string>,
    aps: any,
    ctx?: Context,
  ) => Promise<APNsResponse>;
}
