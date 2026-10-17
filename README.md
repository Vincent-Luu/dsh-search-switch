# dsh-search-switch

在 DeepSeek Harness（dsh）的**会话输入框工具栏**切换 `web_search` 的后端：

- **搜索来源**：`原生`（DSH 内置 DeepSeek 搜索，provider id `deepseek-official`）｜`Tavily`
- **搜索强度**：`基础`（Tavily `basic`，1 积分/次）｜`高级`（Tavily `advanced`，2 积分/次）

切换即时生效、无需刷新页面或重启；选择写入 profile 的 `cordis.patch.yml`，重启后保留。`web_search` 的 schema、`web_fetch` 行为、以及模型看到的结果结构都不变。

> English TL;DR — A dsh bundle that flips `web_search` between the DSH native DeepSeek provider and Tavily, plus a Tavily search-depth switch (basic/advanced), from the session composer bar. The choice is global and persisted in the active profile's `cordis.patch.yml`.

## 功能

- 两组胶囊控件挂在 `conversation.input.left`（权限 / Plan 标签之后、模型选择之前），只在本插件被宿主服务时出现。
- 来源与强度是插件的 `.volatile()` 配置：写入即生效，下一次 `web_search` 就使用新值。
- 原生激活时强度组自动隐藏——原生后端没有对应参数；切回 Tavily 后沿用上次强度。
- 「设置 → 插件 → dsh-search-switch」页可填写 Tavily API Key（写入凭据库 `TAVILY_API_KEY`，不写入设置文件），并显示当前来源 / 强度。
- Tavily 未配置密钥时，Tavily 段旁显示 `!` 提示；搜索会失败并明确指路。
- Tavily 由本插件自己实现（私有实例，不注册进 `ctx.web`），不会与社区 `tavily` provider 发生 id 冲突。

## 安装

从 GitHub 安装（公开仓库，推荐；pnpm 会把 commit 固定下来）：

```sh
dsh plugin --profile desktop add github:<your-github-user>/dsh-search-switch
```

把 `<your-github-user>` 换成仓库实际的 owner（即 GitHub 用户名）。

本包没有构建步骤（`lib/` 直接入库），所以不需要在 profile 的 `pnpm-workspace.yaml` 里配 `allowBuilds`。

本地目录（开发，推荐 `link:`，改代码后无需重装）：

```sh
dsh plugin --profile desktop add link:<repo-path>
```

拷贝式安装（`file:` 会在 profile 里放一份副本，改完代码需要重新 `add` 才会更新）：

```sh
dsh plugin --profile desktop add file:<repo-path>
```

`<repo-path>` 指仓库在本机的目录，例如 `D:\dev\dsh-search-switch`。

发布到 npm 后：

```sh
dsh plugin --profile desktop add dsh-search-switch
```

安装会修改 profile 的依赖与 `dsh.profile.bundles`，因此**需要重启 dsh**（桌面版重启应用；Web 版重启 `dsh web`）才能加载本 bundle。

`file:` 依赖在 profile 里可能是拷贝而非符号链接：改完代码后重新执行一次 `add`，或改用 `link:`，否则运行的是旧文件。

## 使用

1. 打开任意会话，输入框工具栏出现 `原生 | Tavily` 与 `基础 | 高级`。
2. 点 `Tavily`：立即切到 Tavily；点 `高级`：下一次搜索使用 `search_depth: "advanced"`（2 积分/次）。
3. 首次使用 Tavily 需要密钥：**设置 → 插件 → dsh-search-switch** 填入，或让 dsh 进程环境里有 `TAVILY_API_KEY`。
4. 点 `原生`：恢复 DSH 内置搜索，强度组自动隐藏。

## 配置

所有 `tavily*` 与 `active` 字段都是 volatile，可在运行中通过设置写入。普通字段（如 `nativeProviderId`）只能通过 profile 的 `cordis.patch.yml` 修改。

| 键 | 默认值 | 说明 |
|---|---|---|
| `active` | `deepseek` | 搜索来源：`deepseek` 或 `tavily` |
| `nativeProviderId` | `deepseek-official` | 原生来源在 web seam 中注册的 provider id |
| `tavilyApiKeyEnv` | `TAVILY_API_KEY` | 凭据库引用名；设置页把密钥写到这里 |
| `tavilyBaseURL` | `https://api.tavily.com` | 端点基址，`/search` 自动追加 |
| `tavilySearchDepth` | `basic` | Tavily 官方 4 档：`basic` / `advanced` / `fast` / `ultra-fast`；界面只暴露前两档 |
| `tavilyTopic` | `general` | `general` / `news` / `finance` |
| `tavilyAnswer` | `off` | `off` / `basic` / `advanced` → 映射为 `include_answer`，非空答案进入结果的 `content` |
| `tavilyChunksPerSource` | `3` | 1–3；`basic`/`advanced`/`fast` 下生效，控制每来源片段数 |
| `tavilyIncludePublishedDate` | `true` | 让 Tavily 返回 `published_date`（官方 beta 字段），映射为 `publishedAt` |
| `tavilyMaxResults` | 未设 | 0–20；请求未带 `maxResults` 时使用，seam 仍会再截断 |

覆盖示例（`~/.dsh/profiles/<profile>/cordis.patch.yml`）：

```yaml
- id: search-switch
  config:
    tavilyTopic: news
    tavilyChunksPerSource: 2
```

patch 会整段替换该行的 `config`，请把要保留的键一并写回。

## 工作原理

