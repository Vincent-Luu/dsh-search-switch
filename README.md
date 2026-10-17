# dsh-search-switch

在 DeepSeek Harness（dsh）的**会话输入框工具栏**同时切换两条 web 能力路由：

- **网页搜索**（`web_search`）：`原生`（DSH 内置 DeepSeek 搜索，provider id `deepseek-official`）｜`原生 API`（DeepSeek 官方 Search API，`deepseek-search-api`）｜`Tavily`｜`Jina`｜`Firecrawl`
- **网页抓取**（`web_fetch`，`url → markdown`）：`Jina Reader`（默认，免 key）｜`本地`（DSH 内置 http 抓取）｜`原生 API`（DeepSeek 官方 Fetch API，`deepseek-fetch-api`）｜`Firecrawl`

搜索侧 Tavily 仍保留官方 4 档强度（`基础`/`高级`/`快速`/`极速`），现在它们收在「网页搜索」的弹层里，不再单独占位。Tavily 只做搜索，不提供抓取。

切换即时生效、无需刷新页面或重启；选择写入 profile 的 `cordis.patch.yml`，重启后保留。`web_search` / `web_fetch` 的 schema、渲染、以及模型看到的结果结构都不变。

> English TL;DR — A dsh bundle that routes both web capabilities from the session composer bar: `web_search` across the DSH native provider, the official DeepSeek Search API, Tavily, Jina and Firecrawl, and `web_fetch` (URL→markdown) across Jina Reader, the local DSH HTTP fetcher, the official DeepSeek Fetch API and Firecrawl. Jina Reader is the default fetch route and works without a key; non-local fetch failures can fall back to the local fetcher. Choices are global and persisted in the active profile's `cordis.patch.yml`.

## 功能

- 两个胶囊控件挂在 `conversation.input.left`（权限 / Plan 标签之后、模型选择之前）：`网页搜索 · <当前提供商> ▾`、`网页抓取 · <当前提供商> ▾`，只在本插件被宿主服务时出现。
- 两个大类的弹层各自列出提供商、说明和该提供商专属选项；`↑`/`↓` 移动、`Enter` 选中、`Esc` 关闭，弹层会随可用空间上翻/夹取，超高时内部滚动。
- 两条轴都是插件的 `.volatile()` 配置：写入即生效，下一次 `web_search` / `web_fetch` 就使用新值。
- **搜索弹层**：5 个提供商（原生 / 原生 API / Tavily / Jina / Firecrawl）；选中 Tavily 时下方追加 4 档强度；Jina 行标注「搜索需要 API key」。
- **抓取弹层**：4 个提供商（Jina Reader / 本地 / 原生 API / Firecrawl）；选中 Jina 时追加 `Jina key 模式`（匿名 / 自动 / API Key）与 `Jina 内容模式`（精简 / 完整结构）；另有「抓取失败自动回落本地」开关。
- **默认套路**：`web_fetch → r.jina.ai` 匿名模式，日常读取不花 key、不需要额度；碰到内网/被反爬/限流的页面自动回落 DSH 本地抓取。
- 缺 key 时对应胶囊显示琥珀色圆点（Tavily 搜索 / Jina 搜索 / Jina Reader 的 `api` 模式）；Firecrawl 与匿名 Reader 不报警。
- 「设置 → 插件 → dsh-search-switch」页可分别填写 Tavily / Jina / Firecrawl 的 API Key（写入凭据库，不写入设置文件），可填 Jina 抓取选择器（CSS），并显示当前搜索与抓取提供商。
- Jina 与 Firecrawl 都是本插件自己的私有实现（不注册进 `ctx.web`），不会与社区同名 provider 发生 `WEB_DUPLICATE_PROVIDER` 冲突。

## 安装

从 GitHub 安装（公开仓库，推荐；pnpm 会把 commit 固定下来）：

```sh
dsh plugin --profile desktop add github:Vincent-Luu/dsh-search-switch
```

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

安装会修改 profile 的依赖与 `dsh.profile.bundles`，因此**需要重启 dsh**（桌面版重启应用；Web 版重启 `dsh web`）才能加载本 bundle。**替换已安装的包也必须重启**，否则浏览器仍会跑旧一代 JS。

### 兼容性

