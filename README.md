# egoops-mock

## 1. 一句话定位

EgoOps「申请采集点」链路的**本机模拟服务**：按真实接口契约复刻 task-set / task / media-asset / 预签名直传 / 提交审核，数据只落本机 `state.json` + `storage/`，不连任何线上系统。

## 2. 原始来源

| 项 | 值 |
| --- | --- |
| 工作区路径 | `C:\Users\Administrator\Documents\deepseek-harness\default-workspace\mock\` |
| 原始文件 | `mock-egoops.mjs`（249 行 / 11.0KB） |
| 业务数据（未入库） | `state.json`（站点/任务/媒体运行时状态）、`storage\m1004…m1046`（直传的二进制） |
| 版本 | v1.0.0（拆分版）；原件完整副本见 `legacy\mock-egoops.mjs` |

## 3. 目录结构

```
egoops-mock/
  README.md  LICENSE  .gitignore  package.json
  mock-egoops.mjs              # 入口（5 行，转发到 src/index.mjs）
  src/
    index.mjs                  # 取端口 → createApp() → listen
    app.mjs                    # http.createServer(router.handle)
    router.mjs                 # 路由装配（上传前缀 → /api/v1 判定 → 鉴权 → body → 各域 → 404）
    config.mjs                 # ROOT / PORT(live) / STORAGE / STATE
    state.mjs                  # state 单例 + save() + nextId()
    http-helpers.mjs           # json / err / now / readBody
    auth.mjs                   # Bearer 前缀校验
    views.mjs                  # siteView()（任务与媒体计数）
    domain.mjs                 # newTask() / validateSite()
    tet-snapshot.mjs           # TET 场景分类树样例
    routes/
      tet.mjs                  # GET /api/v1/tet-snapshots/active
      task-sets.mjs            # 采集点链路（建草稿/查询/修改/任务/提交审核）
      tasks.mjs                # PATCH /api/v1/tasks/:id
      media-assets.mjs         # upload-url / complete
      upload.mjs               # PUT /upload/:mediaId（模拟对象存储）
      mock-admin.mjs           # __mock/sites、__mock/reset
  scripts/
    check.mjs                  # 递归 node --check
    smoke.mjs                  # 临时目录端到端冒烟（23 项断言）
  legacy/
    mock-egoops.mjs            # 原始单文件镜像（只读参照）
  docs/
    ARCHITECTURE.md  SPLIT.md  PACKAGING.md
  examples/
    state.example.json         # 结构样例（每类 1 条 + "…"）
