# 打包与部署（egoops-mock）

纯 Node ESM 服务，零依赖、无构建步骤。定位是**本机/联调环境**的契约模拟器，不要暴露到公网。

## 1. 产物

| 产物 | 说明 |
| --- | --- |
| 源码目录 | 整个仓库（`src/`、`mock-egoops.mjs`、`package.json`） |
| 运行时数据 | `state.json`、`storage/<media_id>` |

## 2. 目标机准备

1. Node **>= 18**（`structuredClone` / 全局 `fetch`；服务本身用的是 `node:http`）。
2. 拷目录，例如 `/opt/egoops-mock`。
3. 直接 `node mock-egoops.mjs`；需要换端口就设 `MOCK_PORT`。
4. 需要干净状态时删掉 `state.json` 与 `storage/`，或调 `POST /api/v1/__mock/reset`。

## 3. Linux（systemd）

```ini
[Unit]
Description=egoops mock (EgoOps contract simulator)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/egoops-mock
ExecStart=/usr/bin/node mock-egoops.mjs
Environment=MOCK_PORT=18080
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## 4. Windows

```powershell
$env:MOCK_PORT=18080
node mock-egoops.mjs
# 或注册服务：
nssm install egoops-mock "C:\Program Files\nodejs\node.exe" "mock-egoops.mjs"
nssm set egoops-mock AppDirectory C:\egoops\mock
nssm set egoops-mock AppEnvironmentExtra MOCK_PORT=18080
```

## 5. 容器

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json mock-egoops.mjs ./
COPY src ./src
ENV MOCK_PORT=18080
VOLUME ["/app/storage"]
EXPOSE 18080
CMD ["node", "mock-egoops.mjs"]
```

## 6. 联调用法

```bash
# mock 侧
MOCK_PORT=18080 node mock-egoops.mjs

# 调用方：任意非空 Bearer 即可
curl -H 'Authorization: Bearer dev' http://127.0.0.1:18080/api/v1/tet-snapshots/active
curl -X POST -H 'Authorization: Bearer dev' -H 'Content-Type: application/json' \
     -d '{}' http://127.0.0.1:18080/api/v1/task-sets/allocate-draft
```

`upload-url` 返回的地址把 host 固定为 `127.0.0.1`，跨机联调时需要把 host 换掉（或在本机做端口转发）。

## 7. 验证

```bash
npm run check    # 递归 node --check
npm run smoke    # 临时目录 + 随机端口跑完整契约（不动仓库数据）
```

## 8. 升级

覆盖代码即可；`state.json` 结构若新增字段，旧文件仍可读（缺字段按 `undefined` 处理），
必要时 `POST /api/v1/__mock/reset` 或删 `state.json` 重新开局。