插件在 manifest 里声明 `engines.dsh: ">=0.2.0-rc.2 <0.3.0-0"`：DSH 主机的兼容性检查只认这个字段（有它就不再逐个比对 `@deepseek-ai/dsh-*` peer 版本），所以 0.2.0-rc.2、0.2.1-rc.1、0.2.1-rc.2 以及后续 0.2.x 都能加载，不会出现"要求 0.2.0-rc.2 → 与当前版本不兼容"的提示。

`@deepseek-ai/dsh-*` peer 仍保留为文档性约束（标记为 optional，因为它们由宿主运行时提供，不由 profile 安装）。升级到 DSH 0.3 时需要重新适配并放宽这个区间。

**0.2.1-rc.2 的 seam 变化已适配**：宿主把 web 选择从可写属性 `searchProviderId` / `fetchProviderId` 改成 volatile 配置引用（`web.config.searchProvider.get()`），并新增了官方 `deepseek-search-api` / `deepseek-fetch-api`。本插件（0.3.0 起）优先按新协议原地写入，旧版宿主回退属性赋值；两个官方 API 也可在弹层里直接选。

## 使用

1. 打开任意会话，输入框工具栏出现 `网页搜索 · 原生 ▾` 与 `网页抓取 · Jina Reader ▾`。
2. 点「网页搜索」：弹层里选 原生 / 原生 API / Tavily / Jina / Firecrawl；选 Tavily 后同一弹层追加 `基础`、`高级`、`快速`、`极速`（`advanced` 2 积分/次，其余 1 积分/次）。
3. 点「网页抓取」：弹层里选 Jina Reader / 本地 / 原生 API / Firecrawl；Jina 下可切 `匿名`、`自动`（有 key 就用）、`API Key`（始终用 key，500 RPM、按 token 计费）。
4. 「原生」= DSH 的 LLM 辅助搜索（`deepseek-official`，搜索结果经模型整理）；「原生 API」= DeepSeek 官方 Search / Fetch API（`deepseek-search-api` / `deepseek-fetch-api`，`api.deepseek.com/v1/tools`），两者都复用 `DEEPSEEK_API_KEY`，在模型页配置。
5. 需要 key 时到 **设置 → 插件 → dsh-search-switch** 填，或让 dsh 进程环境里有对应的 `TAVILY_API_KEY` / `JINA_API_KEY` / `FIRECRAWL_API_KEY`。
6. 关掉「抓取失败自动回落本地」后，第三方抓取的失败会直接冒泡给模型，不再改用本地抓取。

### 各家的 key 必需性

| 提供商 | 能力 | 免 key | 配 key 后 |
|---|---|---|---|
| 原生 DeepSeek（`deepseek-official`） | 搜索 | DSH 账号/密钥已有 | — |
| 原生 API（`deepseek-search-api` / `deepseek-fetch-api`） | 搜索 + 抓取 | 不可用 | 走官方 tools API，复用 `DEEPSEEK_API_KEY` |
| Tavily | 搜索 | 不可用 | 官方积分计费 |
| Jina Reader | 抓取 | ✅ 20 RPM | 500 RPM，按 token 计费 |
| Jina Search | 搜索 | 不可用（401） | 100 RPM |
| 本地 http（DSH） | 抓取 | ✅ 无需 key，仅公网地址 | — |
| Firecrawl | 抓取 + 搜索 | ✅ 匿名池可用（额度小） | 更高额度，积分计费 |

## 配置

用户面向的字段都是 volatile，可在运行中通过设置页写入；`nativeProviderId` / `localFetchProviderId` 这类结构字段只能通过 profile 的 `cordis.patch.yml` 修改。

### 搜索轴

