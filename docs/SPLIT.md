# 拆分映射表（egoops-mock）

原文件：`mock\mock-egoops.mjs`（工作区路径 `C:\Users\Administrator\Documents\deepseek-harness\default-workspace\mock\mock-egoops.mjs`，共 **249 行**，11.0KB）。
表中行号为该文件真实行号；`legacy\mock-egoops.mjs` 是逐字节副本。

拆分原则：路由体与函数体逐字搬运；新增 `import`/`export`、模块头注释，以及一条**受限上下文
（ctx）传递约定**——原文件用闭包共享 `req/res/u/p/m/body/parse`，拆分后用 `ctx` 对象传递同样的值。

## 1. 基础层

| 原文件 | 行段 / 符号 | 新模块 | 说明 |
| --- | --- | --- | --- |
| mock-egoops.mjs | 3-6 导入 `http`/`fs`/`path`/`crypto` | 各模块分别导入 | 按需拆分 |
| mock-egoops.mjs | 8 `PORT`（`MOCK_PORT`） | src\config.mjs | 改为 live binding + `setPort()` |
| mock-egoops.mjs | 9 `ROOT`（`new URL().pathname` 去盘符） | src\config.mjs | 改 `fileURLToPath`；新增 `MOCK_ROOT` 覆盖 |
| mock-egoops.mjs | 10-12 `STORAGE` / `STATE` / `mkdirSync` | src\config.mjs | 启动即建 `storage/` |
| mock-egoops.mjs | 15 `defaultState` | src\state.mjs | 复位基准 |
| mock-egoops.mjs | 16 `state`（读 state.json） | src\state.mjs | 模块级单例，引用不变 |
| mock-egoops.mjs | 17 `save()` | src\state.mjs | 整份回写 state.json |
| mock-egoops.mjs | 19-34 `TET` 场景树 | src\tet-snapshot.mjs | 两级样例树 |
| mock-egoops.mjs | 37-41 `json()` / `err()` | src\http-helpers.mjs | |
| mock-egoops.mjs | 43 `now()` | src\http-helpers.mjs | `YYYY-MM-DDTHH:mm:ss` |
| mock-egoops.mjs | 44 `nextId()` | src\state.mjs | 依赖 `state.seq`，与状态同处 |
| mock-egoops.mjs | 46-53 `readBody()` | src\http-helpers.mjs | 原始 Buffer |
| mock-egoops.mjs | 55-59 `auth()` | src\auth.mjs | 只看有无 `Bearer ` 前缀 |
| mock-egoops.mjs | 61-68 `siteView()` | src\views.mjs | 任务统计 + 媒体计数 |
| mock-egoops.mjs | 221-228 `newTask()` | src\domain.mjs | 任务草稿默认值 |
| mock-egoops.mjs | 230-247 `validateSite()` | src\domain.mjs | 提交审核前的 8 项校验 |

## 2. 路由层

