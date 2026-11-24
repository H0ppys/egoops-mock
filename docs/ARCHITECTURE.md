# 架构说明（egoops-mock）

## 1. 这个服务干什么

复刻 EgoOps「申请采集点」链路的接口契约，供 relay / App / 查看器做**本机端到端联调**：
建草稿采集点 → 追加任务 → 三段式媒体上传（申请地址 → 直传 → 完成）→ 提交审核（含字段校验与锁库）。

不连美团线上，所有状态落本机：

- `state.json`：`sites[] / tasks[] / media[] / seq`（自增 id 计数器）
- `storage/<media_id>`：直传上来的二进制

## 2. 进程与入口

```
node mock-egoops.mjs        # 根入口，只做转发
  └─ src/index.mjs          # start(port)：listen('0.0.0.0') → 回填真实端口
       └─ src/app.mjs       # http.createServer(router.handle)
            └─ src/router.mjs
```

- `PORT` 是 **live binding**：`MOCK_PORT=0` 时 listen 拿到随机端口后 `setPort(真实端口)`，
  保证 `upload-url` 返回的预签名地址端口正确。
- `src/index.mjs` 被 import 时不自启（冒烟测试可直接 `start(0)`）。

## 3. 请求流向与分派顺序

```
                    ┌─ 1) PUT /upload/<media_id>     预签名直传（先于 /api/v1 判定）
请求 ──▶ router ────┤   2) 非 /api/v1/ 前缀           → 404 { detail:"Not Found" }
                    │   3) auth()  无 Bearer 前缀     → 401 { detail:"Not authenticated" }
                    │   4) 读 body（GET/DELETE 为 null）+ parse()
                    └─ 5) 域路由链（见下表）→ 兜底 404
```

| 顺序 | 域模块 | 路由 |
| --- | --- | --- |
| 1 | `src/routes/tet.mjs` | `GET /api/v1/tet-snapshots/active` |
| 2 | `src/routes/task-sets.mjs` | `POST /api/v1/task-sets/allocate-draft`、`GET\|PATCH /api/v1/task-sets/:id`、`GET /api/v1/task-sets/:id/tasks`、`POST /api/v1/task-sets/:id/tasks/allocate-draft`、`POST /api/v1/task-sets/:id/submit-review` |
| 3 | `src/routes/tasks.mjs` | `PATCH /api/v1/tasks/:id` |
| 4 | `src/routes/media-assets.mjs` | `POST /api/v1/media-assets/upload-url`、`POST /api/v1/media-assets/:id/complete` |
| 5 | `src/routes/mock-admin.mjs` | `GET /api/v1/__mock/sites`、`POST /api/v1/__mock/reset` |

每个域模块导出 `async handleXxx(ctx)`；`ctx = { req, res, u, p, method, body, parse }`。
命中即写响应（`src/http-helpers.mjs` 的 `json()`/`err()` 会 `writeHead`），未命中返回 `false`。
router 用 `res.headersSent || 返回值 === true` 判定接管。

## 4. 状态模型

```jsonc
{
  "sites": [ { "task_set_id": "771001", "review_status": "draft|submitted|rejected",
               "name": "", "address": "", "tet_node_path": "", "tasks": "(视图层拼装)",
               "project_id": "…", "vendor_id": "…", "…": "契约字段全量" } ],
  "tasks": [ { "task_id": "661001", "task_set_id": "771001", "task_name": "", "description": "",
               "required_duration": 0, "collect_mode": "passive", "sop": { "steps": [] },
               "task_photos": [], "task_videos": [], "review_status": "draft" } ],
  "media": [ { "media_id": "m1004", "owner_type": "task", "owner_id": "…",
               "business_type": "TASK_PHOTO|TASK_VIDEO", "filename": "", "content_type": "",
               "file_size": 0, "uploaded_at": null, "completed_at": null, "bytes": 0 } ],
  "seq": 1000
}
```

`siteView(s)` 是读接口的拼装层：把同 `task_set_id` 的任务挂上去，并把 `task_photos`/`task_videos`
折成 `photos`/`videos` 两个数字。

## 5. 关键业务规则

| 规则 | 位置 | 行为 |
| --- | --- | --- |
| 采集点仅在 `draft`/`rejected` 可改 | `routes/task-sets.mjs` | 否则 409 `COLLECTION_SITE_CONTENT_LOCKED` |
| `PATCH` 后名称/地址/场景必须非空 | `routes/task-sets.mjs` | 400 `COLLECTION_SITE_FIELDS_REQUIRED` |
| 提交审核前 8 项校验 | `domain.mjs` `validateSite()` | 400 `VALIDATION_FAILED` + `params.problems[]` |
| 提交成功后任务一起置 `submitted` | `routes/task-sets.mjs` | 之后 PATCH 采集点被锁 |
| 媒体数量上限 | `routes/media-assets.mjs` | `TASK_PHOTO` 9、`TASK_VIDEO` 3，超限 409 `MEDIA_LIMIT_REACHED` |
| 直传写入即留痕 | `routes/upload.mjs` | 落 `storage/<media_id>`，回 `ETag: "<md5>"` |
| 完成前必须已直传 | `routes/media-assets.mjs` | 文件不存在 → 400 `UPLOAD_INCOMPLETE` |
| 尺寸校验不生效（原缺陷） | `routes/upload.mjs` | 判据是 `media.size`，实际字段为 `file_size`，恒定 undefined |

## 6. 已知缺陷

1. `PUT /upload/:id` 的尺寸校验判据写错（见上表），原样保留。
2. `allocate-draft` 里的 `project_id` / `vendor_id` 等是写死的样例值，用于契约对齐，不代表真实租户。
3. 无鉴权强度：任意非空 `Bearer` 均可调用；`__mock/*` 调试接口同样只需 Bearer。**不要暴露公网**。

## 7. 与 relay 的关系

```
App ──▶ egoops-relay ──▶ (EgoOps 线上)   ← 生产
App ──▶ egoops-relay ──▶ egoops-mock    ← 本机联调：把 relay 侧 base 指向 http://127.0.0.1:18080
```

两者协议不同（relay 是分片上传 + SQLite 台账；mock 是 EgoOps 契约 + state.json），
通过 `egoops-relay/src/egoops.mjs` 这个客户端库对接。
