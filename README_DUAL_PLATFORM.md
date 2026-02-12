# 双平台支持说明

本项目现已支持 **iOS (Bark)** 和 **Android (Accnotify)** 双平台推送！

## 🎯 功能特性

- ✅ **iOS 推送**：通过 APNs 推送到 Bark iOS 客户端
- ✅ **Android 推送**：通过 WebSocket 实时推送到 Accnotify Android 客户端
- ✅ **统一 API**：使用相同的推送接口，自动识别设备类型
- ✅ **端到端加密**：Android 推送支持 RSA+AES 加密传输
- ✅ **离线消息**：Android 设备离线时自动存储消息，重连后推送
- ✅ **批量推送**：同时向 iOS 和 Android 设备批量推送

---

## 📱 iOS 设备使用 (Bark 客户端)

### 1. 设备注册

**GET 方式**：
```bash
GET /register?device_token=你的APNs_Token&device_key=可选设备密钥
```

**POST 方式**：
```bash
POST /register
Content-Type: application/json

{
  "device_token": "你的APNs_Token",
  "device_key": "可选设备密钥",
  "device_type": "ios"
}
```

**响应**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "key": "设备密钥",
    "device_key": "设备密钥",
    "device_type": "ios",
    "device_token": "APNs_Token"
  }
}
```

### 2. 推送消息

所有 Bark 支持的推送方式都可以使用：

```bash
# 方式1: GET 请求
GET /:device_key/:title/:body

# 方式2: POST 请求
POST /push
{
  "device_key": "xxx",
  "title": "标题",
  "body": "内容",
  "group": "分组",
  "sound": "声音",
  "url": "跳转链接",
  ...
}
```

---

## 🤖 Android 设备使用 (Accnotify 客户端)

### 1. 生成 RSA 密钥对

在 Android 客户端生成 RSA 密钥对（2048 或 4096 位），私钥保存在本地，公钥用于注册。

### 2. 设备注册

**POST 方式**：
```bash
POST /register
Content-Type: application/json

{
  "device_key": "设备密钥",
  "device_type": "android",
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
}
```

**响应**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "key": "设备密钥",
    "device_key": "设备密钥",
    "device_type": "android"
  }
}
```

### 3. 建立 WebSocket 连接

在 Android 客户端建立 WebSocket 连接：

```kotlin
// Kotlin 示例
val wsUrl = "wss://你的服务器地址/ws?key=设备密钥"
val webSocket = OkHttpClient().newWebSocket(
    Request.Builder().url(wsUrl).build(),
    object : WebSocketListener() {
        override fun onMessage(webSocket: WebSocket, text: String) {
            // 接收到推送消息
            val message = JSONObject(text)
            when (message.getString("type")) {
                "message" -> {
                    // 处理推送消息
                    val encrypted = message.getJSONObject("data").optString("encrypted_content")
                    if (encrypted.isNotEmpty()) {
                        // 使用私钥解密
                        val decrypted = decrypt(encrypted)
                        showNotification(decrypted)
                    }
                    
                    // 发送 ACK 确认
                    webSocket.send(JSONObject().apply {
                        put("type", "ack")
                        put("id", message.getString("id"))
                    }.toString())
                }
                "ping" -> {
                    // 响应心跳
                    webSocket.send(JSONObject().apply {
                        put("type", "pong")
                        put("timestamp", System.currentTimeMillis())
                    }.toString())
                }
            }
        }
    }
)
```

### 4. 推送消息

使用与 iOS 相同的推送 API：

```bash
POST /push
{
  "device_key": "Android设备密钥",
  "title": "标题",
  "body": "内容",
  "group": "分组",
  "url": "跳转链接",
  ...
}
```

**WebSocket 接收的消息格式**：
```json
{
  "type": "message",
  "id": "消息UUID",
  "timestamp": 1234567890,
  "data": {
    "encrypted_content": "加密内容（如果设备有公钥）"
  }
}
```

或未加密：
```json
{
  "type": "message",
  "id": "消息UUID",
  "timestamp": 1234567890,
  "data": {
    "title": "标题",
    "body": "内容",
    "group": "分组",
    ...
  }
}
```

---

## 🔄 跨平台推送

### 批量推送到多设备

```bash
POST /push
{
  "device_keys": ["ios_key1", "android_key2", "ios_key3"],
  "title": "群发消息",
  "body": "所有设备都会收到"
}
```

系统会自动识别每个设备的类型并选择合适的推送方式。

