window.__ModuleLoader__.load({
  id: 'dsh-search-switch',
  factory: (require) => {
    'use strict'

    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'search-switch.client'
    /**
     * Settings namespace = the loader row id the bundle patch declares.
     * Renaming the row in cordis.patch.yml breaks this contract.
     */
    const NAMESPACE = 'search-switch'

    /** Search backends the host config accepts. */
    const SEARCH_OPTIONS = ['deepseek', 'deepseek-api', 'tavily', 'jina', 'firecrawl']
    /** Fetch backends the host config accepts. */
    const FETCH_OPTIONS = ['jina', 'local', 'deepseek-api', 'firecrawl']
    /** The two Tavily quality tiers. */
    const DEPTH_OPTIONS = ['basic', 'advanced']
    /** The Tavily latency tiers, shown in the same search popover. */
    const EXTRA_DEPTH_OPTIONS = ['fast', 'ultra-fast']
    /** Every depth the host config accepts. */
    const ALL_DEPTH_OPTIONS = DEPTH_OPTIONS.concat(EXTRA_DEPTH_OPTIONS)
    /** Jina Reader key modes. */
    const JINA_KEY_MODES = ['anonymous', 'auto', 'api']
    /** Jina Reader content pipelines: frugal readability or full structure. */
    const JINA_RESPOND_WITH = ['default', 'markdown']

    const DEFAULT_SEARCH = 'deepseek'
    const DEFAULT_FETCH = 'jina'
    const DEFAULT_DEPTH = 'basic'
    const DEFAULT_JINA_MODE = 'anonymous'
    const DEFAULT_FALLBACK = true

    const DEFAULT_KEY_REFS = {
      tavily: 'TAVILY_API_KEY',
      jina: 'JINA_API_KEY',
      firecrawl: 'FIRECRAWL_API_KEY',
    }
    const KEY_FIELDS = {
      tavily: 'tavilyApiKeyEnv',
      jina: 'jinaApiKeyEnv',
      firecrawl: 'firecrawlApiKeyEnv',
    }
    const UNKNOWN_KEY_STATES = { tavily: 'unknown', jina: 'unknown', firecrawl: 'unknown' }

    /** English copy. */
    const en = {
      'label.search': 'Web search',
      'label.fetch': 'Web fetch',
      'menu.search': 'Search provider',
      'menu.fetch': 'Fetch provider',
      'row.searchSource': 'Search provider',
      'row.searchDepth': 'Search depth',
      'row.fetchSource': 'Fetch provider',
      'row.fetchMode': 'Key mode',
      'row.fetchRespond': 'Content mode',
      'row.fetchFallback': 'Fallback to local',
      'drawer.back': 'Back',
      'source.deepseek': 'Native',
      'source.deepseek-api': 'Native API',
      'source.tavily': 'Tavily',
      'source.jina': 'Jina',
      'source.firecrawl': 'Firecrawl',
      'source.local': 'Local',
      'tip.search.deepseek': 'DeepSeek account or key, no Tavily credits',
      'tip.search.deepseek-api': 'DeepSeek official Search API; needs DEEPSEEK_API_KEY',
      'tip.search.tavily': 'Tavily search; spends Tavily credits per call',
      'tip.search.jina': 'Needs JINA_API_KEY; anonymous calls are rejected',
      'tip.search.firecrawl': 'Works anonymously; a key raises the quota',
      'tip.fetch.jina': 'Keyless URL→markdown Reader, the default route',
      'tip.fetch.local': 'DSH built-in fetcher; no third party',
      'tip.fetch.deepseek-api': 'DeepSeek official Fetch API; needs DEEPSEEK_API_KEY',
      'tip.fetch.firecrawl': 'Rendered and anti-bot pages, works anonymously',
      'depth.basic': 'Basic',
      'depth.advanced': 'Advanced',
      'depth.fast': 'Fast',
      'depth.ultra-fast': 'Ultra fast',
      'tip.depth.basic': 'Lower latency, 1 credit per search',
      'tip.depth.advanced': 'Higher relevance and longer snippets, 2 credits per search',
      'tip.depth.fast': 'Prioritises low latency, 1 credit per search',
      'tip.depth.ultra-fast': 'Lowest latency, one summary per URL, 1 credit per search',
      'jinaMode.anonymous': 'Anonymous',
      'jinaMode.auto': 'Auto',
      'jinaMode.api': 'API key',
      'tip.jinaMode.anonymous': 'No key, 20 requests per minute',
      'tip.jinaMode.auto': 'Use JINA_API_KEY when configured, otherwise anonymous',
      'tip.jinaMode.api': 'Always send JINA_API_KEY (500 RPM, billed in tokens)',
      'respond.default': 'Compact',
      'respond.markdown': 'Full structure',
      'tip.respond.default': 'Readability pass: fewer tokens, headings may drop',
      'tip.respond.markdown': 'Keeps headings and lists, may add boilerplate',
      'tip.row.fetchFallback': 'Retry once with the local fetcher when a third party fails',
      'key.tavilyMissing': 'No Tavily API key configured',
      'key.jinaMissing': 'Jina search needs an API key',
      'key.jinaApiMissing': 'Jina API mode needs an API key',
      'key.firecrawlMissing': 'No Firecrawl key; anonymous requests share a small pool',
      'status.failed': 'Switch failed, please retry',
      'settings.summary': 'Pick the search and fetch providers and store provider API keys.',
      'settings.scope': 'Applies to every session; changes take effect immediately.',
      'settings.global': 'Global',
      'settings.on': 'On',
      'settings.off': 'Off',
      'settings.credentials': 'API credentials',
      'settings.credentialsHint': 'Keys live in the DSH credential store, never in the settings file.',
      'settings.tavilyKey': 'Tavily API key',
      'settings.jinaKey': 'Jina API key',
      'settings.firecrawlKey': 'Firecrawl API key',
      'settings.tavilyHint': 'Required for Tavily search.',
      'settings.jinaHint': 'Required for Jina search; optional for Reader.',
      'settings.firecrawlHint': 'Optional; raises the anonymous quota.',
      'settings.keyPlaceholder': 'New API key',
      'settings.keySet': 'Configured',
      'settings.keyUnset': 'Not configured',
      'settings.readonly': 'Credentials are read-only in this deployment.',
      'settings.configReadonly': 'This configuration is read-only; nothing can be saved here.',
      'settings.save': 'Save',
      'settings.saving': 'Saving…',
      'settings.saved': 'Saved',
      'settings.failed': 'Save failed: ',
      'settings.advanced': 'Advanced settings',
      'settings.advancedHint': 'Budgets, provider behavior, endpoints, and provider ids.',
      'settings.advancedReset': 'Reset advanced defaults',
      'settings.advancedResetConfirm': 'Click again to confirm',
      'settings.advancedResetHint': 'Credential variable names are kept.',
      'settings.advancedResetDone': 'Advanced defaults restored',
      'settings.advancedResetWorking': 'Restoring…',
      'settings.advancedResetFailed': 'Reset failed: ',
      'adv.budget': 'Request budget',
      'adv.budgetHint': 'Caps and timeouts for one search or fetch.',
      'adv.tavily': 'Tavily search',
      'adv.jina': 'Jina Reader',
      'adv.firecrawl': 'Firecrawl',
      'adv.endpoints': 'Endpoints and provider ids',
      'adv.endpointsHint': 'Empty values use the built-in default. Provider ids must match the host registry.',
      'adv.env': 'Credential variable names',
      'adv.envHint': 'Changing a name moves the key input row to the new variable.',
      'adv.fetchMaxChars': 'Fetch character cap',
      'adv.fetchMaxChars.hint': 'Max URL→markdown characters per fetch (1000–200000).',
      'adv.snippetMaxChars': 'Search snippet cap',
      'adv.snippetMaxChars.hint': 'Characters kept per search result (0–5000).',
      'adv.jinaTimeoutSeconds': 'Jina timeout',
      'adv.jinaTimeoutSeconds.hint': 'Seconds, 1–180.',
      'adv.firecrawlTimeoutMs': 'Firecrawl timeout',
      'adv.firecrawlTimeoutMs.hint': 'Milliseconds, 1000–25000; keep below the tool budget.',
      'adv.tavilyTopic': 'Topic',
      'adv.tavilyTopic.hint': 'General, news, or finance.',
      'adv.tavilyAnswer': 'Answer mode',
      'adv.tavilyAnswer.hint': 'Ask Tavily for a generated answer.',
      'adv.tavilyChunksPerSource': 'Chunks per source',
      'adv.tavilyChunksPerSource.hint': '1–3; used with Advanced depth.',
      'adv.tavilyIncludePublishedDate': 'Published date',
      'adv.tavilyIncludePublishedDate.hint': 'Add the published date to results.',
      'adv.jinaEngine': 'Reader engine',
      'adv.jinaEngine.hint': 'Auto, browser, or curl.',
      'adv.jinaRetainImages': 'Images',
      'adv.jinaRetainImages.hint': 'All, none, or alt text only.',
      'adv.jinaRetainLinks': 'Links',
      'adv.jinaRetainLinks.hint': 'All, none, or text only.',
      'adv.jinaLinksSummary': 'Link summary',
      'adv.jinaLinksSummary.hint': 'Ask Reader for a link summary.',
      'adv.jinaBypassCache': 'Bypass cache',
      'adv.jinaBypassCache.hint': 'Fetch a fresh copy every time.',
      'adv.jinaSite': 'Site limit',
      'adv.jinaSite.hint': 'Optional domain, e.g. example.com.',
      'adv.jinaTargetSelector': 'Content selector',
      'adv.jinaTargetSelector.hint': 'Optional CSS selector, e.g. #mw-content-text; pair with Full structure.',
      'adv.firecrawlProxy': 'Proxy mode',
      'adv.firecrawlProxy.hint': 'Auto, basic, or enhanced.',
      'adv.firecrawlOnlyMainContent': 'Main content only',
      'adv.firecrawlOnlyMainContent.hint': 'Drop navigation and boilerplate.',
      'adv.firecrawlWaitFor': 'Render wait',
      'adv.firecrawlWaitFor.hint': 'Milliseconds before scraping, 0–20000.',
      'adv.firecrawlMaxAgeMs': 'Cache max age',
      'adv.firecrawlMaxAgeMs.hint': 'Milliseconds; 0 disables cache reuse.',
      'adv.firecrawlBlockAds': 'Block ads',
      'adv.firecrawlBlockAds.hint': 'Ask Firecrawl to block ad resources.',
      'adv.firecrawlSearchScrape': 'Scrape search results',
      'adv.firecrawlSearchScrape.hint': 'Include page content in Firecrawl search.',
      'adv.tavilyBaseURL': 'Tavily endpoint',
      'adv.jinaReaderURL': 'Jina Reader endpoint',
      'adv.jinaSearchURL': 'Jina Search endpoint',
      'adv.firecrawlBaseURL': 'Firecrawl endpoint',
      'adv.nativeProviderId': 'Native search provider id',
      'adv.searchApiProviderId': 'Official search provider id',
      'adv.fetchApiProviderId': 'Official fetch provider id',
      'adv.localFetchProviderId': 'Local fetch provider id',
      'adv.tavilyApiKeyEnv': 'Tavily variable',
      'adv.jinaApiKeyEnv': 'Jina variable',
      'adv.firecrawlApiKeyEnv': 'Firecrawl variable',
      'adv.error.number': 'Enter a whole number in range',
      'adv.error.url': 'Enter an http(s) URL',
      'adv.error.id': 'Provider id must be non-empty and contain no spaces',
      'adv.error.env': 'Use a valid variable name',
      'adv.error.domain': 'Enter a domain like example.com',
      'adv.error.select': 'Pick a valid option',
      'unit.chars': 'chars',
      'unit.seconds': 's',
      'unit.ms': 'ms',
      'opt.general': 'General',
      'opt.news': 'News',
      'opt.finance': 'Finance',
      'opt.answer.off': 'Off',
      'opt.answer.basic': 'Basic',
      'opt.answer.advanced': 'Advanced',
      'opt.auto': 'Auto',
      'opt.browser': 'Browser',
      'opt.curl': 'curl',
      'opt.images.all': 'All',
      'opt.images.none': 'None',
      'opt.images.alt': 'Alt only',
      'opt.links.all': 'All',
      'opt.links.none': 'None',
      'opt.links.text': 'Text only',
      'opt.proxy.auto': 'Auto',
      'opt.proxy.basic': 'Basic',
      'opt.proxy.enhanced': 'Enhanced',
    }

    /** Simplified Chinese copy. */
    const zh = {
      'label.search': '网页搜索',
      'label.fetch': '网页抓取',
      'menu.search': '搜索提供商',
      'menu.fetch': '抓取提供商',
      'row.searchSource': '搜索提供商',
      'row.searchDepth': '搜索强度',
      'row.fetchSource': '抓取提供商',
      'row.fetchMode': 'Key 模式',
      'row.fetchRespond': '内容模式',
      'row.fetchFallback': '失败自动回落',
      'drawer.back': '返回',
      'source.deepseek': '原生',
      'source.deepseek-api': '原生 API',
      'source.tavily': 'Tavily',
      'source.jina': 'Jina',
      'source.firecrawl': 'Firecrawl',
      'source.local': '本地',
      'tip.search.deepseek': '用 DeepSeek 账号或密钥，不产生 Tavily 费用',
      'tip.search.deepseek-api': 'DeepSeek 官方搜索接口，需要 DEEPSEEK_API_KEY',
      'tip.search.tavily': 'Tavily 搜索，按次消耗 Tavily 积分',
      'tip.search.jina': '需要 JINA_API_KEY，匿名请求会被拒绝',
      'tip.search.firecrawl': '可匿名使用，配 Key 提升额度',
      'tip.fetch.jina': '免 Key 的 URL→Markdown 服务，默认抓取',
      'tip.fetch.local': 'DSH 内置抓取，不经过第三方',
      'tip.fetch.deepseek-api': 'DeepSeek 官方抓取接口，需要 DEEPSEEK_API_KEY',
      'tip.fetch.firecrawl': '渲染页与硬反爬站点，可匿名使用',
      'depth.basic': '基础',
      'depth.advanced': '高级',
      'depth.fast': '快速',
      'depth.ultra-fast': '极速',
      'tip.depth.basic': '延迟更低，每次 1 积分',
      'tip.depth.advanced': '相关度更高、片段更长，每次 2 积分',
      'tip.depth.fast': '优先低延迟，每次 1 积分',
      'tip.depth.ultra-fast': '最低延迟，每个 URL 只返回一条摘要，每次 1 积分',
      'jinaMode.anonymous': '匿名',
      'jinaMode.auto': '自动',
      'jinaMode.api': 'API Key',
      'tip.jinaMode.anonymous': '不需要 Key，每分钟 20 次请求',
      'tip.jinaMode.auto': '配置了 JINA_API_KEY 就用，否则匿名',
      'tip.jinaMode.api': '始终发送 JINA_API_KEY（500 RPM，按 token 计费）',
      'respond.default': '精简',
      'respond.markdown': '完整结构',
      'tip.respond.default': 'readability 提取：更省 token，可能丢小节标题',
      'tip.respond.markdown': '保留标题与列表，可能带上导航等杂项',
      'tip.row.fetchFallback': '第三方抓取失败时，自动改用本地抓取再试一次',
      'key.tavilyMissing': '未配置 Tavily API Key',
      'key.jinaMissing': 'Jina 搜索需要 API Key',
      'key.jinaApiMissing': 'Jina API 模式需要 API Key',
      'key.firecrawlMissing': '未配置 Firecrawl Key；匿名请求额度较小',
      'status.failed': '切换失败，请重试',
      'settings.summary': '选择搜索与抓取提供商，并配置 API Key。',
      'settings.scope': '对所有会话生效；改动即时写入。',
      'settings.global': '全局',
      'settings.on': '开',
      'settings.off': '关',
      'settings.credentials': 'API 凭据',
      'settings.credentialsHint': 'Key 保存在 DSH 凭据库，不写入设置文件。',
      'settings.tavilyKey': 'Tavily API Key',
      'settings.jinaKey': 'Jina API Key',
      'settings.firecrawlKey': 'Firecrawl API Key',
      'settings.tavilyHint': 'Tavily 搜索必填。',
      'settings.jinaHint': 'Jina 搜索必填；Reader 可选。',
      'settings.firecrawlHint': '可选，可提升匿名额度。',
      'settings.keyPlaceholder': '填入新的 API Key',
      'settings.keySet': '已配置',
      'settings.keyUnset': '未配置',
      'settings.readonly': '本部署的凭据为只读。',
      'settings.configReadonly': '当前配置为只读，无法保存。',
      'settings.save': '保存',
      'settings.saving': '保存中…',
      'settings.saved': '已保存',
      'settings.failed': '保存失败：',
      'settings.advanced': '高级设置',
      'settings.advancedHint': '请求预算、各家行为、端点与 Provider ID。',
      'settings.advancedReset': '恢复高级默认值',
      'settings.advancedResetConfirm': '再次点击确认',
      'settings.advancedResetHint': '不会改动凭据变量名。',
      'settings.advancedResetDone': '已恢复高级默认值',
      'settings.advancedResetWorking': '恢复中…',
      'settings.advancedResetFailed': '恢复失败：',
      'adv.budget': '请求预算',
      'adv.budgetHint': '单次搜索 / 抓取的输出上限与超时。',
      'adv.tavily': 'Tavily 搜索',
      'adv.jina': 'Jina Reader',
      'adv.firecrawl': 'Firecrawl',
      'adv.endpoints': '端点与 Provider ID',
      'adv.endpointsHint': '留空使用内置默认；Provider ID 需与宿主注册一致。',
      'adv.env': '凭据变量名',
      'adv.envHint': '修改后，Key 输入行会改读写新的变量名。',
      'adv.fetchMaxChars': '抓取字符上限',
      'adv.fetchMaxChars.hint': '单次 url→markdown 的最大字符数（1000–200000）。',
      'adv.snippetMaxChars': '搜索摘要上限',
      'adv.snippetMaxChars.hint': '每条搜索结果保留的字符数（0–5000）。',
      'adv.jinaTimeoutSeconds': 'Jina 超时',
      'adv.jinaTimeoutSeconds.hint': '秒，1–180。',
      'adv.firecrawlTimeoutMs': 'Firecrawl 超时',
      'adv.firecrawlTimeoutMs.hint': '毫秒，1000–25000；需低于工具预算。',
      'adv.tavilyTopic': '搜索主题',
      'adv.tavilyTopic.hint': '通用、新闻或财经。',
      'adv.tavilyAnswer': '答案模式',
      'adv.tavilyAnswer.hint': '让 Tavily 附带生成的答案。',
      'adv.tavilyChunksPerSource': '每源片段数',
      'adv.tavilyChunksPerSource.hint': '1–3，高级强度下生效。',
      'adv.tavilyIncludePublishedDate': '发布日期',
      'adv.tavilyIncludePublishedDate.hint': '在结果中附带发布日期。',
      'adv.jinaEngine': '渲染引擎',
      'adv.jinaEngine.hint': '自动、浏览器或 curl。',
      'adv.jinaRetainImages': '图片保留',
      'adv.jinaRetainImages.hint': '全部、不保留或仅 alt。',
      'adv.jinaRetainLinks': '链接保留',
      'adv.jinaRetainLinks.hint': '全部、不保留或仅文字。',
      'adv.jinaLinksSummary': '链接摘要',
      'adv.jinaLinksSummary.hint': '让 Reader 附带链接摘要。',
      'adv.jinaBypassCache': '绕过缓存',
      'adv.jinaBypassCache.hint': '每次都抓取最新副本。',
      'adv.jinaSite': 'Site 限定',
      'adv.jinaSite.hint': '可选域名，如 example.com。',
      'adv.jinaTargetSelector': '正文选择器',
      'adv.jinaTargetSelector.hint': '可选 CSS 选择器，如 #mw-content-text；建议配合「完整结构」。',
      'adv.firecrawlProxy': '代理模式',
      'adv.firecrawlProxy.hint': '自动、基础或增强。',
      'adv.firecrawlOnlyMainContent': '仅主内容',
      'adv.firecrawlOnlyMainContent.hint': '去掉导航与页脚等杂项。',
      'adv.firecrawlWaitFor': '渲染等待',
      'adv.firecrawlWaitFor.hint': '抓取前等待毫秒数，0–20000。',
      'adv.firecrawlMaxAgeMs': '缓存有效期',
      'adv.firecrawlMaxAgeMs.hint': '毫秒；0 表示不复用缓存。',
      'adv.firecrawlBlockAds': '屏蔽广告',
      'adv.firecrawlBlockAds.hint': '请求 Firecrawl 屏蔽广告资源。',
      'adv.firecrawlSearchScrape': '搜索附带正文',
      'adv.firecrawlSearchScrape.hint': 'Firecrawl 搜索时返回页面正文。',
      'adv.tavilyBaseURL': 'Tavily 端点',
      'adv.jinaReaderURL': 'Jina Reader 端点',
      'adv.jinaSearchURL': 'Jina Search 端点',
      'adv.firecrawlBaseURL': 'Firecrawl 端点',
      'adv.nativeProviderId': '原生搜索 Provider ID',
      'adv.searchApiProviderId': '官方搜索 Provider ID',
      'adv.fetchApiProviderId': '官方抓取 Provider ID',
      'adv.localFetchProviderId': '本地抓取 Provider ID',
      'adv.tavilyApiKeyEnv': 'Tavily 凭据名',
      'adv.jinaApiKeyEnv': 'Jina 凭据名',
      'adv.firecrawlApiKeyEnv': 'Firecrawl 凭据名',
      'adv.error.number': '请输入范围内的整数',
      'adv.error.url': '请输入 http(s) 地址',
      'adv.error.id': 'Provider ID 不能为空且不能包含空格',
      'adv.error.env': '请输入合法的环境变量名',
      'adv.error.domain': '请输入域名，如 example.com',
      'adv.error.select': '请选择有效选项',
      'unit.chars': '字符',
      'unit.seconds': '秒',
      'unit.ms': '毫秒',
      'opt.general': '通用',
      'opt.news': '新闻',
      'opt.finance': '财经',
      'opt.answer.off': '关闭',
      'opt.answer.basic': '基础',
      'opt.answer.advanced': '高级',
      'opt.auto': '自动',
      'opt.browser': '浏览器',
      'opt.curl': 'curl',
      'opt.images.all': '全部',
      'opt.images.none': '不保留',
      'opt.images.alt': '仅 alt',
      'opt.links.all': '全部',
      'opt.links.none': '不保留',
      'opt.links.text': '仅文字',
      'opt.proxy.auto': '自动',
      'opt.proxy.basic': '基础',
      'opt.proxy.enhanced': '增强',
    }

    /* ------------------------------------------------------------------ *
     * Pure readers over the settings snapshot
     * ------------------------------------------------------------------ */

    /** Read one field of a settings snapshot's effective value. */
    function fieldValue(snapshot, field) {
      if (snapshot === null || typeof snapshot !== 'object') return undefined
      const value = snapshot.value
      return value !== null && typeof value === 'object' ? value[field] : undefined
    }

    /** The active search source, falling back to the plugin default. */
    function readSearchSource(snapshot) {
      const value = fieldValue(snapshot, 'active')
      return SEARCH_OPTIONS.indexOf(value) >= 0 ? value : DEFAULT_SEARCH
    }

    /** The active fetch source, falling back to the plugin default. */
    function readFetchSource(snapshot) {
      const value = fieldValue(snapshot, 'fetchSource')
      return FETCH_OPTIONS.indexOf(value) >= 0 ? value : DEFAULT_FETCH
    }

    /**
     * The active Tavily depth: both quality tiers plus the latency tiers the
     * same popover offers. Unknown values fall back without rewriting config.
     */
    function readDepth(snapshot) {
      const value = fieldValue(snapshot, 'tavilySearchDepth')
      return ALL_DEPTH_OPTIONS.indexOf(value) >= 0 ? value : DEFAULT_DEPTH
    }

    /** The Jina Reader key mode. */
    function readJinaReaderKeyMode(snapshot) {
      const value = fieldValue(snapshot, 'jinaReaderKeyMode')
      return JINA_KEY_MODES.indexOf(value) >= 0 ? value : DEFAULT_JINA_MODE
    }

    /** The Jina Reader content pipeline. */
    function readJinaRespondWith(snapshot) {
      const value = fieldValue(snapshot, 'jinaRespondWith')
      return JINA_RESPOND_WITH.indexOf(value) >= 0 ? value : 'default'
    }

    /** Whether third-party fetch failures fall back to the local fetcher. */
    function readFallback(snapshot) {
      const value = fieldValue(snapshot, 'fetchFallbackToLocal')
      return typeof value === 'boolean' ? value : DEFAULT_FALLBACK
    }

    /** Whether the host accepts writes for this entry right now. */
    function isWritable(snapshot) {
      return snapshot !== null && typeof snapshot === 'object'
        && snapshot.writable === true
        && snapshot.status === 'ready'
    }

    /** Read the credential reference of one provider. */
    function keyRef(snapshot, provider) {
      const value = fieldValue(snapshot, KEY_FIELDS[provider])
      return typeof value === 'string' && value.length > 0 ? value : DEFAULT_KEY_REFS[provider]
    }

    /** Every credential reference the page shows, keyed by provider. */
    function keyRefs(snapshot) {
      return {
        tavily: keyRef(snapshot, 'tavily'),
        jina: keyRef(snapshot, 'jina'),
        firecrawl: keyRef(snapshot, 'firecrawl'),
      }
    }

    /**
     * Which provider owns the visible warning dot.
     *
     * A missing key only blocks what actually needs one: Tavily search, Jina
     * search and Jina Reader in `api` mode. Firecrawl and anonymous Reader keep
     * working, so they never raise the dot.
     */
    function missingKeyProvider(state) {
      if (state.searchSource === 'tavily' && state.keyStates.tavily === 'unset') return 'tavily'
      if (state.searchSource === 'jina' && state.keyStates.jina === 'unset') return 'jina'
      if (state.fetchSource === 'jina' && state.jinaMode === 'api' && state.keyStates.jina === 'unset') return 'jinaApi'
      return null
    }

    /**
     * The root cells of the search popover: the provider seat and, while Tavily
     * answers, its depth seat. Every cell drills into its own list, mirroring
     * the model picker's two-level menu.
     */
    function searchRootRows(state) {
      const rows = [{
        id: 'source',
        labelKey: 'row.searchSource',
        valueKey: 'source.' + state.searchSource,
        warning: (state.searchSource === 'tavily' || state.searchSource === 'jina')
          && state.keyStates[state.searchSource] === 'unset'
          ? state.searchSource
          : null,
      }]
      if (state.searchSource === 'tavily') {
        rows.push({ id: 'depth', labelKey: 'row.searchDepth', valueKey: 'depth.' + state.depth, warning: null })
      }
      return rows
    }

    /**
     * The root cells of the fetch popover. Jina owns three of them (provider,
     * key mode, content mode); the local fallback toggle follows the provider
     * cells. The local fetcher has no fallback of its own.
     */
    function fetchRootRows(state) {
      const rows = [{
        id: 'source',
        labelKey: 'row.fetchSource',
        valueKey: 'source.' + state.fetchSource,
        warning: null,
      }]
      if (state.fetchSource === 'jina') {
        rows.push({
          id: 'mode',
          labelKey: 'row.fetchMode',
          valueKey: 'jinaMode.' + state.jinaMode,
          warning: state.jinaMode === 'api' && state.keyStates.jina === 'unset' ? 'jinaApi' : null,
        })
        rows.push({
          id: 'respond',
          labelKey: 'row.fetchRespond',
          valueKey: 'respond.' + state.respondWith,
          warning: null,
        })
      }
      return rows
    }

    /**
     * Build the search popover model: the root cells plus the two drilled
     * lists and the Tavily depth tiers.
     * Pure so the register lane can assert every combination without a browser.
     */
    function searchMenuModel(state) {
      return {
        root: searchRootRows(state),
        providers: SEARCH_OPTIONS.map(function (id) {
          return {
            id: id,
            labelKey: 'source.' + id,
            tipKey: 'tip.search.' + id,
            selected: state.searchSource === id,
            keyMissing: (id === 'tavily' || id === 'jina') && state.keyStates[id] === 'unset',
          }
        }),
        depths: state.searchSource === 'tavily'
          ? ALL_DEPTH_OPTIONS.map(function (id) {
            return { id: id, labelKey: 'depth.' + id, tipKey: 'tip.depth.' + id, selected: state.depth === id }
          })
          : [],
      }
    }

    /**
     * Build the fetch popover model: the root cells, the drilled provider /
     * Jina key-mode / Jina content-mode lists, and the local-fallback toggle.
     */
    function fetchMenuModel(state) {
      return {
        root: fetchRootRows(state),
        providers: FETCH_OPTIONS.map(function (id) {
          return {
            id: id,
            labelKey: 'source.' + id,
            tipKey: 'tip.fetch.' + id,
            selected: state.fetchSource === id,
            keyMissing: id === 'firecrawl' && state.keyStates.firecrawl === 'unset',
          }
        }),
        jinaModes: state.fetchSource === 'jina'
          ? JINA_KEY_MODES.map(function (id) {
            return { id: id, labelKey: 'jinaMode.' + id, tipKey: 'tip.jinaMode.' + id, selected: state.jinaMode === id }
          })
          : [],
        respondWith: state.fetchSource === 'jina'
          ? JINA_RESPOND_WITH.map(function (id) {
            return { id: id, labelKey: 'respond.' + id, tipKey: 'tip.respond.' + id, selected: state.respondWith === id }
          })
          : [],
        fallback: state.fallback,
        fallbackApplies: state.fetchSource !== 'local',
      }
    }

    /* ------------------------------------------------------------------ *
     * Advanced settings descriptors
     * ------------------------------------------------------------------ */

    /** Select options shared by the advanced fields. */
    const TOPIC_OPTIONS = [
      { value: 'general', labelKey: 'opt.general' },
      { value: 'news', labelKey: 'opt.news' },
      { value: 'finance', labelKey: 'opt.finance' },
    ]
    const ANSWER_OPTIONS = [
      { value: 'off', labelKey: 'opt.answer.off' },
      { value: 'basic', labelKey: 'opt.answer.basic' },
      { value: 'advanced', labelKey: 'opt.answer.advanced' },
    ]
    const ENGINE_OPTIONS = [
      { value: 'auto', labelKey: 'opt.auto' },
      { value: 'browser', labelKey: 'opt.browser' },
      { value: 'curl', labelKey: 'opt.curl' },
    ]
    const IMAGE_OPTIONS = [
      { value: 'all', labelKey: 'opt.images.all' },
      { value: 'none', labelKey: 'opt.images.none' },
      { value: 'alt', labelKey: 'opt.images.alt' },
    ]
    const LINK_OPTIONS = [
      { value: 'all', labelKey: 'opt.links.all' },
      { value: 'none', labelKey: 'opt.links.none' },
      { value: 'text', labelKey: 'opt.links.text' },
    ]
    const PROXY_OPTIONS = [
      { value: 'auto', labelKey: 'opt.proxy.auto' },
      { value: 'basic', labelKey: 'opt.proxy.basic' },
      { value: 'enhanced', labelKey: 'opt.proxy.enhanced' },
    ]

    /**
     * The advanced fields the settings card renders, grouped by provider.
     *
     * Every field already exists in the host Config; the descriptors only say
     * how to present and validate it. Defaults mirror the schemastery defaults
     * (and the empty string means "use the provider's built-in endpoint/id").
     */
    const ADVANCED_SECTIONS = [
      {
        id: 'budget',
        titleKey: 'adv.budget',
        hintKey: 'adv.budgetHint',
        fields: [
          { field: 'fetchMaxChars', kind: 'number', min: 1000, max: 200000, def: 100000, labelKey: 'adv.fetchMaxChars', hintKey: 'adv.fetchMaxChars.hint', unitKey: 'unit.chars' },
          { field: 'snippetMaxChars', kind: 'number', min: 0, max: 5000, def: 800, labelKey: 'adv.snippetMaxChars', hintKey: 'adv.snippetMaxChars.hint', unitKey: 'unit.chars' },
          { field: 'jinaTimeoutSeconds', kind: 'number', min: 1, max: 180, def: 20, labelKey: 'adv.jinaTimeoutSeconds', hintKey: 'adv.jinaTimeoutSeconds.hint', unitKey: 'unit.seconds' },
          { field: 'firecrawlTimeoutMs', kind: 'number', min: 1000, max: 25000, def: 20000, labelKey: 'adv.firecrawlTimeoutMs', hintKey: 'adv.firecrawlTimeoutMs.hint', unitKey: 'unit.ms' },
        ],
      },
      {
        id: 'tavily',
        titleKey: 'adv.tavily',
        fields: [
          { field: 'tavilyTopic', kind: 'select', def: 'general', options: TOPIC_OPTIONS, labelKey: 'adv.tavilyTopic', hintKey: 'adv.tavilyTopic.hint' },
          { field: 'tavilyAnswer', kind: 'select', def: 'off', options: ANSWER_OPTIONS, labelKey: 'adv.tavilyAnswer', hintKey: 'adv.tavilyAnswer.hint' },
          { field: 'tavilyChunksPerSource', kind: 'number', min: 1, max: 3, def: 3, labelKey: 'adv.tavilyChunksPerSource', hintKey: 'adv.tavilyChunksPerSource.hint' },
          { field: 'tavilyIncludePublishedDate', kind: 'boolean', def: true, labelKey: 'adv.tavilyIncludePublishedDate', hintKey: 'adv.tavilyIncludePublishedDate.hint' },
        ],
      },
      {
        id: 'jina',
        titleKey: 'adv.jina',
        fields: [
          { field: 'jinaEngine', kind: 'select', def: 'auto', options: ENGINE_OPTIONS, labelKey: 'adv.jinaEngine', hintKey: 'adv.jinaEngine.hint' },
          { field: 'jinaRetainImages', kind: 'select', def: 'none', options: IMAGE_OPTIONS, labelKey: 'adv.jinaRetainImages', hintKey: 'adv.jinaRetainImages.hint' },
          { field: 'jinaRetainLinks', kind: 'select', def: 'all', options: LINK_OPTIONS, labelKey: 'adv.jinaRetainLinks', hintKey: 'adv.jinaRetainLinks.hint' },
          { field: 'jinaLinksSummary', kind: 'boolean', def: false, labelKey: 'adv.jinaLinksSummary', hintKey: 'adv.jinaLinksSummary.hint' },
          { field: 'jinaBypassCache', kind: 'boolean', def: false, labelKey: 'adv.jinaBypassCache', hintKey: 'adv.jinaBypassCache.hint' },
          { field: 'jinaSite', kind: 'site', def: '', labelKey: 'adv.jinaSite', hintKey: 'adv.jinaSite.hint' },
          { field: 'jinaTargetSelector', kind: 'selector', def: '', labelKey: 'adv.jinaTargetSelector', hintKey: 'adv.jinaTargetSelector.hint' },
        ],
      },
      {
        id: 'firecrawl',
        titleKey: 'adv.firecrawl',
        fields: [
          { field: 'firecrawlProxy', kind: 'select', def: 'auto', options: PROXY_OPTIONS, labelKey: 'adv.firecrawlProxy', hintKey: 'adv.firecrawlProxy.hint' },
          { field: 'firecrawlOnlyMainContent', kind: 'boolean', def: true, labelKey: 'adv.firecrawlOnlyMainContent', hintKey: 'adv.firecrawlOnlyMainContent.hint' },
          { field: 'firecrawlWaitFor', kind: 'number', min: 0, max: 20000, def: 0, labelKey: 'adv.firecrawlWaitFor', hintKey: 'adv.firecrawlWaitFor.hint', unitKey: 'unit.ms' },
          { field: 'firecrawlMaxAgeMs', kind: 'number', min: 0, def: 172800000, labelKey: 'adv.firecrawlMaxAgeMs', hintKey: 'adv.firecrawlMaxAgeMs.hint', unitKey: 'unit.ms' },
          { field: 'firecrawlBlockAds', kind: 'boolean', def: true, labelKey: 'adv.firecrawlBlockAds', hintKey: 'adv.firecrawlBlockAds.hint' },
          { field: 'firecrawlSearchScrape', kind: 'boolean', def: false, labelKey: 'adv.firecrawlSearchScrape', hintKey: 'adv.firecrawlSearchScrape.hint' },
        ],
      },
      {
        id: 'endpoints',
        titleKey: 'adv.endpoints',
        hintKey: 'adv.endpointsHint',
        collapsible: true,
        fields: [
          { field: 'tavilyBaseURL', kind: 'url', def: '', labelKey: 'adv.tavilyBaseURL' },
          { field: 'jinaReaderURL', kind: 'url', def: '', labelKey: 'adv.jinaReaderURL' },
          { field: 'jinaSearchURL', kind: 'url', def: '', labelKey: 'adv.jinaSearchURL' },
          { field: 'firecrawlBaseURL', kind: 'url', def: '', labelKey: 'adv.firecrawlBaseURL' },
          { field: 'nativeProviderId', kind: 'provider-id', def: 'deepseek-official', labelKey: 'adv.nativeProviderId' },
          { field: 'searchApiProviderId', kind: 'provider-id', def: 'deepseek-search-api', labelKey: 'adv.searchApiProviderId' },
          { field: 'fetchApiProviderId', kind: 'provider-id', def: 'deepseek-fetch-api', labelKey: 'adv.fetchApiProviderId' },
          { field: 'localFetchProviderId', kind: 'provider-id', def: 'http', labelKey: 'adv.localFetchProviderId' },
        ],
      },
      {
        id: 'env',
        titleKey: 'adv.env',
        hintKey: 'adv.envHint',
        collapsible: true,
        keepOnReset: true,
        fields: [
          { field: 'tavilyApiKeyEnv', kind: 'env-ref', def: 'TAVILY_API_KEY', labelKey: 'adv.tavilyApiKeyEnv' },
          { field: 'jinaApiKeyEnv', kind: 'env-ref', def: 'JINA_API_KEY', labelKey: 'adv.jinaApiKeyEnv' },
          { field: 'firecrawlApiKeyEnv', kind: 'env-ref', def: 'FIRECRAWL_API_KEY', labelKey: 'adv.firecrawlApiKeyEnv' },
        ],
      },
    ]

    /** Flat list of every advanced field. */
    const ADVANCED_FIELDS = ADVANCED_SECTIONS.reduce(function (all, section) {
      return all.concat(section.fields)
    }, [])

    /** Field name → schema default, used by the reset action. */
    const ADVANCED_DEFAULTS = ADVANCED_FIELDS.reduce(function (defaults, spec) {
      defaults[spec.field] = spec.def
      return defaults
    }, {})

    /** Fields the reset action leaves alone (credential variable names). */
    const ADVANCED_RESET_FIELDS = ADVANCED_SECTIONS.reduce(function (all, section) {
      return section.keepOnReset === true ? all : all.concat(section.fields)
    }, [])

    const PROVIDER_ID_PATTERN = /^\S+$/
    const ENV_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
    const HTTP_URL_PATTERN = /^https?:\/\/\S+$/i
    const SITE_PATTERN = /^[a-z0-9.-]+$/i

    /**
     * Validate one advanced field input.
     * @param spec - the field descriptor.
     * @param raw - the draft value from the control.
     * @returns `{ ok: true, value }` or `{ ok: false, errorKey }`.
     */
    function validateAdvanced(spec, raw) {
      if (spec.kind === 'boolean') return { ok: true, value: raw === true }
      if (spec.kind === 'select') {
        const known = spec.options.some(function (option) { return option.value === raw })
        return known ? { ok: true, value: raw } : { ok: false, errorKey: 'adv.error.select' }
      }
      const text = typeof raw === 'string' ? raw.trim() : String(raw === undefined || raw === null ? '' : raw).trim()
      if (spec.kind === 'number') {
        if (!/^\d+$/.test(text)) return { ok: false, errorKey: 'adv.error.number' }
        const value = Number(text)
        if (!Number.isSafeInteger(value) || value < spec.min || (typeof spec.max === 'number' && value > spec.max)) {
          return { ok: false, errorKey: 'adv.error.number' }
        }
        return { ok: true, value: value }
      }
      if (spec.kind === 'url') {
        if (text === '') return { ok: true, value: '' }
        return HTTP_URL_PATTERN.test(text) ? { ok: true, value: text } : { ok: false, errorKey: 'adv.error.url' }
      }
      if (spec.kind === 'provider-id') {
        return PROVIDER_ID_PATTERN.test(text) ? { ok: true, value: text } : { ok: false, errorKey: 'adv.error.id' }
      }
      if (spec.kind === 'env-ref') {
        return ENV_REF_PATTERN.test(text) ? { ok: true, value: text } : { ok: false, errorKey: 'adv.error.env' }
      }
      if (spec.kind === 'site') {
        return text === '' || SITE_PATTERN.test(text) ? { ok: true, value: text } : { ok: false, errorKey: 'adv.error.domain' }
      }
      return { ok: true, value: text }
    }

    /**
     * Read a field's current value with the descriptor's type applied.
     * @param spec - the field descriptor.
     * @param snapshot - the settings snapshot.
     * @returns the value the control should show.
     */
    function advancedStored(spec, snapshot) {
      const value = fieldValue(snapshot, spec.field)
      if (spec.kind === 'boolean') return typeof value === 'boolean' ? value : spec.def
      if (spec.kind === 'select') {
        return spec.options.some(function (option) { return option.value === value }) ? value : spec.def
      }
      if (spec.kind === 'number') return typeof value === 'number' ? value : spec.def
      if (spec.kind === 'url' || spec.kind === 'site' || spec.kind === 'selector') {
        return typeof value === 'string' ? value : ''
      }
      return typeof value === 'string' ? value : spec.def
    }

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */

    const STYLE_TAG_ID = 'dsh-search-switch'

    const CSS = [
      '.dssw-root{display:inline-flex;align-items:center;gap:6px;min-width:0}',
      '.dssw-pill{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 10px;font:inherit;font-size:12px;line-height:24px;white-space:nowrap;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color .12s,color .12s}',
      '.dssw-pill:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dssw-pill:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}',
      '.dssw-pill:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}',
      '.dssw-pill--open,.dssw-pill[aria-expanded="true"]{background:var(--dsw-alias-button-tool-bar-fill);color:var(--dsw-alias-label-primary);font-weight:500}',
      '.dssw-pill:disabled{opacity:.55;cursor:not-allowed}',
      '.dssw-pill-value{color:var(--dsw-alias-label-primary);font-weight:500}',
      '.dssw-pill-caret{font-size:10px;line-height:1;color:var(--dsw-alias-label-tertiary)}',
      '.dssw-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-warning-primary,#d69e2e);flex:none}',
      '.dssw-menu{position:fixed;z-index:1100;box-sizing:border-box;max-height:calc(100vh - 16px);overflow:hidden;display:flex;flex-direction:column;padding:4px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary)}',
      '.dssw-panel{display:flex;flex-direction:column;min-height:0;overflow-y:auto}',
      '.dssw-panel--root{animation:dssw-fade .12s ease-out}',
      '.dssw-panel--drawer{animation:dssw-slide .16s ease-out}',
      '@keyframes dssw-fade{from{opacity:0}to{opacity:1}}',
      '@keyframes dssw-slide{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}',
      '.dssw-drawer-head{display:flex;align-items:center;gap:4px;height:30px;padding:0 2px 2px;flex:none}',
      '.dssw-back{display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:16px;line-height:1;cursor:pointer;flex:none}',
      '.dssw-back:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dssw-back:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}',
      '.dssw-drawer-title{flex:1;min-width:0;font-size:12px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dssw-cell{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;height:34px;padding:0 8px;border:0;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}',
      '.dssw-cell:hover,.dssw-cell:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dssw-cell:focus-visible{outline:none}',
      '.dssw-cell-label{flex:none;white-space:nowrap}',
      '.dssw-cell-value{margin-left:auto;min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary)}',
      '.dssw-cell-chevron{flex:none;font-size:14px;line-height:1;color:var(--dsw-alias-menu-icon,var(--dsw-alias-label-tertiary))}',
      '.dssw-option{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:5px 7px;border:0;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}',
      '.dssw-option:hover,.dssw-option:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dssw-option:focus-visible{outline:none}',
      '.dssw-option-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dssw-option-check{display:grid;place-items:center;flex:0 0 14px;color:var(--dsw-alias-label-primary);font-size:12px}',
      '.dssw-info{display:grid;place-items:center;width:14px;height:14px;flex:none;border:0.5px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l1));border-radius:50%;color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:1;cursor:help}',
      '.dssw-info:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l3,var(--dsw-alias-border-l2))}',
      '.dssw-tipbubble{position:fixed;z-index:1200;box-sizing:border-box;max-width:264px;padding:6px 8px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-tooltip-bg,var(--dsw-alias-bg-layer-4));color:#fff;font-size:12px;line-height:18px;text-align:left;box-shadow:var(--dsw-elevation-soft);pointer-events:none}',
      '.dssw-switch{position:relative;flex:none;width:22px;height:12px;border-radius:6px;background:var(--dsw-alias-border-l2);transition:background-color .12s}',
      '.dssw-switch--on{background:var(--dsw-alias-brand-primary)}',
      '.dssw-switch-knob{position:absolute;top:2px;left:2px;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-switch-thumb,#fff);transition:transform .12s}',
      '.dssw-switch--on .dssw-switch-knob{transform:translateX(10px)}',
      '.dssw-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
      '.dssw-menu-sep{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1);flex:none}',
      '.dssw-status{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}',
      '.dssw-card{display:flex;flex-direction:column;gap:18px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);max-width:720px}',
      '.dssw-card-row{display:flex;flex-direction:column;gap:4px}',
      '.dssw-card-label{font-weight:500}',
      '.dssw-card-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
      '.dssw-settings-head{display:flex;flex-direction:column;gap:6px}',
      '.dssw-route{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.dssw-route-chip{display:inline-flex;align-items:center;height:24px;padding:0 8px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dssw-section{display:flex;flex-direction:column;gap:8px;padding-top:16px;border-top:0.5px solid var(--dsw-alias-border-l1)}',
      '.dssw-section-title{font-weight:600;font-size:13px}',
      '.dssw-section-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin-top:-4px}',
      '.dssw-key-list{display:flex;flex-direction:column}',
      '.dssw-key-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:3px 16px;align-items:center;padding:10px 0;border-top:0.5px solid var(--dsw-alias-border-l1)}',
      '.dssw-key-row:first-child{border-top:0;padding-top:2px}',
      '.dssw-key-meta{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.dssw-key-name{font-weight:500}',
      '.dssw-key-ref{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dssw-key-state{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary)}',
      '.dssw-key-state--set{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary))}',
      '.dssw-key-control{display:flex;align-items:center;gap:8px;min-width:0}',
      '.dssw-key-control .dssw-input{flex:1;min-width:0}',
      '.dssw-key-hint{grid-column:1/-1;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}',
      '.dssw-key-error{grid-column:1/-1;font-size:11px;line-height:16px;color:var(--dsw-alias-state-error-primary)}',
      '.dssw-input{box-sizing:border-box;height:30px;padding:0 8px;font:inherit;font-size:13px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:transparent;color:inherit;min-width:0}',
      '.dssw-input:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:0}',
      '.dssw-input:disabled{opacity:.55;cursor:not-allowed}',
      '.dssw-select{appearance:auto;width:100%}',
      '.dssw-actions{display:flex;align-items:center;gap:8px}',
      '.dssw-btn{height:28px;padding:0 12px;font:inherit;font-size:12px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-button-tool-bar-fill);color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap}',
      '.dssw-btn:hover:not(:disabled){background:var(--dsw-alias-button-tool-bar-hover)}',
      '.dssw-btn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}',
      '.dssw-btn:disabled{opacity:.5;cursor:not-allowed}',
      '.dssw-btn--quiet{background:transparent}',
      '.dssw-btn--danger{color:var(--dsw-alias-state-error-primary)}',
      '.dssw-error{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}',
      '.dssw-warn{font-size:12px;line-height:18px;color:var(--dsw-alias-state-warning-primary,#d69e2e)}',
      '.dssw-advanced{border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);padding:0 12px}',
      '.dssw-advanced>summary{display:flex;align-items:center;gap:8px;height:40px;cursor:pointer;list-style:none;font-weight:500}',
      '.dssw-advanced>summary::-webkit-details-marker{display:none}',
      '.dssw-advanced[open]>summary{border-bottom:0.5px solid var(--dsw-alias-border-l1);margin-bottom:10px}',
      '.dssw-adv-chevron{color:var(--dsw-alias-label-tertiary);transition:transform .12s;font-size:12px}',
      '.dssw-advanced[open] .dssw-adv-chevron{transform:rotate(90deg)}',
      '.dssw-adv-hint{margin-left:auto;font-size:11px;font-weight:400;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dssw-advanced-body{display:flex;flex-direction:column;gap:16px;padding-bottom:12px}',
      '.dssw-advanced-body>.dssw-section:first-child{padding-top:0;border-top:0}',
      '.dssw-subgroup{border-top:0.5px solid var(--dsw-alias-border-l1);padding-top:6px}',
      '.dssw-subgroup>summary{display:flex;align-items:center;gap:6px;height:32px;cursor:pointer;list-style:none;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dssw-subgroup>summary::-webkit-details-marker{display:none}',
      '.dssw-subgroup-body{display:flex;flex-direction:column;gap:10px;padding:4px 0 10px}',
      '.dssw-field-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px 16px}',
      '.dssw-field{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.dssw-field-label{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dssw-field-control{display:flex;align-items:center;gap:6px;min-width:0}',
      '.dssw-field-control .dssw-input{flex:1}',
      '.dssw-field-unit{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.dssw-field-hint{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary)}',
      '.dssw-field-note{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary)}',
      '.dssw-field-error{font-size:11px;line-height:15px;color:var(--dsw-alias-state-error-primary)}',
      '.dssw-field-saved{font-size:11px;line-height:15px;color:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary))}',
      '.dssw-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:30px;padding:0 8px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer;text-align:left}',
      '.dssw-toggle:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.dssw-toggle:disabled{opacity:.55;cursor:not-allowed}',
      '.dssw-reset{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:2px}',
      '.dssw-reset-note{font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '@media (max-width:560px){.dssw-key-row{grid-template-columns:1fr}.dssw-adv-hint{display:none}}',
    ].join('\n')

    /**
     * Publish the stylesheet once and take it down with the fiber.
     *
     * The tag is shared by every fiber of this package (hot reload replaces the
     * fiber before the new one applies); removing it on dispose is still correct
     * because the new fiber re-creates it, and a missing tag is harmless.
     */
    function installStyles() {
      if (typeof document === 'undefined' || document.head === undefined || document.head === null) {
        return function () {}
      }
      const selector = 'style[data-plugin="' + STYLE_TAG_ID + '"]'
      let tag = document.querySelector(selector)
      if (!tag) {
        tag = document.createElement('style')
        tag.dataset.plugin = STYLE_TAG_ID
        tag.textContent = CSS
        document.head.appendChild(tag)
      }
      return function () {
        if (tag.parentNode !== null) tag.parentNode.removeChild(tag)
      }
    }

    /* ------------------------------------------------------------------ *
     * React helpers
     * ------------------------------------------------------------------ */

    const useSyncExternalStoreImpl = typeof React.useSyncExternalStore === 'function'
      ? React.useSyncExternalStore
      : function subscribeFallback(subscribe, getSnapshot) {
        const pair = React.useState(getSnapshot)
        const value = pair[0]
        const setValue = pair[1]
        React.useEffect(function () {
          return subscribe(function () { setValue(getSnapshot()) })
        }, [subscribe, getSnapshot])
        return value
      }

    /** Subscribe one component to a host settings form. */
    function useFormSnapshot(form) {
      const subscribe = React.useCallback(function (onChange) { return form.subscribe(onChange) }, [form])
      const getSnapshot = React.useCallback(function () { return form.getSnapshot() }, [form])
      return useSyncExternalStoreImpl(subscribe, getSnapshot)
    }

    /** Layout effect when the host React has one; the test lane falls back. */
    const useLayoutEffectImpl = typeof React.useLayoutEffect === 'function'
      ? React.useLayoutEffect
      : React.useEffect

    /** Default popover width, in CSS pixels. */
    const MENU_WIDTH = 260
    /** Height estimates used for the first paint, before the menu is measured. */
    const MENU_ESTIMATED_HEIGHT = { search: 90, fetch: 170 }
    /** Minimum distance kept between the popover and a viewport edge. */
    const MENU_MARGIN = 8
    /** Gap between the trigger and the popover. */
    const MENU_GAP = 6
    /** Gap between a tooltip and the dot that owns it. */
    const TIP_GAP = 8
    /** Half of the tooltip's max width, used to keep it inside the viewport. */
    const TIP_HALF_WIDTH = 132

    /**
     * Decide where a popover goes for one trigger rectangle.
     *
     * It opens downward by default, flips upward when the space below cannot
     * hold it, and otherwise picks the roomier side. The result is always
     * clamped into the viewport, so every row stays reachable even when the
     * composer sits at the bottom of a short window.
     *
     * @param rect - the trigger's client rectangle.
     * @param viewport - the window's inner width and height.
     * @param size - `{ width, height }`, or a bare height for the legacy call.
     * @returns the fixed-position top/left/width in CSS pixels, plus the side.
     */
    function menuPlacementFor(rect, viewport, size) {
      const width = typeof size === 'number' || size === undefined || size === null
        ? MENU_WIDTH
        : typeof size.width === 'number' ? size.width : MENU_WIDTH
      const height = typeof size === 'number'
        ? size
        : size && typeof size.height === 'number' ? size.height : MENU_ESTIMATED_HEIGHT.search
      const maxLeft = Math.max(MENU_MARGIN, viewport.width - width - MENU_MARGIN)
      const left = Math.min(Math.max(MENU_MARGIN, rect.right - width), maxLeft)
      const below = viewport.height - rect.bottom - MENU_GAP - MENU_MARGIN
      const above = rect.top - MENU_GAP - MENU_MARGIN
      const openAbove = below < height && above >= below
      const desiredTop = openAbove ? rect.top - height - MENU_GAP : rect.bottom + MENU_GAP
      const maxTop = Math.max(MENU_MARGIN, viewport.height - height - MENU_MARGIN)
      return {
        top: Math.round(Math.min(Math.max(MENU_MARGIN, desiredTop), maxTop)),
        left: Math.round(left),
        width: Math.round(width),
        above: openAbove,
      }
    }

    /**
     * Decide where a hint bubble goes for one anchor rectangle.
     *
     * It sits above the dot by default, drops below it near the top edge, and
     * is clamped horizontally so a wide tooltip never leaves the viewport.
     *
     * @param rect - the anchor's client rectangle.
     * @param viewport - the window's inner width and height.
     * @returns the fixed-position anchor point, the side, and the transform.
     */
    function tipPlacementFor(rect, viewport) {
      const above = rect.top > 96
      const center = rect.left + rect.width / 2
      return {
        above: above,
        left: Math.round(Math.min(Math.max(center, TIP_HALF_WIDTH + MENU_MARGIN), viewport.width - TIP_HALF_WIDTH - MENU_MARGIN)),
        top: Math.round(above ? rect.top - TIP_GAP : rect.bottom + TIP_GAP),
        transform: above ? 'translate(-50%,-100%)' : 'translateX(-50%)',
      }
    }

    /* ------------------------------------------------------------------ *
     * Composer control
     * ------------------------------------------------------------------ */

    /** Locale key of the hint shown when a provider is missing its key. */
    const WARNING_KEYS = {
      tavily: 'key.tavilyMissing',
      jina: 'key.jinaMissing',
      jinaApi: 'key.jinaApiMissing',
    }

    /** Read the current UI state out of one settings snapshot. */
    function readUiState(snapshot, keyStates) {
      return {
        searchSource: readSearchSource(snapshot),
        fetchSource: readFetchSource(snapshot),
        depth: readDepth(snapshot),
        jinaMode: readJinaReaderKeyMode(snapshot),
        respondWith: readJinaRespondWith(snapshot),
        fallback: readFallback(snapshot),
        keyStates: keyStates,
      }
    }

    /**
     * The composer-bar control: one pill per web capability, each opening a
     * popover with its providers and provider-specific options.
     */
    function SearchSwitch(props) {
      const t = props.t
      const form = props.form
      const credentials = props.credentials
      const snapshot = useFormSnapshot(form)
      const pairPending = React.useState(null)
      const pending = pairPending[0]
      const setPending = pairPending[1]
      const pairFailed = React.useState(false)
      const failed = pairFailed[0]
      const setFailed = pairFailed[1]
      const pairKeyStates = React.useState(UNKNOWN_KEY_STATES)
      const keyStates = pairKeyStates[0]
      const setKeyStates = pairKeyStates[1]
      const pairMenuKind = React.useState(null)
      const menuKind = pairMenuKind[0]
      const setMenuKind = pairMenuKind[1]
      const pairDrawer = React.useState(null)
      const drawer = pairDrawer[0]
      const setDrawer = pairDrawer[1]
      const pairTip = React.useState(null)
      const tip = pairTip[0]
      const setTip = pairTip[1]
      const pairMenuPos = React.useState(null)
      const menuPos = pairMenuPos[0]
      const setMenuPos = pairMenuPos[1]
      const searchTriggerRef = React.useRef(null)
      const fetchTriggerRef = React.useRef(null)
      const menuRef = React.useRef(null)
      const lastDrawerRef = React.useRef(null)

      const state = readUiState(snapshot, keyStates)
      const writable = isWritable(snapshot)
      const refs = keyRefs(snapshot)
      const missing = missingKeyProvider(state)

      React.useEffect(function () {
        if (!credentials || typeof credentials.describe !== 'function') return function () {}
        let alive = true
        const names = [refs.tavily, refs.jina, refs.firecrawl]
        Promise.resolve(credentials.describe(names)).then(function (response) {
          if (!alive) return
          const values = response && response.ok && response.value ? response.value : {}
          const next = {}
          for (const provider of ['tavily', 'jina', 'firecrawl']) {
            const view = values[refs[provider]]
            next[provider] = view && view.configured === true ? 'set' : view && view.configured === false ? 'unset' : 'unknown'
          }
          setKeyStates(next)
        }, function () {
          if (alive) setKeyStates(UNKNOWN_KEY_STATES)
        })
        return function () { alive = false }
      }, [credentials, refs.tavily, refs.jina, refs.firecrawl, setKeyStates])

      const choose = function (field, value) {
        if (!writable || pending !== null) return
        setPending(value)
        setFailed(false)
        Promise.resolve(form.set(field, value)).then(function (accepted) {
          if (accepted === false) setFailed(true)
        }, function () {
          setFailed(true)
        }).then(function () {
          setPending(null)
        })
      }

      const busy = pending !== null
      const triggerRefFor = function (kind) {
        return kind === 'search' ? searchTriggerRef : fetchTriggerRef
      }

      /** Close the popover and drop its transient drawer and hint state. */
      const closeMenu = function () {
        setMenuKind(null)
        setDrawer(null)
        setTip(null)
        lastDrawerRef.current = null
      }

      /** Show the hint bubble for one anchor; anchors are rows or info dots. */
      const showTip = function (text, node) {
        if (!node || !text || typeof window === 'undefined') return
        setTip({ text: text, rect: node.getBoundingClientRect() })
      }

      /** Hide the hint bubble. */
      const hideTip = function () {
        setTip(null)
      }

      /**
       * Place the popover under the trigger, clamped into the viewport.
       *
       * The menu is positioned `fixed` instead of absolute: the composer's
       * toolbar row is clipped by its own overflow, and this bundle must not
       * depend on `react-dom` (not in the platform module table) for a portal.
       */
      const openMenu = function (kind) {
        const node = triggerRefFor(kind).current
        if (node && typeof window !== 'undefined') {
          setMenuPos(menuPlacementFor(node.getBoundingClientRect(), {
            width: window.innerWidth,
            height: window.innerHeight,
          }, { width: MENU_WIDTH, height: MENU_ESTIMATED_HEIGHT[kind] }))
        }
        lastDrawerRef.current = null
        setDrawer(null)
        setTip(null)
        setMenuKind(kind)
      }

      /** Drill from the root cells into one list. */
      const drillInto = function (id) {
        lastDrawerRef.current = id
        setTip(null)
        setDrawer(id)
      }

      /** Return to the root cells, handing the keyboard back to the cell used. */
      const backToRoot = function () {
        setTip(null)
        setDrawer(null)
      }

      // Dismiss the popover on outside press, scroll, or resize. Escape leaves a
      // drilled list first and otherwise closes back to the trigger.
      React.useEffect(function () {
        if (menuKind === null) return function () {}
        if (typeof document === 'undefined' || typeof window === 'undefined') return function () {}
        const dismiss = function () {
          setMenuKind(null)
          setDrawer(null)
          setTip(null)
        }
        const onPointerDown = function (event) {
          if (searchTriggerRef.current && searchTriggerRef.current.contains(event.target)) return
          if (fetchTriggerRef.current && fetchTriggerRef.current.contains(event.target)) return
          if (menuRef.current && menuRef.current.contains(event.target)) return
          dismiss()
        }
        const onKeyDown = function (event) {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          if (drawer !== null) {
            setDrawer(null)
            setTip(null)
            return
          }
          dismiss()
          const trigger = triggerRefFor(menuKind).current
          if (trigger) trigger.focus()
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        document.addEventListener('scroll', dismiss, true)
        window.addEventListener('resize', dismiss)
        return function () {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
          document.removeEventListener('scroll', dismiss, true)
          window.removeEventListener('resize', dismiss)
        }
      }, [menuKind, drawer])

      // Move focus into the pane: the first cell when the popover opens, the
      // first option when a list is drilled, and back to the opening cell when
      // the list is left again.
      React.useEffect(function () {
        if (menuKind === null || !menuRef.current) return
        const root = menuRef.current
        let target = null
        if (drawer === null) {
          const previous = lastDrawerRef.current
          lastDrawerRef.current = null
          target = previous === null ? null : root.querySelector('[data-drawer="' + previous + '"]')
          if (target === null) target = root.querySelector('[data-drawer]')
        } else {
          target = root.querySelector('[data-option]')
        }
        if (target !== null && typeof target.focus === 'function') target.focus()
      }, [menuKind, drawer])

      // Re-place once the real height is known, so the estimate from the click
      // handler can never leave a row outside the viewport.
      useLayoutEffectImpl(function () {
        if (menuKind === null) return
        const node = menuRef.current
        const trigger = triggerRefFor(menuKind).current
        if (!node || !trigger || typeof window === 'undefined') return
        const placement = menuPlacementFor(trigger.getBoundingClientRect(), {
          width: window.innerWidth,
          height: window.innerHeight,
        }, { width: MENU_WIDTH, height: node.offsetHeight || MENU_ESTIMATED_HEIGHT[menuKind] })
        setMenuPos(function (previous) {
          if (previous !== null && previous.top === placement.top && previous.left === placement.left) {
            return previous
          }
          return placement
        })
      }, [menuKind, drawer, setMenuPos])

      /** Roving focus inside the popover. */
      const onMenuKeyDown = function (event) {
        if (!menuRef.current) return
        const items = Array.prototype.slice.call(menuRef.current.querySelectorAll('[data-menu-item]'))
        if (items.length === 0) return
        const current = items.indexOf(document.activeElement)
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const step = event.key === 'ArrowDown' ? 1 : -1
          items[(current + step + items.length) % items.length].focus()
        } else if (event.key === 'Home') {
          event.preventDefault()
          items[0].focus()
        } else if (event.key === 'End') {
          event.preventDefault()
          items[items.length - 1].focus()
        } else if (event.key === 'Tab') {
          setMenuKind(null)
          setDrawer(null)
          setTip(null)
        }
      }

      /** Show a hint on keyboard focus only; mouse opening should stay quiet. */
      const focusTip = function (text) {
        return function (event) {
          const node = event.currentTarget
          if (typeof node.matches === 'function' && !node.matches(':focus-visible')) return
          showTip(text, node)
        }
      }

      /** Render one root cell: label, current value, and a chevron into its list. */
      const renderCell = function (row, onOpen) {
        const warning = row.warning === null || row.warning === undefined ? null : t(WARNING_KEYS[row.warning])
        return h('button', {
          key: row.id,
          type: 'button',
          role: 'menuitem',
          className: 'dssw-cell',
          tabIndex: -1,
          'data-menu-item': 'cell:' + row.id,
          'data-drawer': row.id,
          'aria-label': t(row.labelKey) + ' · ' + t(row.valueKey) + (warning === null ? '' : ' · ' + warning),
          onClick: onOpen,
        }, [
          h('span', { key: 'label', className: 'dssw-cell-label' }, t(row.labelKey)),
          row.warning ? h('span', { key: 'dot', className: 'dssw-dot', 'aria-hidden': 'true' }) : null,
          h('span', { key: 'value', className: 'dssw-cell-value' }, t(row.valueKey)),
          h('span', { key: 'chevron', className: 'dssw-cell-chevron', 'aria-hidden': 'true' }, '\u203a'),
        ])
      }

      /**
       * Render one radio option of a drilled list. The description lives in the
       * `?` dot (hover/focus) and in the row's accessible description; the row
       * itself only carries the name, matching the model picker's menu.
       */
      const renderOption = function (option, pane, dataAttributes, onSelect) {
        const tipText = t(option.tipKey)
        const tipId = 'dssw-tip-' + pane + '-' + option.id
        const stop = function (event) { event.stopPropagation() }
        return h('div', Object.assign({
          key: option.id,
          role: 'menuitemradio',
          'aria-checked': option.selected ? 'true' : 'false',
          'aria-label': t(option.labelKey),
          'aria-describedby': tipId,
          'data-menu-item': option.id,
          'data-option': option.id,
          tabIndex: -1,
          className: 'dssw-option',
          onClick: onSelect,
          onKeyDown: function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect()
            }
          },
          onFocus: focusTip(tipText),
          onBlur: hideTip,
        }, dataAttributes), [
          h('span', { key: 'label', className: 'dssw-option-label' }, t(option.labelKey)),
          option.keyMissing ? h('span', { key: 'dot', className: 'dssw-dot', 'aria-hidden': 'true' }) : null,
          h('span', {
            key: 'info',
            className: 'dssw-info',
            'aria-hidden': 'true',
            onClick: stop,
            onMouseEnter: function (event) { showTip(tipText, event.currentTarget) },
            onMouseLeave: hideTip,
          }, '?'),
          h('span', { key: 'desc', id: tipId, className: 'dssw-sr-only', 'aria-hidden': 'true' }, tipText),
          option.selected ? h('span', {
            key: 'check',
            className: 'dssw-option-check',
            'aria-hidden': 'true',
          }, '\u2713') : null,
        ])
      }

      /** Render one drilled pane: a back header plus its option rows. */
      const renderDrawer = function (titleKey, options) {
        return h('div', { key: 'panel', className: 'dssw-panel dssw-panel--drawer', 'data-panel': drawer }, [
          h('div', { key: 'head', className: 'dssw-drawer-head' }, [
            h('button', {
              key: 'back',
              type: 'button',
              role: 'menuitem',
              className: 'dssw-back',
              'data-menu-item': 'back',
              'data-drawer-back': '1',
              'aria-label': t('drawer.back'),
              onClick: backToRoot,
            }, '\u2039'),
            h('span', { key: 'title', className: 'dssw-drawer-title' }, t(titleKey)),
          ]),
          ...options,
        ])
      }

      const selectAndClose = function (field, triggerRef, option) {
        if (!option.selected) choose(field, option.id)
        closeMenu()
        if (triggerRef.current) triggerRef.current.focus()
      }

      const searchModel = searchMenuModel(state)
      const fetchModel = fetchMenuModel(state)

      /** The fallback toggle stays in the root pane and keeps the menu open. */
      const renderFallbackCell = function () {
        const tipText = t('tip.row.fetchFallback')
        const stop = function (event) { event.stopPropagation() }
        const toggle = function () { choose('fetchFallbackToLocal', !fetchModel.fallback) }
        return h('div', {
          key: 'fallback',
          role: 'menuitemcheckbox',
          'aria-checked': fetchModel.fallback ? 'true' : 'false',
          'aria-label': t('row.fetchFallback'),
          'aria-describedby': 'dssw-tip-fetch-fallback',
          'data-menu-item': 'fallback',
          'data-fallback': fetchModel.fallback ? 'on' : 'off',
          tabIndex: -1,
          className: 'dssw-cell',
          onClick: toggle,
          onKeyDown: function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              toggle()
            }
          },
          onFocus: focusTip(tipText),
          onBlur: hideTip,
        }, [
          h('span', { key: 'label', className: 'dssw-cell-label' }, t('row.fetchFallback')),
          h('span', {
            key: 'info',
            className: 'dssw-info',
            'aria-hidden': 'true',
            onClick: stop,
            onMouseEnter: function (event) { showTip(tipText, event.currentTarget) },
            onMouseLeave: hideTip,
          }, '?'),
          h('span', { key: 'desc', id: 'dssw-tip-fetch-fallback', className: 'dssw-sr-only', 'aria-hidden': 'true' }, tipText),
          h('span', {
            key: 'switch',
            className: 'dssw-switch' + (fetchModel.fallback ? ' dssw-switch--on' : ''),
            'aria-hidden': 'true',
          }, h('span', { key: 'knob', className: 'dssw-switch-knob' })),
        ])
      }

      /** The pane currently shown by the search popover. */
      const renderSearchPane = function () {
        if (drawer === 'source') {
          return renderDrawer('row.searchSource', searchModel.providers.map(function (option) {
            return renderOption(option, 'search-source', { 'data-search-source': option.id }, function () {
              selectAndClose('active', searchTriggerRef, option)
            })
          }))
        }
        if (drawer === 'depth') {
          return renderDrawer('row.searchDepth', searchModel.depths.map(function (option) {
            return renderOption(option, 'search-depth', { 'data-depth': option.id }, function () {
              selectAndClose('tavilySearchDepth', searchTriggerRef, option)
            })
          }))
        }
        return h('div', { key: 'panel', className: 'dssw-panel dssw-panel--root', 'data-panel': 'root' },
          searchModel.root.map(function (row) {
            return renderCell(row, function () { drillInto(row.id) })
          }))
      }

      /** The pane currently shown by the fetch popover. */
      const renderFetchPane = function () {
        if (drawer === 'source') {
          return renderDrawer('row.fetchSource', fetchModel.providers.map(function (option) {
            return renderOption(option, 'fetch-source', { 'data-fetch-source': option.id }, function () {
              selectAndClose('fetchSource', fetchTriggerRef, option)
            })
          }))
        }
        if (drawer === 'mode') {
          return renderDrawer('row.fetchMode', fetchModel.jinaModes.map(function (option) {
            return renderOption(option, 'fetch-mode', { 'data-jina-mode': option.id }, function () {
              selectAndClose('jinaReaderKeyMode', fetchTriggerRef, option)
            })
          }))
        }
        if (drawer === 'respond') {
          return renderDrawer('row.fetchRespond', fetchModel.respondWith.map(function (option) {
            return renderOption(option, 'fetch-respond', { 'data-jina-respond': option.id }, function () {
              selectAndClose('jinaRespondWith', fetchTriggerRef, option)
            })
          }))
        }
        return h('div', { key: 'panel', className: 'dssw-panel dssw-panel--root', 'data-panel': 'root' }, [
          ...fetchModel.root.map(function (row) {
            return renderCell(row, function () { drillInto(row.id) })
          }),
          fetchModel.fallbackApplies ? h('div', { key: 'sep-fallback', className: 'dssw-menu-sep' }) : null,
          fetchModel.fallbackApplies ? renderFallbackCell() : null,
        ])
      }

      const menu = menuKind === null ? null : h('div', {
        key: menuKind + '-menu',
        ref: menuRef,
        className: 'dssw-menu',
        role: 'menu',
        'aria-label': menuKind === 'search' ? t('menu.search') : t('menu.fetch'),
        'data-menu': menuKind,
        onKeyDown: onMenuKeyDown,
        style: menuPos === null
          ? { top: '0px', left: '0px', width: MENU_WIDTH + 'px' }
          : { top: menuPos.top + 'px', left: menuPos.left + 'px', width: (menuPos.width || MENU_WIDTH) + 'px' },
      }, menuKind === 'search' ? renderSearchPane() : renderFetchPane())

      const tipPlacement = tip === null || typeof window === 'undefined'
        ? null
        : tipPlacementFor(tip.rect, { width: window.innerWidth, height: window.innerHeight })

      const tipBubble = tip === null || tipPlacement === null ? null : h('div', {
        key: 'tip',
        className: 'dssw-tipbubble',
        role: 'tooltip',
        'data-tip': tip.text,
        style: {
          left: tipPlacement.left + 'px',
          top: tipPlacement.top + 'px',
          transform: tipPlacement.transform,
        },
      }, tip.text)

      /** Render one trigger pill. */
      const renderTrigger = function (kind, ref, sourceLabel, valueLabel, warning) {
        const open = menuKind === kind
        return h('button', {
          key: kind,
          ref: ref,
          type: 'button',
          className: 'dssw-pill' + (open ? ' dssw-pill--open' : ''),
          'aria-haspopup': 'menu',
          'aria-expanded': open ? 'true' : 'false',
          'aria-label': sourceLabel + ': ' + valueLabel,
          'data-trigger': kind,
          'data-value': kind === 'search' ? state.searchSource : state.fetchSource,
          title: warning ? t('key.' + warning + 'Missing') : sourceLabel + ': ' + valueLabel,
          disabled: !writable || busy,
          onClick: function () {
            if (open) {
              closeMenu()
              return
            }
            openMenu(kind)
          },
          onKeyDown: function (event) {
            if (event.key === 'ArrowDown' && !open) {
              event.preventDefault()
              openMenu(kind)
            }
          },
        }, [
          h('span', { key: 'label', className: 'dssw-pill-label' }, sourceLabel),
          h('span', { key: 'value', className: 'dssw-pill-value' }, valueLabel),
          warning ? h('span', {
            key: 'dot',
            className: 'dssw-dot',
            title: t('key.' + warning + 'Missing'),
            'aria-label': t('key.' + warning + 'Missing'),
          }) : null,
          h('span', { key: 'caret', className: 'dssw-pill-caret', 'aria-hidden': 'true' }, '\u25be'),
        ])
      }

      return h('div', { className: 'dssw-root', 'data-dsh-search-switch': '1' }, [
        renderTrigger('search', searchTriggerRef, t('label.search'), t('source.' + state.searchSource),
          missing === 'tavily' || missing === 'jina' ? missing : null),
        renderTrigger('fetch', fetchTriggerRef, t('label.fetch'), t('source.' + state.fetchSource),
          missing === 'jinaApi' ? missing : null),
        menu,
        tipBubble,
        failed ? h('span', {
          key: 'failed',
          className: 'dssw-status',
          role: 'status',
          'aria-live': 'polite',
        }, t('status.failed')) : null,
      ])
    }

    /* ------------------------------------------------------------------ *
     * Plugin configuration card
     * ------------------------------------------------------------------ */

    /**
     * One provider key row: name, credential reference, state, input, and save.
     * Each row owns its busy/saved/error lane so one failed write never hides
     * the other keys.
     */
    function KeyRow(props) {
      const t = props.t
      const credentials = props.credentials
      const reference = props.reference
      const status = props.status
      const pairDraft = React.useState('')
      const draft = pairDraft[0]
      const setDraft = pairDraft[1]
      const pairBusy = React.useState(false)
      const busy = pairBusy[0]
      const setBusy = pairBusy[1]
      const pairSaved = React.useState(false)
      const saved = pairSaved[0]
      const setSaved = pairSaved[1]
      const pairError = React.useState(null)
      const error = pairError[0]
      const setError = pairError[1]

      const readOnly = status !== null && status !== undefined && status.writable === false
      const configured = status !== null && status !== undefined && status.configured === true

      const save = function () {
        const value = draft.trim()
        if (value.length === 0 || busy || !credentials) return
        setBusy(true)
        setError(null)
        setSaved(false)
        Promise.resolve(credentials.set(reference, value)).then(function (response) {
          if (response && response.ok === false) {
            const detail = response.error && response.error.message ? response.error.message : ''
            throw new Error(detail.length > 0 ? detail : t('settings.failed'))
          }
          setDraft('')
          setSaved(true)
          if (typeof props.onSaved === 'function') props.onSaved(reference, value)
        }, function (reason) {
          throw reason
        }).catch(function (reason) {
          const detail = reason && reason.message ? reason.message : String(reason)
          setError(t('settings.failed') + detail)
        }).then(function () {
          setBusy(false)
        })
      }

      return h('div', { className: 'dssw-key-row', 'data-key-row': props.provider }, [
        h('div', { key: 'meta', className: 'dssw-key-meta' }, [
          h('span', { key: 'name', className: 'dssw-key-name' }, t(props.labelKey)),
          h('span', { key: 'ref', className: 'dssw-key-ref' }, reference),
          status !== null && status !== undefined ? h('span', {
            key: 'state',
            className: 'dssw-key-state' + (configured ? ' dssw-key-state--set' : ''),
            role: 'status',
          }, configured ? t('settings.keySet') : t('settings.keyUnset')) : null,
        ]),
        h('div', { key: 'control', className: 'dssw-key-control' }, [
          h('input', {
            key: 'input',
            className: 'dssw-input',
            type: 'password',
            autoComplete: 'new-password',
            spellCheck: false,
            value: draft,
            disabled: busy || readOnly,
            placeholder: t('settings.keyPlaceholder'),
            'aria-label': t(props.labelKey),
            onChange: function (event) {
              setDraft(event.target.value)
              setSaved(false)
              if (error !== null) setError(null)
            },
          }),
          h('button', {
            key: 'save',
            type: 'button',
            className: 'dssw-btn',
            disabled: busy || readOnly || draft.trim().length === 0,
            onClick: save,
          }, busy ? t('settings.saving') : t('settings.save')),
          saved ? h('span', {
            key: 'saved',
            className: 'dssw-status',
            role: 'status',
            'aria-live': 'polite',
          }, t('settings.saved')) : null,
        ]),
        h('div', { key: 'hint', className: 'dssw-key-hint' }, t(props.hintKey)
          + (readOnly ? ' · ' + t('settings.readonly') : '')),
        error !== null ? h('div', { key: 'error', className: 'dssw-key-error', role: 'alert' }, error) : null,
      ])
    }

    /**
     * One advanced config control. Text and number inputs commit on blur or
     * Enter (never mid-typing); selects and switches commit immediately. The
     * value is validated against the field descriptor before it reaches the
     * host, so a bad number or variable name never lands in the profile.
     */
    function AdvancedField(props) {
      const t = props.t
      const form = props.form
      const spec = props.spec
      const snapshot = useFormSnapshot(form)
      const stored = advancedStored(spec, snapshot)
      const writable = isWritable(snapshot)
      const pairDraft = React.useState(null)
      const draft = pairDraft[0]
      const setDraft = pairDraft[1]
      const pairState = React.useState({ kind: 'idle' })
      const state = pairState[0]
      const setState = pairState[1]
      const timerRef = React.useRef(null)

      React.useEffect(function () {
        return function () {
          if (timerRef.current !== null && typeof clearTimeout === 'function') clearTimeout(timerRef.current)
        }
      }, [])

      const flashSaved = function () {
        setState({ kind: 'saved' })
        if (timerRef.current !== null && typeof clearTimeout === 'function') clearTimeout(timerRef.current)
        if (typeof setTimeout === 'function') {
          timerRef.current = setTimeout(function () { setState({ kind: 'idle' }) }, 1800)
          if (timerRef.current !== null && typeof timerRef.current.unref === 'function') timerRef.current.unref()
        }
      }

      const save = function (value) {
        if (!writable) return
        setState({ kind: 'saving' })
        Promise.resolve(form.set(spec.field, value)).then(function (accepted) {
          if (accepted === false) throw new Error(t('settings.failed'))
          setDraft(null)
          flashSaved()
        }).catch(function (reason) {
          const detail = reason && reason.message ? reason.message : ''
          setState({ kind: 'error', message: detail.length > 0 ? detail : t('settings.failed') })
        })
      }

      const commit = function () {
        const raw = draft === null ? String(stored) : draft
        const result = validateAdvanced(spec, raw)
        if (!result.ok) {
          setState({ kind: 'error', message: t(result.errorKey) })
          return
        }
        if (result.value === stored) {
          setDraft(null)
          setState({ kind: 'idle' })
          return
        }
        save(result.value)
      }

      const label = t(spec.labelKey)
      const hint = spec.hintKey ? t(spec.hintKey) : null
      let control

      if (spec.kind === 'boolean') {
        control = h('button', {
          key: 'control',
          type: 'button',
          role: 'switch',
          'aria-checked': stored ? 'true' : 'false',
          className: 'dssw-toggle',
          disabled: !writable || state.kind === 'saving',
          'data-advanced-field': spec.field,
          onClick: function () { save(!stored) },
        }, [
          h('span', { key: 'label' }, label),
          h('span', {
            key: 'switch',
            className: 'dssw-switch' + (stored ? ' dssw-switch--on' : ''),
            'aria-hidden': 'true',
          }, h('span', { key: 'knob', className: 'dssw-switch-knob' })),
        ])
      } else if (spec.kind === 'select') {
        control = h('select', {
          key: 'control',
          className: 'dssw-input dssw-select',
          value: stored,
          disabled: !writable || state.kind === 'saving',
          'data-advanced-field': spec.field,
          'aria-label': label,
          onChange: function (event) { save(event.target.value) },
        }, spec.options.map(function (option) {
          return h('option', { key: option.value, value: option.value }, t(option.labelKey))
        }))
      } else {
        control = h('div', { key: 'control', className: 'dssw-field-control' }, [
          h('input', {
            key: 'input',
            className: 'dssw-input',
            type: 'text',
            inputMode: spec.kind === 'number' ? 'numeric' : undefined,
            autoComplete: 'off',
            spellCheck: false,
            value: draft === null ? String(stored) : draft,
            disabled: !writable || state.kind === 'saving',
            placeholder: spec.placeholderKey ? t(spec.placeholderKey) : '',
            'data-advanced-field': spec.field,
            'aria-label': label,
            'aria-invalid': state.kind === 'error' ? 'true' : undefined,
            onChange: function (event) {
              setDraft(event.target.value)
              if (state.kind === 'error') setState({ kind: 'idle' })
            },
            onBlur: commit,
            onKeyDown: function (event) {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit()
              } else if (event.key === 'Escape') {
                setDraft(null)
                setState({ kind: 'idle' })
              }
            },
          }),
          spec.unitKey ? h('span', { key: 'unit', className: 'dssw-field-unit' }, t(spec.unitKey)) : null,
        ])
      }

      const note = state.kind === 'error'
        ? h('span', { key: 'note', className: 'dssw-field-error', role: 'alert' }, state.message)
        : state.kind === 'saved'
          ? h('span', { key: 'note', className: 'dssw-field-saved' }, t('settings.saved'))
          : hint !== null
            ? h('span', { key: 'note', className: 'dssw-field-hint' }, hint)
            : null

      return h('div', { className: 'dssw-field', 'data-field': spec.field }, [
        spec.kind === 'boolean' ? null : h('div', { key: 'label-row', className: 'dssw-field-label' }, [
          h('span', { key: 'label' }, label),
          state.kind === 'saving' ? h('span', { key: 'saving', className: 'dssw-field-hint' }, t('settings.saving')) : null,
        ]),
        control,
        note,
      ])
    }

    /**
     * The Plugins-page card: current route, the three provider keys, and a
     * collapsible advanced panel for budgets, provider behavior, endpoints, and
     * credential variable names.
     */
    function SettingsCard(props) {
      const t = props.t
      const form = props.form
      const credentials = props.credentials
      const snapshot = useFormSnapshot(form)
      const state = readUiState(snapshot, UNKNOWN_KEY_STATES)
      const refs = keyRefs(snapshot)
      const writable = isWritable(snapshot)
      const pairStatus = React.useState(null)
      const status = pairStatus[0]
      const setStatus = pairStatus[1]
      const pairResetArmed = React.useState(false)
      const resetArmed = pairResetArmed[0]
      const setResetArmed = pairResetArmed[1]
      const pairResetState = React.useState({ kind: 'idle' })
      const resetState = pairResetState[0]
      const setResetState = pairResetState[1]
      const pairResetToken = React.useState(0)
      const resetToken = pairResetToken[0]
      const setResetToken = pairResetToken[1]
      const resetTimer = React.useRef(null)

      const refresh = React.useCallback(function () {
        if (!credentials || typeof credentials.describe !== 'function') return Promise.resolve(null)
        const names = [refs.tavily, refs.jina, refs.firecrawl]
        return Promise.resolve(credentials.describe(names)).then(function (response) {
          const values = response && response.ok && response.value ? response.value : {}
          const next = {}
          for (const provider of ['tavily', 'jina', 'firecrawl']) {
            const view = values[refs[provider]]
            next[provider] = view
              ? { configured: view.configured === true, writable: view.writable !== false }
              : { configured: false, writable: true }
          }
          setStatus(next)
          return next
        }, function () {
          setStatus(null)
          return null
        })
      }, [credentials, refs.tavily, refs.jina, refs.firecrawl, setStatus])

      React.useEffect(function () {
        refresh()
      }, [refresh])

      React.useEffect(function () {
        return function () {
          if (resetTimer.current !== null && typeof clearTimeout === 'function') clearTimeout(resetTimer.current)
        }
      }, [])

      if (props.view === 'summary') return t('settings.summary')

      const statusFor = function (provider) {
        return status === null ? null : status[provider]
      }

      const configured = function (provider) {
        return status !== null && status[provider] !== undefined && status[provider].configured === true
      }
      const keyWarning = status === null
        ? null
        : state.searchSource === 'tavily' && !configured('tavily') ? 'key.tavilyMissing'
          : state.searchSource === 'jina' && !configured('jina') ? 'key.jinaMissing'
            : state.fetchSource === 'jina' && state.jinaMode === 'api' && !configured('jina') ? 'key.jinaApiMissing'
              : null

      const disarmReset = function () {
        setResetArmed(false)
        if (resetTimer.current !== null && typeof clearTimeout === 'function') {
          clearTimeout(resetTimer.current)
          resetTimer.current = null
        }
      }

      const armOrReset = function () {
        if (!writable || resetState.kind === 'working') return
        if (!resetArmed) {
          setResetArmed(true)
          if (typeof setTimeout === 'function') {
            resetTimer.current = setTimeout(function () {
              setResetArmed(false)
              setResetState({ kind: 'idle' })
            }, 5000)
            if (resetTimer.current !== null && typeof resetTimer.current.unref === 'function') resetTimer.current.unref()
          }
          return
        }
        disarmReset()
        setResetState({ kind: 'working' })
        let chain = Promise.resolve()
        for (const spec of ADVANCED_RESET_FIELDS) {
          chain = chain.then(function () {
            return Promise.resolve(form.set(spec.field, spec.def)).then(function (accepted) {
              if (accepted === false) throw new Error(t('settings.failed'))
            })
          })
        }
        chain.then(function () {
          setResetToken(function (previous) { return previous + 1 })
          setResetState({ kind: 'done' })
        }).catch(function (reason) {
          const detail = reason && reason.message ? reason.message : ''
          setResetState({ kind: 'error', message: t('settings.advancedResetFailed') + detail })
        })
      }

      const renderFields = function (section) {
        return h('div', { key: 'grid', className: 'dssw-field-grid' }, section.fields.map(function (spec) {
          return h(AdvancedField, { key: spec.field + ':' + resetToken, spec: spec, form: form, t: t })
        }))
      }

      const renderSection = function (section) {
        if (section.collapsible) {
          return h('details', {
            key: section.id,
            className: 'dssw-subgroup',
            'data-advanced-section': section.id,
          }, [
            h('summary', { key: 'summary' }, [
              h('span', { key: 'chevron', className: 'dssw-adv-chevron', 'aria-hidden': 'true' }, '\u203a'),
              h('span', { key: 'title' }, t(section.titleKey)),
              section.hintKey ? h('span', { key: 'hint', className: 'dssw-adv-hint' }, t(section.hintKey)) : null,
            ]),
            h('div', { key: 'body', className: 'dssw-subgroup-body' }, renderFields(section)),
          ])
        }
        return h('section', {
          key: section.id,
          className: 'dssw-section',
          'data-advanced-section': section.id,
        }, [
          h('div', { key: 'title', className: 'dssw-section-title' }, t(section.titleKey)),
          section.hintKey ? h('div', { key: 'hint', className: 'dssw-section-hint' }, t(section.hintKey)) : null,
          renderFields(section),
        ])
      }

      const advanced = h('details', { key: 'advanced', className: 'dssw-advanced', 'data-advanced': '1' }, [
        h('summary', { key: 'summary' }, [
          h('span', { key: 'chevron', className: 'dssw-adv-chevron', 'aria-hidden': 'true' }, '\u203a'),
          h('span', { key: 'title' }, t('settings.advanced')),
          h('span', { key: 'hint', className: 'dssw-adv-hint' }, t('settings.advancedHint')),
        ]),
        h('div', { key: 'body', className: 'dssw-advanced-body' }, [
          ...ADVANCED_SECTIONS.map(renderSection),
          h('div', { key: 'reset', className: 'dssw-reset' }, [
            h('button', {
              key: 'button',
              type: 'button',
              className: 'dssw-btn dssw-btn--quiet' + (resetArmed ? ' dssw-btn--danger' : ''),
              disabled: !writable || resetState.kind === 'working',
              'data-advanced-reset': '1',
              onClick: armOrReset,
            }, resetState.kind === 'working'
              ? t('settings.advancedResetWorking')
              : resetArmed ? t('settings.advancedResetConfirm') : t('settings.advancedReset')),
            h('span', { key: 'note', className: 'dssw-reset-note' }, t('settings.advancedResetHint')),
            resetState.kind === 'done' ? h('span', {
              key: 'done',
              className: 'dssw-status',
              role: 'status',
              'aria-live': 'polite',
            }, t('settings.advancedResetDone')) : null,
            resetState.kind === 'error' ? h('span', {
              key: 'error',
              className: 'dssw-error',
              role: 'alert',
            }, resetState.message) : null,
          ]),
        ]),
      ])

      return h('div', { className: 'dssw-card', 'data-settings': '1' }, [
        h('div', { key: 'head', className: 'dssw-settings-head' }, [
          h('div', { key: 'route', className: 'dssw-route' }, [
            h('span', { key: 'search', className: 'dssw-route-chip' }, t('label.search') + ' · ' + t('source.' + state.searchSource)),
            h('span', { key: 'fetch', className: 'dssw-route-chip' }, t('label.fetch') + ' · ' + t('source.' + state.fetchSource)),
            h('span', { key: 'fallback', className: 'dssw-route-chip' }, t('row.fetchFallback') + ' · ' + (state.fallback ? t('settings.on') : t('settings.off'))),
            h('span', { key: 'global', className: 'dssw-route-chip' }, t('settings.global')),
          ]),
          h('div', { key: 'scope', className: 'dssw-card-hint' }, t('settings.scope')),
          keyWarning !== null ? h('div', { key: 'warning', className: 'dssw-warn', role: 'status' }, t(keyWarning)) : null,
          !writable ? h('div', { key: 'readonly', className: 'dssw-error' }, t('settings.configReadonly')) : null,
        ]),
        h('section', {
          key: 'credentials',
          className: 'dssw-section',
          'data-settings-section': 'credentials',
        }, [
          h('div', { key: 'title', className: 'dssw-section-title' }, t('settings.credentials')),
          h('div', { key: 'hint', className: 'dssw-section-hint' }, t('settings.credentialsHint')),
          h('div', { key: 'list', className: 'dssw-key-list' }, [
            h(KeyRow, {
              key: 'tavily',
              provider: 'tavily',
              labelKey: 'settings.tavilyKey',
              hintKey: 'settings.tavilyHint',
              reference: refs.tavily,
              status: statusFor('tavily'),
              credentials: credentials,
              t: t,
              onSaved: refresh,
            }),
            h(KeyRow, {
              key: 'jina',
              provider: 'jina',
              labelKey: 'settings.jinaKey',
              hintKey: 'settings.jinaHint',
              reference: refs.jina,
              status: statusFor('jina'),
              credentials: credentials,
              t: t,
              onSaved: refresh,
            }),
            h(KeyRow, {
              key: 'firecrawl',
              provider: 'firecrawl',
              labelKey: 'settings.firecrawlKey',
              hintKey: 'settings.firecrawlHint',
              reference: refs.firecrawl,
              status: statusFor('firecrawl'),
              credentials: credentials,
              t: t,
              onSaved: refresh,
            }),
          ]),
        ]),
        advanced,
      ])
    }

    /* ------------------------------------------------------------------ *
     * Plugin entry
     * ------------------------------------------------------------------ */

    /**
     * Mount the composer control and the configuration card.
     * @param ctx - the browser plugin context.
     */
    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en })
      }, 'dsh-search-switch: dictionaries')
      ctx.effect(installStyles, 'dsh-search-switch: styles')

      const form = ctx.configForms.get(NAMESPACE)
      const credentials = ctx.remote.credentials
      const inject = function () {
        return { t: t, form: form, credentials: credentials }
      }

      // The control only exists while the host serves this plugin's namespace,
      // so a disabled or uninstalled row leaves no trace in the composer.
      // `whileServed` hands back the registration's disposer; the caller owns it,
      // so it rides this fiber through ctx.effect.
      ctx.effect(function () {
        return ctx.configForms.whileServed([NAMESPACE], function () {
          return ctx.slots.inject('conversation.input.left', function () {
            return ctx.slots.register({
              name: 'conversation.input.left',
              id: 'search-provider',
              order: 10,
              label: function () { return t('label.search') + ' / ' + t('label.fetch') },
              locale: NS,
              inject: inject,
            }, SearchSwitch)
          })
        })
      }, 'dsh-search-switch: composer control')

      ctx.slots.inject('plugins.bundle.config', function () {
        return ctx.slots.register({
          name: 'plugins.bundle.config',
          key: 'dsh-search-switch',
          locale: NS,
          inject: inject,
        }, SettingsCard)
      })
    }

    exports.name = 'search-switch'
    exports.inject = ['slots', 'locale', 'configForms', 'remote', 'remote.credentials']
    exports.apply = apply
    exports.NS = NS
    /** Pure readers exposed for the register/dispose test lane. */
    exports.__internals = {
      NAMESPACE: NAMESPACE,
      SEARCH_OPTIONS: SEARCH_OPTIONS,
      FETCH_OPTIONS: FETCH_OPTIONS,
      DEPTH_OPTIONS: DEPTH_OPTIONS,
      EXTRA_DEPTH_OPTIONS: EXTRA_DEPTH_OPTIONS,
      JINA_KEY_MODES: JINA_KEY_MODES,
      JINA_RESPOND_WITH: JINA_RESPOND_WITH,
      readSearchSource: readSearchSource,
      readFetchSource: readFetchSource,
      readDepth: readDepth,
      readJinaReaderKeyMode: readJinaReaderKeyMode,
      readJinaRespondWith: readJinaRespondWith,
      readFallback: readFallback,
      isWritable: isWritable,
      keyRefs: keyRefs,
      missingKeyProvider: missingKeyProvider,
      searchMenuModel: searchMenuModel,
      fetchMenuModel: fetchMenuModel,
      searchRootRows: searchRootRows,
      fetchRootRows: fetchRootRows,
      menuPlacementFor: menuPlacementFor,
      tipPlacementFor: tipPlacementFor,
      MENU_WIDTH: MENU_WIDTH,
      ADVANCED_SECTIONS: ADVANCED_SECTIONS,
      ADVANCED_FIELDS: ADVANCED_FIELDS,
      ADVANCED_DEFAULTS: ADVANCED_DEFAULTS,
      ADVANCED_RESET_FIELDS: ADVANCED_RESET_FIELDS,
      validateAdvanced: validateAdvanced,
      advancedStored: advancedStored,
    }

    return module.exports
  },
})