| 原文件 | 行段 / 符号 | 新模块 | 说明 |
| --- | --- | --- | --- |
| mock-egoops.mjs | 71-95 `http.createServer` + URL 解析 + `/upload/` 前缀判定 + auth + body/parse | src\router.mjs | 请求体「每请求只读一次」，与原一致 |
| mock-egoops.mjs | 76-89 `PUT /upload/:mediaId` | src\routes\upload.mjs | 模拟对象存储直传，返回 MD5 ETag |
| mock-egoops.mjs | 91 非 `/api/v1/` → 404 | src\router.mjs | 在鉴权之前 |
| mock-egoops.mjs | 92 `auth()` 调用点 | src\router.mjs | |
| mock-egoops.mjs | 94-95 `body` / `parse()` | src\router.mjs | GET/DELETE 不读 body |
| mock-egoops.mjs | 97-102 `GET /api/v1/tet-snapshots/active` | src\routes\tet.mjs | 返回 `TET` 快照 |
| mock-egoops.mjs | 104-124 `POST /api/v1/task-sets/allocate-draft` | src\routes\task-sets.mjs | 建草稿采集点 + 默认任务 |
| mock-egoops.mjs | 126-131 `GET /api/v1/task-sets/:id` | src\routes\task-sets.mjs | 404 `COLLECTION_TASK_SET_NOT_FOUND` |
| mock-egoops.mjs | 132-143 `PATCH /api/v1/task-sets/:id` | src\routes\task-sets.mjs | 仅 draft/rejected 可改，否则 409 |
| mock-egoops.mjs | 144-149 `GET /api/v1/task-sets/:id/tasks` | src\routes\task-sets.mjs | `records/current/size/total` |
| mock-egoops.mjs | 150-159 `POST .../tasks/allocate-draft` | src\routes\task-sets.mjs | 追加任务草稿 |
| mock-egoops.mjs | 160-173 `POST .../submit-review` | src\routes\task-sets.mjs | 校验失败 400 `VALIDATION_FAILED` |
| mock-egoops.mjs | 175-185 `PATCH /api/v1/tasks/:id` | src\routes\tasks.mjs | photos/videos 去重合并 |
| mock-egoops.mjs | 187-201 `POST /api/v1/media-assets/upload-url` | src\routes\media-assets.mjs | 上限 TASK_PHOTO 9 / TASK_VIDEO 3；拼 `PORT` |
| mock-egoops.mjs | 202-212 `POST /api/v1/media-assets/:id/complete` | src\routes\media-assets.mjs | 文件不存在 → 400 `UPLOAD_INCOMPLETE` |
| mock-egoops.mjs | 214-216 `GET /api/v1/__mock/sites`、`POST /api/v1/__mock/reset` | src\routes\mock-admin.mjs | 测试调试接口 |
| mock-egoops.mjs | 218 兜底 404 | src\router.mjs | `Not Found` |
| mock-egoops.mjs | 249 `server.listen(...)` | src\index.mjs | `0.0.0.0`，端口 0 时回填真实端口 |
| mock-egoops.mjs | （原文件无） | mock-egoops.mjs（根，5 行） | 入口名保留，转发 `start()` |

## 3. 业务数据与工具

| 原文件 | 行段 / 符号 | 新模块 | 说明 |
| --- | --- | --- | --- |
| state.json | sites/tasks/media 各 1 条 | examples\state.example.json | 结构样例 + `"…"` 占位，真实状态不入库 |
| storage\m1004…m1046 | 上传的二进制 | 不入库 | `.gitignore` 忽略 `storage/` |
| — | 新增 | scripts\check.mjs | 递归 `node --check` |
| — | 新增 | scripts\smoke.mjs | 临时目录起服务走完整契约（23 项断言） |

## 4. 必要改写与原文件既有缺陷

1. **`PORT` 变 live binding**：原文件 `const PORT` 在模块顶确定；冒烟测试要 `MOCK_PORT=0`（随机端口），
   而 `upload-url` 要用真实端口拼预签名地址，因此改为 `export let PORT` + `setPort()`，`listen` 回调里回填。
2. **`ROOT` 定位**：原文件 `path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))`
   在 Windows 上能跑但依赖盘符补丁；改用 `fileURLToPath`，并新增 `MOCK_ROOT` 便于测试隔离。
3. **请求体与 `parse()` 的传递**：原文件在路由分派前读一次 body、各处共用 `parse()`。拆分后由
   `src\router.mjs` 读一次并以 `ctx.body` / `ctx.parse` 传入，语义等价（GET/DELETE 仍为 `null`）。
4. **原文件缺陷（原样保留，未修）**：`PUT /upload/:id` 的尺寸校验判据是 `media.size`，但
   `upload-url` 写入的字段名是 `file_size`，`media.size` 恒为 `undefined` → 该校验实际不生效，
   尺寸不符也会落盘。属原契约行为，冒烟用例里以「不校验」断言记录，未擅自修改。
5. **`async` 处理函数**：原路由是单个 `async` 回调内的顺序 `if`；拆分后每个域模块导出
   `async handleXxx(ctx)`，未命中返回 `false`，命中即写响应（`res.headersSent` 亦可判定）。