| 键 | 默认值 | 说明 |
|---|---|---|
| `active` | `deepseek` | 搜索来源：`deepseek` / `deepseek-api` / `tavily` / `jina` / `firecrawl` |
| `nativeProviderId` | `deepseek-official` | 原生来源在 web seam 中注册的 provider id |
| `searchApiProviderId` | `deepseek-search-api` | 官方 Search API 的 provider id（`web-deepseek-api` 行注册） |
| `tavilyApiKeyEnv` | `TAVILY_API_KEY` | 凭据库引用名 |
| `tavilyBaseURL` | `https://api.tavily.com` | 端点基址，`/search` 自动追加 |
| `tavilySearchDepth` | `basic` | `basic` / `advanced` / `fast` / `ultra-fast` |
| `tavilyTopic` | `general` | `general` / `news` / `finance` |
| `tavilyAnswer` | `off` | `off` / `basic` / `advanced` → `include_answer`；非空答案进入结果 `content` |
| `tavilyChunksPerSource` | `3` | 1–3；`ultra-fast` 下不发送 |
| `tavilyIncludePublishedDate` | `true` | 返回 `published_date`（官方 beta），映射为 `publishedAt` |
| `tavilyMaxResults` | 未设 | 0–20；仅当调用方未带 `maxResults` 时使用 |

### 抓取轴

| 键 | 默认值 | 说明 |
|---|---|---|
| `fetchSource` | `jina` | 抓取来源：`jina` / `local` / `deepseek-api` / `firecrawl` |
| `fetchFallbackToLocal` | `true` | 非本地抓取失败（除取消外）是否自动改用本地抓取 |
| `localFetchProviderId` | `http` | 本地抓取在 seam 中的 provider id |
| `fetchApiProviderId` | `deepseek-fetch-api` | 官方 Fetch API 的 provider id（`web-deepseek-api` 行注册） |

### Jina AI

| 键 | 默认值 | 说明 |
|---|---|---|
| `jinaApiKeyEnv` | `JINA_API_KEY` | 凭据库引用名 |
| `jinaReaderURL` | `https://r.jina.ai` | Reader 端点（POST 表单，保留 `#` 片段） |
| `jinaSearchURL` | `https://s.jina.ai` | Search 端点（`/`+编码后的查询） |
| `jinaReaderKeyMode` | `anonymous` | `anonymous` / `auto` / `api` |
| `jinaEngine` | `auto` | `auto` / `browser` / `curl`；`auto` 不发 `x-engine` |
| `jinaTimeoutSeconds` | `20` | `x-timeout`，1–180 |
| `jinaRetainImages` | `none` | `all` / `none` / `alt` |
| `jinaRetainLinks` | `all` | `all` / `none` / `text` |
| `jinaLinksSummary` | `false` | 追加 `Buttons & Links` 汇总段 |
| `jinaBypassCache` | `false` | `x-no-cache` |
| `jinaRespondWith` | `default` | `default`（readability，省 token） / `markdown`（绕过 readability，保留完整标题结构）；抓取弹层的「Jina 内容模式」即为该项 |
| `jinaTargetSelector` | 空 | `x-target-selector`，如 `article`、`main`、`#mw-content-text`；在设置页输入，配合 `markdown` 模式可裁掉导航 |
| `jinaSite` | 空 | 搜索站内过滤，逗号分隔多个 hostname |

> **Wikipedia 这类长条目**：默认 readability 会把 `##` 小节标题剥掉（正文完整但结构变平）。要保留结构：抓取弹层把「Jina 内容模式」切到 `完整结构`，设置页填选择器（Wikipedia 用 `#mw-content-text`），并把 `fetchMaxChars` 提到 `200000`（12 万字符级的条目否则会被截断；该项仍是纯配置，写在 profile patch 里）。用 Firecrawl 抓取则天然带结构（`onlyMainContent`），不必调这些开关。

### Firecrawl

| 键 | 默认值 | 说明 |
|---|---|---|
| `firecrawlApiKeyEnv` | `FIRECRAWL_API_KEY` | 凭据库引用名 |
| `firecrawlBaseURL` | `https://api.firecrawl.dev` | 仅使用 `/v2/*` 路径 |
| `firecrawlProxy` | `auto` | `auto` / `basic` / `enhanced` |
| `firecrawlOnlyMainContent` | `true` | 只取主内容 |
| `firecrawlTimeoutMs` | `20000` | 1 000–25 000（低于工具 30s 预算） |
| `firecrawlMaxAgeMs` | `172800000` | 缓存容忍（2 天） |
| `firecrawlWaitFor` | `0` | 0–20 000 ms |
| `firecrawlBlockAds` | `true` | 广告/同意弹窗拦截 |
| `firecrawlSearchScrape` | `false` | 搜索时附带每条的完整 markdown（更慢更贵） |