---

## 🔐 加密说明

### Android 端到端加密流程

1. **注册阶段**：
   - Android 客户端生成 RSA 密钥对
   - 私钥保存在本地（安全存储）
   - 公钥上传到服务器

2. **推送阶段**：
   - 服务器使用公钥加密消息内容
   - 采用 RSA+AES 混合加密：
     - 生成随机 AES-256 密钥
     - 用 RSA-OAEP 加密 AES 密钥
     - 用 AES-GCM 加密消息内容
   - 通过 WebSocket 发送加密内容

3. **接收阶段**：
   - Android 客户端接收加密内容
   - 使用私钥解密 AES 密钥
   - 使用 AES 密钥解密消息内容

### 解密示例（Android/Kotlin）

```kotlin
fun decryptMessage(encryptedBase64: String): String {
    val encrypted = Base64.decode(encryptedBase64, Base64.DEFAULT)
    
    // 解析格式: [2字节密钥长度][加密的密钥][12字节nonce][密文]
    val keyLen = ((encrypted[0].toInt() and 0xFF) shl 8) or (encrypted[1].toInt() and 0xFF)
    val encryptedKey = encrypted.copyOfRange(2, 2 + keyLen)
    val nonce = encrypted.copyOfRange(2 + keyLen, 2 + keyLen + 12)
    val ciphertext = encrypted.copyOfRange(2 + keyLen + 12, encrypted.size)
    
    // 使用 RSA 私钥解密 AES 密钥
    val aesKey = decryptRSA(encryptedKey)
    
    // 使用 AES-GCM 解密消息
    return decryptAESGCM(aesKey, nonce, ciphertext)
}
```

---

## 📊 设备管理

### 查询设备信息

```bash
GET /info
Authorization: Basic base64(username:password)
```

**响应**：
```json
{
  "version": "v2.2.6",
  "build": "2025-12-03 10:51:22",
  "arch": "js/esa",
  "devices": 10
}
```

---

## 🚀 部署到阿里云 ESA

### 1. 配置环境变量

在 ESA 控制台配置以下环境变量：

```bash
DB_NAME=bark                    # KV 数据库名称
ALLOW_NEW_DEVICE=true           # 允许新设备注册
ALLOW_QUERY_NUMS=true           # 允许查询设备数量
MAX_BATCH_PUSH_COUNT=100        # 批量推送上限
BASIC_AUTH=                     # HTTP Basic Auth（可选）
URL_PREFIX=/                    # URL 前缀
APNS_URL=                       # 自定义 APNs 地址（可选）
```

### 2. 创建 KV 数据库

在 ESA 控制台创建名为 `bark` 的 Edge KV 数据库。

### 3. 构建和部署

```bash
# 安装依赖
pnpm install

# 构建 ESA 版本
pnpm build:esa

# 部署到 ESA
# 参考 ESA 官方文档
```

### 4. WebSocket 配置

**重要**：ESA 的 WebSocket 支持可能需要特殊配置，请检查：

1. ESA 是否支持 WebSocket 升级
2. 是否需要配置 WebSocket 超时时间
3. 是否需要配置连接数限制

---

## ⚠️ 已知限制

### iOS 设备
- 批量推送有最大上限（可配置）
- 因 KV 写入延迟，设备注册后需要等待几秒才能推送
- 设备计数仅供参考

### Android 设备
- 离线消息保留 7 天（自动过期）
- WebSocket 连接可能因网络波动断开，需要实现重连机制
- 加密功能为可选，不提供公钥时发送明文

### ESA 环境
- WebSocket 支持需要验证
- KV 数据库可能有写入延迟

---

## 🔧 客户端开发建议

### iOS (Bark 客户端)
- 直接使用官方 Bark 客户端
- 无需修改，完全兼容

### Android (Accnotify 客户端)
- 需要实现 WebSocket 客户端
- 建议使用 OkHttp 或其他成熟的 WebSocket 库
- 必须实现重连机制和心跳响应
- 强烈建议使用加密传输

---

## 📝 更新日志

### v2.3.0 (2026-02-12)
- ✨ 新增 Android 设备支持（WebSocket 推送）
- ✨ 新增 RSA+AES 端到端加密
- ✨ 新增离线消息存储
- ✨ 统一 iOS 和 Android 推送 API
- 🐛 修复设备注册兼容性问题
- 📝 更新文档，支持双平台

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

GPL-3.0 License