```

## 4. 安装与运行

```bash
# 零依赖，无需 npm install
node -v                      # 建议 >= 18（用到 fetch/structuredClone 的测试脚本需 18+）
npm start                    # = node mock-egoops.mjs，默认 http://127.0.0.1:18080
npm run dev                  # = node --watch mock-egoops.mjs
npm run check                # 递归 node --check
npm run smoke                # 端到端冒烟（临时目录 + 随机端口，不动仓库数据）
MOCK_PORT=18081 npm start    # 换端口（Windows: set MOCK_PORT=18081 && npm start）
```

首次启动自建 `storage/`；`state.json` 不存在时用 `defaultState`（`seq` 从 1000 起）。
环境变量：`MOCK_PORT`（端口，`0` = 随机）、`MOCK_ROOT`（数据目录，测试用）。

## 5. 模块说明

| 模块 | 行数 | 职责 |
| --- | --- | --- |
| `src/index.mjs` | 24 | 入口：`start(port)`、`listen` 后回填真实端口、直接执行时自启 |
| `src/app.mjs` | 9 | `createApp()` 返回 `node:http` server |
| `src/router.mjs` | 59 | 路由装配；请求体「每请求只读一次」并以 `ctx` 下发；兜底 404 |
| `src/config.mjs` | 22 | `ROOT`/`PORT`(live)/`setPort`/`STORAGE`/`STATE`，启动建 `storage/` |
| `src/state.mjs` | 14 | `defaultState`、`state` 单例、`save()`、`nextId()` |
| `src/http-helpers.mjs` | 22 | `json()`、`err()`、`now()`、`readBody()` |
| `src/auth.mjs` | 12 | `auth()`：只校验 `Authorization: Bearer ` 前缀 |
| `src/views.mjs` | 13 | `siteView()`：采集点 + 任务统计 + 照片/视频数 |
| `src/domain.mjs` | 33 | `newTask()` 草稿默认值、`validateSite()` 提交前 8 项校验 |
| `src/tet-snapshot.mjs` | 22 | TET 场景分类树（两级样例） |
| `src/routes/tet.mjs` | 20 | `GET /api/v1/tet-snapshots/active` |
| `src/routes/task-sets.mjs` | 93 | `allocate-draft`、`GET/PATCH /:id`、`/:id/tasks`、`tasks/allocate-draft`、`submit-review` |
| `src/routes/tasks.mjs` | 26 | `PATCH /api/v1/tasks/:id`（photos/videos 去重） |
| `src/routes/media-assets.mjs` | 47 | `upload-url`（数量上限）、`/:id/complete` |
| `src/routes/upload.mjs` | 34 | `PUT /upload/:mediaId` 直传落盘 + MD5 ETag |
| `src/routes/mock-admin.mjs` | 20 | `GET /__mock/sites`、`POST /__mock/reset` |
| `scripts/check.mjs` | 36 | 递归对 `.mjs` 逐个 `node --check` |
| `scripts/smoke.mjs` | 137 | 鉴权→场景→建点→加任务→校验→直传→审核→锁库→reset 全链路（23 项断言） |

## 6. 配置项

无配置文件，全部走环境变量与常量：

| 项 | 位置 | 说明 |
| --- | --- | --- |
| `MOCK_PORT` | 环境变量 | 监听端口，默认 `18080`；`0` = 系统分配 |
| `MOCK_ROOT` | 环境变量 | 数据根目录，默认仓库根 |
| `ROOT` | `src/config.mjs` | 仓库根（`storage/`、`state.json` 落在此） |
| `defaultState` | `src/state.mjs` | `{ sites: [], tasks: [], media: [], seq: 1000 }` |

接口示例（占位符表示由调用方提供）：

```bash
TOKEN=<FILL_ME>
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:18080/api/v1/tet-snapshots/active
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{}' http://127.0.0.1:18080/api/v1/task-sets/allocate-draft
```

`examples/state.example.json` 是状态文件的结构样例（sites/tasks/media 各 1 条 + `"…"`），真实 `state.json` 不入库。

## 7. 打包与部署要点

- **无构建步骤**：纯 ESM、零依赖，`node mock-egoops.mjs` 即可；不需要 `npm install`。
- **仅用于本机/联调环境**：接口契约是复刻件，不做鉴权强度、限流、并发控制，**不要暴露到公网**。
- 作为 relay 的上游替身时，把 relay 侧 `egoops.base` 指向 `http://127.0.0.1:18080` 即可（token 任意非空）。
- **数据复位**：`POST /api/v1/__mock/reset` 清空状态；删除 `state.json` + `storage/` 等价复位。
- **容器化**：镜像只需 `node:22-alpine` + 本目录，`VOLUME /app/storage /app/state.json`。

## 8. 拆分说明

原 `mock-egoops.mjs`（249 行单文件）按路由域拆成 `src/` 下 16 个模块，**路由体与函数体逐字搬运**，
仅新增 `import`/`export`、模块头注释，以及用 `ctx` 对象替代原来的闭包共享变量。
完整映射（行段 → 模块）见 [docs/SPLIT.md](docs/SPLIT.md)，接口清单与状态模型见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，
原件对照见 `legacy/mock-egoops.mjs`。

必要改写 5 处（详见 SPLIT.md 第 4 节）：`ROOT` 用 `fileURLToPath` + `MOCK_ROOT`、`PORT` 改 live binding、
请求体/`parse()` 由 router 统一下发、每个域改成 `async handleXxx(ctx)`、兜底 404 集中到 router。
原文件的一个既有缺陷（`PUT /upload/:id` 的尺寸校验判据写错，实际不生效）**原样保留**并在冒烟用例中记录。