### 共享边界

| 键 | 默认值 | 说明 |
|---|---|---|
| `fetchMaxChars` | `100000` | Jina / Firecrawl 抓取正文上限，超出置 `truncated` |
| `snippetMaxChars` | `800` | Jina / Firecrawl 搜索片段裁剪（`0` 不裁剪） |

覆盖示例（`~/.dsh/profiles/<profile>/cordis.patch.yml`）：

```yaml
- id: search-switch
  config:
    active: tavily
    tavilyTopic: news
    fetchSource: firecrawl
    firecrawlProxy: enhanced
```

patch 会整段替换该行的 `config`，请把要保留的键一并写回。

## 工作原理

1. 宿主 base 层把 `web` 行的 `searchProvider` 固定为 `deepseek-official`、`fetchProvider` 固定为 `http`。0.2.1-rc.2 起这两个选择是 **volatile 配置引用**（`ctx.web.config.searchProvider`），更早的版本是可写的普通属性（`ctx.web.searchProviderId`）。本插件挂载后按宿主能力把两条选择都指向自己注册的调度 provider `search-switch`：有配置引用就按宿主协议原地写入（`Symbol.for('cosmokit.volatile.write')`），否则退回属性赋值；fiber 销毁时恢复原值（原值是本插件自己的 id 时恢复成宿主默认 id，避免重启后悬空）。
2. 搜索调度器每次读取 `active`：
   - `tavily` → `POST {baseURL}/search`（Bearer 鉴权）；
   - `jina` → `GET {jinaSearchURL}/<编码后的查询>`（必须带 key，可带 `?site=` 过滤）；
   - `firecrawl` → `POST {firecrawlBaseURL}/v2/search`（key 可选）；
   - `deepseek` → 直接调用 base 层注册的 `deepseek-official` 实例，完全复用宿主鉴权与端点逻辑；
   - `deepseek-api` → 直接调用 `web-deepseek-api` 注册的 `deepseek-search-api` 实例（官方 tools API，复用 `DEEPSEEK_API_KEY`）。
3. 抓取调度器每次读取 `fetchSource`：
   - `jina` → `POST {jinaReaderURL}/`，表单 `url=<目标>`（保留 `#` 片段），`Accept: application/json` 取 `data.content`；可选 `x-respond-with` / `x-target-selector` 保住标题结构或裁掉导航；
   - `firecrawl` → `POST {firecrawlBaseURL}/v2/scrape`，`formats: ["markdown"]` 取 `data.markdown`；
   - `deepseek-api` → 直接调用 `web-deepseek-api` 注册的 `deepseek-fetch-api` 实例；
   - `local` → 直接调用 base 层注册的 `http` 实例（URL 安全校验、公网地址限制都由宿主负责）。
   非 `local` 来源失败（取消除外）且 `fetchFallbackToLocal` 为真时，自动再用本地抓取一次；两次都失败时抛出第一次的错误码，消息里注明回落也失败。
4. 抓取结果统一返回 `{ url, statusCode, body: { kind: 'text', content }, truncated }`：Jina/Firecrawl/官方 Fetch API 输出的 markdown 作为 `text` 正文原样交给 `web_fetch`，不再经过 HTML→markdown 转换。
5. 刻意**不**在 `cordis.patch.yml` 里静态 pin `web` 行：那样一旦本插件被禁用，`web` 会指向未注册的 id，所有调用都会报 `WEB_PROVIDER_CONFIGURED_MISSING`。运行期 pin 让禁用/卸载自动回退到宿主配置。
6. 「设置 → 网页搜索」里宿主的官方开关仍会改写同一个 `searchProvider` / `fetchProvider` 字段；改它等于绕过本插件的两个胶囊，之后再次切回本插件即可。

## 失败与边界

