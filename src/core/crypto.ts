/**
 * 加密模块：RSA+AES 混合加密
 * 参考 Accnotify 的实现，为 Android 设备提供端到端加密
 */

const AES_KEY_SIZE = 32; // AES-256
const NONCE_SIZE = 12; // GCM nonce

/**
 * Base64 解码为 ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * ArrayBuffer 转 Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 解析 PEM 格式的 RSA 公钥
 */
export async function parsePublicKey(pemKey: string): Promise<CryptoKey> {
  // 移除 PEM 头尾
  const pemContents = pemKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryKey = base64ToArrayBuffer(pemContents);
  
  return await crypto.subtle.importKey(
    'spki',
    binaryKey,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt']
  );
}

/**
 * RSA+AES 混合加密
 * 返回格式: base64([2字节密钥长度][加密的AES密钥][12字节nonce][密文])
 */
export async function encryptMessage(
  publicKeyPem: string,
  plaintext: string
): Promise<string> {
  // 解析公钥
  const publicKey = await parsePublicKey(publicKeyPem);
  
  // 生成随机 AES 密钥
  const aesKey = crypto.getRandomValues(new Uint8Array(AES_KEY_SIZE));
  
  // 用 RSA-OAEP 加密 AES 密钥
  const encryptedKey = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    aesKey
  );
  
  // 创建 AES-GCM cipher
  const aesCryptoKey = await crypto.subtle.importKey(
    'raw',
    aesKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // 生成 nonce
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_SIZE));
  
  // 加密消息
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
    },
    aesCryptoKey,
    plaintextBytes
  );
  
  // 组合结果: [2字节密钥长度][加密的密钥][nonce][密文]
  const encryptedKeyArray = new Uint8Array(encryptedKey);
  const ciphertextArray = new Uint8Array(ciphertext);
  
  const keyLen = encryptedKeyArray.length;
  const result = new Uint8Array(2 + keyLen + NONCE_SIZE + ciphertextArray.length);
  
  // 写入密钥长度（2字节，大端序）
  result[0] = (keyLen >> 8) & 0xff;
  result[1] = keyLen & 0xff;
  
  // 写入加密的密钥
  result.set(encryptedKeyArray, 2);
  
  // 写入 nonce
  result.set(nonce, 2 + keyLen);
  
  // 写入密文
  result.set(ciphertextArray, 2 + keyLen + NONCE_SIZE);
  
  return arrayBufferToBase64(result.buffer);
}

/**
 * 生成随机设备密钥
 */
export function generateDeviceKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24)); // 24 bytes = 32 base64 chars
  return arrayBufferToBase64(bytes.buffer);
}