1. 宿主 base 层把 `web` 行的 `searchProvider` 固定为 `deepseek-official`。本插件挂载后在 `apply` 中把 `ctx.web.searchProviderId` 指向自己注册的调度 provider `search-switch`，并在 fiber 销毁时恢复原值。
2. 调度 provider 每次搜索读取 `active`：
   - `tavily` → 本插件的 Tavily 实现（`POST {baseURL}/search`，Bearer 鉴权，字段见官方文档）；
   - `deepseek` → 从 `ctx.web.searchProviders` 取出 base 层注册的 `deepseek-official` 实例直接调用，完全复用宿主的鉴权（DeepSeek Account token / `DEEPSEEK_API_KEY`）与端点逻辑。
3. 刻意**不**在 `cordis.patch.yml` 里静态 pin `web` 行：那样一旦本插件被禁用，`web` 会指向未注册的 id，所有搜索都会报 `WEB_PROVIDER_CONFIGURED_MISSING`。运行期 pin 让禁用/卸载自动回退到宿主配置。

## 失败与边界

| 场景 | 行为 |
|---|---|
| 未配置 Tavily 密钥 | 搜索抛 `WEB_PROVIDER_CREDENTIAL_MISSING`，消息给出设置页位置与 `TAVILY_API_KEY` 备选；来源切回原生即恢复 |
| Tavily 非 2xx | `WEB_PROVIDER_ERROR`，消息含 HTTP 状态与 `detail.error` / 422 的 `detail[]`（429 附 `Retry-After`）并保留 `cause` |
| Tavily 超时 / 取消 | 跟随 `AbortSignal`，抛 `WEB_ABORTED` |
| 原生 provider 未挂载 | 抛 `WEB_PROVIDER_CONFIGURED_MISSING`，消息列出期望 id 与当前已注册 id |
| 配置里出现未知 `active` | 抛 `WEB_PROVIDER_UNAVAILABLE`，不会静默挑一个后端 |
| 设置只读（远程/非回环页面、上层覆盖） | 两组控件与保存按钮禁用并说明原因 |
| 并发写冲突（多窗口） | `set()` 返回 `false`，宿主镜像重载旧值，界面显示「切换失败」 |
| 宿主不再暴露可写的 `web.searchProviderId` | 打印警告，来源开关不生效；可在 `web` 行静态 pin `searchProvider: search-switch` 作为替代 |
| 插件被禁用 / 卸载 | UI 消失，pin 恢复为宿主值，搜索继续可用；profile patch 里残留的 `search-switch` 覆盖行无害，可手动删除 |

## 卸载

```sh
dsh plugin --profile desktop remove dsh-search-switch
```

然后重启，并按需清理 profile patch 里的 `active` / `tavily*` 覆盖行。

## 开发

```
lib/index.js           host 入口：Config、调度装配、运行期 pin / 恢复
lib/dispatch.js        来源调度器（纯函数，依赖注入）
lib/tavily-provider.js Tavily provider（注入 fetch / WebError）
lib/tavily-mapping.js  请求体与响应映射（零依赖）
lib/client.js          浏览器 bundle（__ModuleLoader__ 包装，仅依赖 react）
scripts/               宿主烟测：把 @deepseek-ai/* 解析到安装内的真实包
test/                  node --test 用例（零外部依赖）
```

```sh
node --check lib/index.js
node --test --test-isolation=none test/tavily-mapping.test.mjs test/tavily-provider.test.mjs test/dispatch.test.mjs test/client-bundle.test.mjs
```

宿主烟测（用安装里的真实 schemastery / cordis / dsh-web 校验 Config、pin、原生委托与 Tavily 请求；不启动服务）：

```powershell
$env:ELECTRON_RUN_AS_NODE = "1"
& "<DeepSeek Harness 安装目录>\DeepSeek Harness.exe" scripts/host-smoke.mjs
```

`scripts/asar-hooks.mjs` 默认从 `process.execPath` 推导安装内的 `app.asar`，因此用应用自带的 Electron 运行即可；若用其它方式加载，可用 `DSH_ASAR_ROOT` 显式指定 `<安装目录>\resources\app.asar\dsh\node_modules`。

组合验证（不启动服务）：

```sh
dsh plugin --profile switcher-check add file:<repo-path>
dsh --profile switcher-check --dump-config
```

client 改动后刷新页面即可；host 改动、bundle 列表或 manifest 改动需要重启。

## 已知限制

- **全局语义**：`ctx.web.search()` 没有会话上下文参数，来源与强度对当前 profile 的所有会话生效。
- **两处非公开依赖**：运行期 pin 依赖 `ctx.web.searchProviderId` 可写，原生委托依赖 `ctx.web.searchProviders`（Map）。二者在 dsh 0.2.0-rc.2 上可用；升级 dsh 后若失效，插件会告警而不是静默失效，替代方案是静态 pin `web.searchProvider`。
- **强度只暴露两档**：`fast` / `ultra-fast` 已进 schema（可手改 patch），但界面只显示 `基础和高级`，未知档位显示为 Basic。
- **Tavily 契约**：字段与枚举按官方 [Tavily Search API 参考](https://docs.tavily.com/documentation/api-reference/endpoint/search)（OpenAPI 1.0.0，2026-08 查阅）实现；`include_published_date` 仍为官方 beta 字段。
- **凭据**：密钥存于 dsh 凭据库；`dsh-search-switch` 不写任何自有存储，选择由宿主写入 profile patch。