| 场景 | 行为 |
|---|---|
| 未配置 Tavily key | `WEB_PROVIDER_CREDENTIAL_MISSING`，消息给出设置页位置与 `TAVILY_API_KEY` 备选 |
| 未配置 Jina key 且搜索选 Jina | `WEB_PROVIDER_CREDENTIAL_MISSING`（Jina 搜索无匿名额度），提示换源或配 key |
| `jinaReaderKeyMode: api` 但无 key | 抓取前即失败，消息指向设置页 / `JINA_API_KEY` |
| Jina Reader 403（内网、localhost、被拒） | `WEB_PROVIDER_ERROR`，消息含 `LocalhostAccessError` 等名称；抓取轴自动回落本地 |
| Jina 429 | `WEB_PROVIDER_ERROR`，附 `Retry-After` 与「配 key 提升到 500 RPM」建议 |
| Tavily 非 2xx | `WEB_PROVIDER_ERROR`，含状态、`detail.error` / 422 `detail[]`（429 附 `Retry-After`） |
| Firecrawl 402 / 429 / 401 | 分别提示充值、限流、key 无效；`success:false` 的 200 也按失败处理 |
| Firecrawl 返回空 markdown | 视为失败并回落本地 |
| 官方 API 未挂载（`web-deepseek-api` 行被禁用） | `WEB_PROVIDER_CONFIGURED_MISSING`，消息点名 `deepseek-search-api` / `deepseek-fetch-api` 与 `web-deepseek-api` |
| 官方 API 缺 `DEEPSEEK_API_KEY` | 由宿主 provider 抛出 `WEB_PROVIDER_CREDENTIAL_MISSING`，指路模型页 |
| 抓取正文超 `fetchMaxChars` | 截断并置 `truncated`，工具自动追加截断页脚 |
| 回落也失败 | 抛出首个错误（保留其 code），消息附「本地回落也失败」并链接 `cause` |
| 调用被取消 | 抛 `WEB_ABORTED`，**不**回落、不重试 |
| 原生 provider 未挂载 | `WEB_PROVIDER_CONFIGURED_MISSING`，消息列出期望 id 与已注册 id |
| 配置里出现未知来源 | `WEB_PROVIDER_UNAVAILABLE`，不会静默挑一个后端 |
| 设置只读（远程/非回环页面、上层覆盖） | 两个胶囊与保存按钮禁用并说明原因 |
| 并发写冲突（多窗口） | `set()` 返回 `false`，界面显示「切换失败」 |
| 宿主不暴露可写选择（既无 `web.config.*` 也无旧属性） | 打印警告，对应开关不生效；可在 `web` 行静态 pin `searchProvider/fetchProvider: search-switch` 作为替代 |
| 插件被禁用 / 卸载 | UI 消失，两个 pin 恢复为宿主值，工具继续可用 |

## 卸载

```sh
dsh plugin --profile desktop remove dsh-search-switch
```

然后重启，并按需清理 profile patch 里的 `active` / `fetchSource` / `tavily*` / `jina*` / `firecrawl*` 覆盖行。

## 开发

```
lib/index.js               host 入口：Config、两条调度装配、双 pin / 恢复
lib/dispatch.js            搜索与抓取调度器（纯函数，依赖注入）
lib/credentials.js         凭据引用与 key 解析
lib/transport.js           取消、JSON 读取、重试头、边界夹取
lib/tavily-provider.js     Tavily provider（搜索）
lib/tavily-mapping.js      Tavily 请求体与响应映射（零依赖）
lib/jina-provider.js       Jina provider（Reader 抓取 + Search）
lib/jina-mapping.js        Jina 请求与响应映射（零依赖）
lib/firecrawl-provider.js  Firecrawl provider（scrape + search）
lib/firecrawl-mapping.js   Firecrawl 请求与响应映射（零依赖）
lib/client.js              浏览器 bundle（__ModuleLoader__ 包装，仅依赖 react）
scripts/                   宿主烟测：把 @deepseek-ai/* 解析到安装内的真实包
test/                      node --test 用例（零外部依赖）
```

```sh
npm run check
npm test
```

（测试必须带 `--test-isolation=none`，脚本里已经写好。）

宿主烟测（用安装里的真实 schemastery / cordis / dsh-web 校验 Config、两条 pin、原生 / 官方 API / 本地委托、Tavily 与 Jina 请求、本地回落；不启动服务）：

```powershell
$env:ELECTRON_RUN_AS_NODE = "1"
& "<DeepSeek Harness 安装目录>\DeepSeek Harness.exe" scripts/host-smoke.mjs
```

