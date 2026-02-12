import type { DBAdapter, Device, OfflineMessage } from '../type';

export interface BasicKV {
  get(key: string, options?: { type: 'json' | 'text' }): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export class KVAdapter implements DBAdapter {
  kv: BasicKV;
  constructor(kv: BasicKV) {
    if (!kv) {
      throw new Error('kv database not found');
    }
    this.kv = kv;
  }

  async countAll() {
    const c = Number(await this.kv.get('deviceCount'));
    return Number.isNaN(c) ? 0 : c;
  }
  async updateCount(diff: number) {
    const count = await this.countAll();
    await this.kv.put('deviceCount', String(count + diff));
  }

  async deviceTokenByKey(key: string) {
    const device = await this.getDevice(key);
    return device?.device_token;
  }

  async saveDeviceTokenByKey(key: string, token: string) {
    if (!token) {
      return this.deleteDeviceByKey(key);
    }
    const existingDevice = await this.getDevice(key);
    const device: Device = {
      device_key: key,
      device_type: existingDevice?.device_type || 'ios',
      device_token: token,
      public_key: existingDevice?.public_key,
      created_at: existingDevice?.created_at || Date.now(),
      last_seen: Date.now(),
    };
    return this.saveDevice(device);
  }

  async deleteDeviceByKey(key: string) {
    const deviceKey = (key || '').replace(/[^a-zA-Z0-9]/g, '') || '_PLACE_HOLDER_';
    this.updateCount(-1);
    return this.kv.delete(`device_${deviceKey}`);
  }

  async saveAuthorizationToken(token: string, ttl: number) {
    const expireAt = Date.now() + ttl;
    await this.kv.put('authToken', JSON.stringify({ token, expireAt }));
  }

  async getAuthorizationToken() {
    const res = await this.kv.get('authToken');
    if (!res || res.expireAt > Date.now()) {
      return undefined;
    }
    return res.token;
  }

  /**
   * 获取设备完整信息
   */
  async getDevice(key: string): Promise<Device | undefined> {
    const deviceKey = (key || '').replace(/[^a-zA-Z0-9]/g, '') || '_PLACE_HOLDER_';
    const deviceData = await this.kv.get(`device_${deviceKey}`, { type: 'json' });
    if (!deviceData) {
      return undefined;
    }
    // 兼容旧数据：如果没有 device_type，默认为 ios
    if (!deviceData.device_type) {
      deviceData.device_type = 'ios';
    }
    return deviceData;
  }

  /**
   * 保存设备信息
   */
  async saveDevice(device: Device): Promise<void> {
    const key = device.device_key.replace(/[^a-zA-Z0-9]/g, '') || '_PLACE_HOLDER_';
    const k = `device_${key}`;
    
    // 检查是否是新设备
    const existing = await this.kv.get(k);
    if (!existing) {
      this.updateCount(1);
    }
    
    await this.kv.put(k, JSON.stringify(device));
  }

  /**
   * 保存离线消息
   */
  async saveOfflineMessage(msg: OfflineMessage): Promise<void> {
    const key = `offline_${msg.device_key}_${msg.id}`;
    // 离线消息保留 7 天
    await this.kv.put(key, JSON.stringify(msg), { expirationTtl: 604800 });
  }

  /**
   * 获取设备的离线消息
   */
  async getOfflineMessages(deviceKey: string): Promise<OfflineMessage[]> {
    // 注意：KV 不支持前缀查询，这里使用一个索引来实现
    // 存储设备的消息 ID 列表
    const indexKey = `offline_index_${deviceKey}`;
    const messageIds = await this.kv.get(indexKey, { type: 'json' }) || [];
    
    const messages: OfflineMessage[] = [];
    for (const msgId of messageIds) {
      const key = `offline_${deviceKey}_${msgId}`;
      const msg = await this.kv.get(key, { type: 'json' });
      if (msg) {
        messages.push(msg);
      }
    }
    
    return messages.sort((a, b) => a.created_at - b.created_at);
  }

  /**
   * 删除离线消息
   */
  async deleteOfflineMessage(messageId: string): Promise<void> {
    // 需要遍历所有可能的设备（简化实现）
    // 在实际使用中，可以在消息确认时传递 device_key
    // 这里暂时不实现，因为消息有 TTL 会自动过期
  }
}