烟测会真的 `new Context()` + `root.plugin(WebRuntime, …)` 启动宿主 0.2.1-rc.2 的 web 服务，验证 volatile 配置 pin、路由与恢复；再用一个"旧版形状"的假宿主验证属性 pin 仍然可用。默认还会跑两条**真实**网络探针（Jina Reader 匿名、Firecrawl 免 key 抓取）；设置 `SKIP_NETWORK=1` 可跳过。`scripts/asar-hooks.mjs` 默认从 `process.execPath` 推导安装内的 `app.asar`；若用其它方式加载，可用 `DSH_ASAR_ROOT` 显式指定 `<安装目录>\resources\app.asar\dsh\node_modules`。

client 改动后刷新页面即可；host 改动、bundle 列表或 manifest 改动需要重启。

## 已知限制

- **全局语义**：`ctx.web.search()` / `fetch()` 没有会话上下文参数，搜索源、抓取源与强度对当前 profile 的所有会话生效。
- **五层非公开依赖**：运行期 pin 依赖 `ctx.web.config.searchProvider/fetchProvider` 的 volatile 写入协议（`Symbol.for('cosmokit.volatile.write')`，0.2.1-rc.2 起）或旧版可写属性 `searchProviderId` / `fetchProviderId`；委托依赖 `ctx.web.searchProviders` / `fetchProviders`（Map）；抓取结果形状依赖 `WebFetchResult` 的 `{ url, statusCode, body, truncated }`。这些在 dsh 0.2.0-rc.2 ～ 0.2.1-rc.2 上可用；升级 dsh 后若失效，插件会告警而不是静默失效。
- **官方设置页与插件会争同一个字段**：宿主「设置 → 网页搜索」也写 `web.config.searchProvider`，一旦在那边切换，就等于绕过本插件；两个胶囊的切换会把字段改回 `search-switch`。
- **官方 API 的 key 不在本插件设置页**：`deepseek-search-api` / `deepseek-fetch-api` 复用宿主 `DEEPSEEK_API_KEY`（模型页管理），本插件只负责路由。
- **只做单页读取**：本插件只实现 `web_fetch`（单 URL → markdown）。Firecrawl 的 crawl / batch scrape / map / extract 不在范围内；需要批量或结构化时应在 DSH 里另加工具，而不是给 `web_fetch` 加参数（`web_fetch` 只接受 `url`）。
- **工具层还有自己的上限**：`web_search` 的来源数由宿主 `tool-web` 的 `searchMaxResults`（默认 8）截断，`web_fetch` 的工具预算 `fetchTimeoutMs` 默认 30 s；Firecrawl 抓慢站会被这个预算打断，所以插件把单请求超时压在 25 s 内。需要更长预算时改 profile 里 `preset-standard` 的 `tool-web` 配置（需整段重述 `config.plugins`，且只对新会话生效）。
- **Jina/Firecrawl 的抓取失败会回落**：这是默认行为；若你要确定知道"这次到底走的哪家"，关掉「抓取失败自动回落本地」。错误的 `cause` 链里保留回落失败原因。
- **弹层定位**：弹层用 `position: fixed` 自行定位（客户端模块表没有 `react-dom`，无法用 portal）。空间不足时自动向上翻转、水平/垂直夹取在视口内，超高时弹层内部滚动。若未来宿主给输入框加了 `transform`/`filter` 祖先，`fixed` 定位可能被该祖先的包含块影响。
- **外部契约时效**：Tavily 按官方 [Search API 参考](https://docs.tavily.com/documentation/api-reference/endpoint/search)（OpenAPI 1.0.0，2026-08）、Jina 按 [jina.ai/reader](https://jina.ai/reader) 与 [jina-ai/reader](https://github.com/jina-ai/reader)（2026-10）、Firecrawl 按 [v2 Scrape](https://docs.firecrawl.dev/api-reference/endpoint/scrape) / [v2 Search](https://docs.firecrawl.dev/api-reference/endpoint/search)（2026-10）实现。Firecrawl 的匿名可用性与额度是官方行为，随账号/IP 变化，插件不做额度探测。
- **凭据**：密钥存于 dsh 凭据库（`~/.dsh/.credentials.yaml`，当前为明文存储）；`dsh-search-switch` 不写任何自有存储，选择由宿主写入 profile patch。
