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
    const SEARCH_OPTIONS = ['deepseek', 'tavily', 'jina', 'firecrawl']
    /** Fetch backends the host config accepts. */
    const FETCH_OPTIONS = ['jina', 'local', 'firecrawl']
    /** The two Tavily quality tiers. */
    const DEPTH_OPTIONS = ['basic', 'advanced']
    /** The Tavily latency tiers, shown in the same search popover. */
    const EXTRA_DEPTH_OPTIONS = ['fast', 'ultra-fast']
    /** Every depth the host config accepts. */
    const ALL_DEPTH_OPTIONS = DEPTH_OPTIONS.concat(EXTRA_DEPTH_OPTIONS)
    /** Jina Reader key modes. */
    const JINA_KEY_MODES = ['anonymous', 'auto', 'api']

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
      'source.deepseek': 'Native',
      'source.tavily': 'Tavily',
      'source.jina': 'Jina',
      'source.firecrawl': 'Firecrawl',
      'source.local': 'Local',
      'tip.search.deepseek': 'DSH native search: uses the DeepSeek account or key, never bills Tavily',
      'tip.search.tavily': 'Tavily search: uses the Tavily API key and spends Tavily credits per search',
      'tip.search.jina': 'Jina search: requires JINA_API_KEY (anonymous calls are rejected)',
      'tip.search.firecrawl': 'Firecrawl search: works anonymously, a key raises the quota',
      'tip.fetch.jina': 'Jina Reader: free URL→markdown service, the default fetch route',
      'tip.fetch.local': 'Local DSH fetcher: no third party, public pages only',
      'tip.fetch.firecrawl': 'Firecrawl: rendered pages and hardened anti-bot sites, works anonymously',
      'depth.heading': 'Tavily depth',
      'depth.basic': 'Basic',
      'depth.advanced': 'Advanced',
      'depth.fast': 'Fast',
      'depth.ultra-fast': 'Ultra fast',
      'tip.depth.basic': 'Basic: lower latency, 1 credit per search',
      'tip.depth.advanced': 'Advanced: higher relevance and longer snippets, 2 credits per search',
      'tip.depth.fast': 'Fast: prioritises low latency, 1 credit per search',
      'tip.depth.ultra-fast': 'Ultra fast: lowest latency, one summary per URL, 1 credit per search',
      'jinaMode.heading': 'Jina key mode',
      'jinaMode.anonymous': 'Anonymous',
      'jinaMode.auto': 'Auto',
      'jinaMode.api': 'API key',
      'tip.jinaMode.anonymous': 'Anonymous Reader: no key, 20 requests per minute',
      'tip.jinaMode.auto': 'Auto: use JINA_API_KEY when one is configured, otherwise anonymous',
      'tip.jinaMode.api': 'API key: always send JINA_API_KEY (500 RPM, billed in tokens)',
      'toggle.fallback': 'Fall back to local fetch',
      'tip.fallback': 'When the third-party fetcher fails, retry once with the local DSH fetcher',
      'toggle.on': 'On',
      'toggle.off': 'Off',
      'key.tavilyMissing': 'No Tavily API key configured',
      'key.jinaMissing': 'Jina search needs an API key',
      'key.jinaApiMissing': 'Jina API mode needs an API key',
      'key.firecrawlMissing': 'No Firecrawl key; anonymous requests share a small pool',
      'status.failed': 'Switch failed, please retry',
      'settings.summary': 'Pick the search and fetch providers and store the provider API keys.',
      'settings.current': 'Current',
      'settings.scope': 'Both switches apply to every session. Tavily Advanced spends 2 credits per search; Jina and Firecrawl bill per request or token.',
      'settings.keys': 'Provider API keys',
      'settings.tavilyKey': 'Tavily API key',
      'settings.jinaKey': 'Jina API key',
      'settings.firecrawlKey': 'Firecrawl API key',
      'settings.tavilyHint': 'Required for Tavily search. Stored in the credential store (TAVILY_API_KEY), never in the settings file.',
      'settings.jinaHint': 'Optional for Jina Reader (free and anonymous by default); required for Jina search. Stored as JINA_API_KEY.',
      'settings.firecrawlHint': 'Optional: Firecrawl answers anonymous requests. A key raises the quota and is stored as FIRECRAWL_API_KEY.',
      'settings.keyPlaceholder': 'Enter a new API key',
      'settings.keySet': 'Configured',
      'settings.keyUnset': 'Not configured',
      'settings.readonly': 'Credentials are read-only in this deployment, so keys cannot be saved here.',
      'settings.save': 'Save',
      'settings.saving': 'Saving…',
      'settings.saved': 'Saved',
      'settings.failed': 'Save failed: ',
    }

    /** Simplified Chinese copy. */
    const zh = {
      'label.search': '网页搜索',
      'label.fetch': '网页抓取',
      'menu.search': '搜索提供商',
      'menu.fetch': '抓取提供商',
      'source.deepseek': '原生',
      'source.tavily': 'Tavily',
      'source.jina': 'Jina',
      'source.firecrawl': 'Firecrawl',
      'source.local': '本地',
      'tip.search.deepseek': 'DSH 原生搜索：使用 DeepSeek 账号或密钥，不产生 Tavily 费用',
      'tip.search.tavily': 'Tavily 搜索：使用 Tavily API Key，并按次消耗 Tavily 积分',
      'tip.search.jina': 'Jina 搜索：需要 JINA_API_KEY（匿名请求会被拒绝）',
      'tip.search.firecrawl': 'Firecrawl 搜索：可匿名使用，配 key 提升额度',
      'tip.fetch.jina': 'Jina Reader：免 key 的 url→markdown 服务，默认抓取套路',
      'tip.fetch.local': 'DSH 内置 http 抓取：不经过第三方，只读公开网页',
      'tip.fetch.firecrawl': 'Firecrawl：抓取渲染页与硬反爬站点，可匿名使用',
      'depth.heading': 'Tavily 搜索强度',
      'depth.basic': '基础',
      'depth.advanced': '高级',
      'depth.fast': '快速',
      'depth.ultra-fast': '极速',
      'tip.depth.basic': '基础：延迟更低，每次搜索 1 积分',
      'tip.depth.advanced': '高级：相关度更高、片段更长，每次搜索 2 积分',
      'tip.depth.fast': '快速：优先低延迟，每次搜索 1 积分',
      'tip.depth.ultra-fast': '极速：最低延迟，每个 URL 只返回一个摘要，每次搜索 1 积分',
      'jinaMode.heading': 'Jina key 模式',
      'jinaMode.anonymous': '匿名',
      'jinaMode.auto': '自动',
      'jinaMode.api': 'API Key',
      'tip.jinaMode.anonymous': '匿名 Reader：不需要 key，每分钟 20 次请求',
      'tip.jinaMode.auto': '自动：已配置 JINA_API_KEY 时使用，否则匿名',
      'tip.jinaMode.api': 'API Key：始终发送 JINA_API_KEY（500 RPM，按 token 计费）',
      'toggle.fallback': '抓取失败自动回落本地',
      'tip.fallback': '第三方抓取失败时，自动改用 DSH 本地抓取再试一次',
      'toggle.on': '开',
      'toggle.off': '关',
      'key.tavilyMissing': '未配置 Tavily API Key',
      'key.jinaMissing': 'Jina 搜索需要 API Key',
      'key.jinaApiMissing': 'Jina API 模式需要 API Key',
      'key.firecrawlMissing': '未配置 Firecrawl Key；匿名请求额度较小',
      'status.failed': '切换失败，请重试',
      'settings.summary': '选择搜索与抓取提供商，并配置各家 API Key。',
      'settings.current': '当前',
      'settings.scope': '两个开关对所有会话生效；Tavily 高级每次 2 积分，Jina 与 Firecrawl 按请求或 token 计费。',
      'settings.keys': '提供商 API Key',
      'settings.tavilyKey': 'Tavily API Key',
      'settings.jinaKey': 'Jina API Key',
      'settings.firecrawlKey': 'Firecrawl API Key',
      'settings.tavilyHint': 'Tavily 搜索必填。保存在凭据库（TAVILY_API_KEY），不会写入设置文件。',
      'settings.jinaHint': 'Jina Reader 可选（默认免费匿名）；Jina 搜索必填。保存在 JINA_API_KEY。',
      'settings.firecrawlHint': '可选：Firecrawl 支持匿名请求，配 key 可提升额度。保存在 FIRECRAWL_API_KEY。',
      'settings.keyPlaceholder': '填入新的 API Key',
      'settings.keySet': '已配置',
      'settings.keyUnset': '未配置',
      'settings.readonly': '本部署的凭据为只读，无法在这里保存密钥。',
      'settings.save': '保存',
      'settings.saving': '保存中…',
      'settings.saved': '已保存',
      'settings.failed': '保存失败：',
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
     * Build the search popover model: providers plus the Tavily depth tiers.
     * Pure so the register lane can assert every combination without a browser.
     */
    function searchMenuModel(state) {
      return {
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
     * Build the fetch popover model: providers, the Jina key mode, and the
     * local-fallback toggle.
     */
    function fetchMenuModel(state) {
      return {
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
        fallback: state.fallback,
        fallbackApplies: state.fetchSource !== 'local',
      }
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
      '.dssw-menu{position:fixed;z-index:1000;box-sizing:border-box;max-height:calc(100vh - 16px);overflow:auto;display:flex;flex-direction:column;gap:2px;padding:6px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);box-shadow:var(--dsw-elevation-soft);color:var(--dsw-alias-label-primary)}',
      '.dssw-menu-heading{padding:4px 8px 2px;font-size:11px;line-height:16px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-tertiary)}',
      '.dssw-menu-sep{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1)}',
      '.dssw-menu-item{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:inherit;font:inherit;font-size:12px;line-height:18px;text-align:left;cursor:pointer}',
      '.dssw-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dssw-menu-item:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}',
      '.dssw-menu-item--on{background:var(--dsw-alias-button-tool-bar-fill)}',
      '.dssw-menu-label{flex:none;min-width:64px;font-weight:500}',
      '.dssw-menu-tip{flex:1;min-width:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}',
      '.dssw-menu-check{flex:none;color:var(--dsw-alias-label-secondary)}',
      '.dssw-status{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}',
      '.dssw-card{display:flex;flex-direction:column;gap:10px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);max-width:560px}',
      '.dssw-card-row{display:flex;flex-direction:column;gap:4px}',
      '.dssw-card-label{font-weight:500}',
      '.dssw-card-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
      '.dssw-key{border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);padding:8px 10px;display:flex;flex-direction:column;gap:6px}',
      '.dssw-input{box-sizing:border-box;height:30px;padding:0 8px;font:inherit;font-size:13px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:transparent;color:inherit}',
      '.dssw-input:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:0}',
      '.dssw-actions{display:flex;align-items:center;gap:8px}',
      '.dssw-btn{height:28px;padding:0 12px;font:inherit;font-size:12px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-button-tool-bar-fill);color:var(--dsw-alias-label-primary);cursor:pointer}',
      '.dssw-btn:hover:not(:disabled){background:var(--dsw-alias-button-tool-bar-hover)}',
      '.dssw-btn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}',
      '.dssw-btn:disabled{opacity:.5;cursor:not-allowed}',
      '.dssw-error{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}',
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
    const MENU_WIDTH = 320
    /** Height estimates used for the first paint, before the menu is measured. */
    const MENU_ESTIMATED_HEIGHT = { search: 360, fetch: 250 }
    /** Minimum distance kept between the popover and a viewport edge. */
    const MENU_MARGIN = 8
    /** Gap between the trigger and the popover. */
    const MENU_GAP = 6

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

    /* ------------------------------------------------------------------ *
     * Composer control
     * ------------------------------------------------------------------ */

    /** Read the current UI state out of one settings snapshot. */
    function readUiState(snapshot, keyStates) {
      return {
        searchSource: readSearchSource(snapshot),
        fetchSource: readFetchSource(snapshot),
        depth: readDepth(snapshot),
        jinaMode: readJinaReaderKeyMode(snapshot),
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
      const pairMenuPos = React.useState(null)
      const menuPos = pairMenuPos[0]
      const setMenuPos = pairMenuPos[1]
      const searchTriggerRef = React.useRef(null)
      const fetchTriggerRef = React.useRef(null)
      const menuRef = React.useRef(null)

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
        setMenuKind(kind)
      }

      // Dismiss the popover on outside press, Escape, scroll, or resize.
      React.useEffect(function () {
        if (menuKind === null) return function () {}
        if (typeof document === 'undefined' || typeof window === 'undefined') return function () {}
        const dismiss = function () { setMenuKind(null) }
        const onPointerDown = function (event) {
          if (searchTriggerRef.current && searchTriggerRef.current.contains(event.target)) return
          if (fetchTriggerRef.current && fetchTriggerRef.current.contains(event.target)) return
          if (menuRef.current && menuRef.current.contains(event.target)) return
          dismiss()
        }
        const onKeyDown = function (event) {
          if (event.key !== 'Escape') return
          event.stopPropagation()
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
      }, [menuKind, setMenuKind])

      // Move focus into the popover when it opens.
      React.useEffect(function () {
        if (menuKind === null || !menuRef.current) return
        const items = menuRef.current.querySelectorAll('[data-menu-item]')
        if (items.length > 0) items[0].focus()
      }, [menuKind])

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
      }, [menuKind, setMenuPos])

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
        }
      }

      /** Shared renderer for one radio row inside a popover. */
      const renderOption = function (option, dataAttributes, onSelect) {
        const attributes = Object.assign({
          key: option.id,
          type: 'button',
          role: 'menuitemradio',
          'aria-checked': option.selected ? 'true' : 'false',
          'data-menu-item': option.id,
          className: 'dssw-menu-item' + (option.selected ? ' dssw-menu-item--on' : ''),
          onClick: onSelect,
        }, dataAttributes)
        return h('button', attributes, [
          h('span', { key: 'label', className: 'dssw-menu-label' }, t(option.labelKey)),
          h('span', { key: 'tip', className: 'dssw-menu-tip' }, t(option.tipKey)),
          option.keyMissing ? h('span', {
            key: 'dot',
            className: 'dssw-dot',
            'aria-hidden': 'true',
          }) : null,
          option.selected ? h('span', {
            key: 'check',
            className: 'dssw-menu-check',
            'aria-hidden': 'true',
          }, '\u2713') : null,
        ])
      }

      const searchModel = searchMenuModel(state)
      const fetchModel = fetchMenuModel(state)

      const searchMenu = menuKind === 'search' ? h('div', {
        key: 'search-menu',
        ref: menuRef,
        className: 'dssw-menu',
        role: 'menu',
        'aria-label': t('menu.search'),
        'data-menu': 'search',
        onKeyDown: onMenuKeyDown,
        style: menuPos === null
          ? { top: '0px', left: '0px', width: MENU_WIDTH + 'px' }
          : { top: menuPos.top + 'px', left: menuPos.left + 'px', width: (menuPos.width || MENU_WIDTH) + 'px' },
      }, [
        h('div', { key: 'heading', className: 'dssw-menu-heading' }, t('menu.search')),
        ...searchModel.providers.map(function (option) {
          return renderOption(option, { 'data-search-source': option.id }, function () {
            if (!option.selected) choose('active', option.id)
            setMenuKind(null)
            if (searchTriggerRef.current) searchTriggerRef.current.focus()
          })
        }),
        searchModel.depths.length > 0 ? h('div', { key: 'sep-depth', className: 'dssw-menu-sep' }) : null,
        searchModel.depths.length > 0 ? h('div', { key: 'depth-heading', className: 'dssw-menu-heading' }, t('depth.heading')) : null,
        ...searchModel.depths.map(function (option) {
          return renderOption(option, { 'data-depth': option.id }, function () {
            if (!option.selected) choose('tavilySearchDepth', option.id)
            setMenuKind(null)
            if (searchTriggerRef.current) searchTriggerRef.current.focus()
          })
        }),
      ]) : null

      const fetchMenu = menuKind === 'fetch' ? h('div', {
        key: 'fetch-menu',
        ref: menuRef,
        className: 'dssw-menu',
        role: 'menu',
        'aria-label': t('menu.fetch'),
        'data-menu': 'fetch',
        onKeyDown: onMenuKeyDown,
        style: menuPos === null
          ? { top: '0px', left: '0px', width: MENU_WIDTH + 'px' }
          : { top: menuPos.top + 'px', left: menuPos.left + 'px', width: (menuPos.width || MENU_WIDTH) + 'px' },
      }, [
        h('div', { key: 'heading', className: 'dssw-menu-heading' }, t('menu.fetch')),
        ...fetchModel.providers.map(function (option) {
          return renderOption(option, { 'data-fetch-source': option.id }, function () {
            if (!option.selected) choose('fetchSource', option.id)
            setMenuKind(null)
            if (fetchTriggerRef.current) fetchTriggerRef.current.focus()
          })
        }),
        fetchModel.jinaModes.length > 0 ? h('div', { key: 'sep-mode', className: 'dssw-menu-sep' }) : null,
        fetchModel.jinaModes.length > 0 ? h('div', { key: 'mode-heading', className: 'dssw-menu-heading' }, t('jinaMode.heading')) : null,
        ...fetchModel.jinaModes.map(function (option) {
          return renderOption(option, { 'data-jina-mode': option.id }, function () {
            if (!option.selected) choose('jinaReaderKeyMode', option.id)
            setMenuKind(null)
            if (fetchTriggerRef.current) fetchTriggerRef.current.focus()
          })
        }),
        fetchModel.fallbackApplies ? h('div', { key: 'sep-fallback', className: 'dssw-menu-sep' }) : null,
        fetchModel.fallbackApplies ? h('button', {
          key: 'fallback',
          type: 'button',
          role: 'menuitemcheckbox',
          'aria-checked': fetchModel.fallback ? 'true' : 'false',
          'data-menu-item': 'fallback',
          'data-fallback': fetchModel.fallback ? 'on' : 'off',
          className: 'dssw-menu-item' + (fetchModel.fallback ? ' dssw-menu-item--on' : ''),
          onClick: function () {
            choose('fetchFallbackToLocal', !fetchModel.fallback)
            setMenuKind(null)
            if (fetchTriggerRef.current) fetchTriggerRef.current.focus()
          },
        }, [
          h('span', { key: 'label', className: 'dssw-menu-label' }, t('toggle.fallback')),
          h('span', { key: 'tip', className: 'dssw-menu-tip' }, t('tip.fallback')),
          h('span', { key: 'state', className: 'dssw-menu-check' }, fetchModel.fallback ? t('toggle.on') : t('toggle.off')),
        ]) : null,
      ]) : null

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
              setMenuKind(null)
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
        searchMenu,
        fetchMenu,
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
     * One provider key row: state, input, save, and its own busy/saved/error
     * lane so a failed save never hides the other two keys.
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

      return h('div', { className: 'dssw-key', 'data-key-row': props.provider }, [
        h('label', { key: 'field', className: 'dssw-card-row' }, [
          h('span', { key: 'label', className: 'dssw-card-label' }, t(props.labelKey)),
          h('input', {
            key: 'input',
            className: 'dssw-input',
            type: 'password',
            autoComplete: 'off',
            spellCheck: false,
            value: draft,
            disabled: busy || readOnly,
            placeholder: status !== null && status !== undefined && status.configured
              ? t('settings.keySet')
              : t('settings.keyPlaceholder'),
            onChange: function (event) { setDraft(event.target.value) },
          }),
        ]),
        h('div', { key: 'ref', className: 'dssw-card-hint' }, reference),
        h('div', { key: 'hint', className: 'dssw-card-hint' }, t(props.hintKey)),
        status !== null && status !== undefined ? h('div', {
          key: 'state',
          className: 'dssw-card-hint',
          role: 'status',
        }, status.configured ? t('settings.keySet') : t('settings.keyUnset')) : null,
        readOnly ? h('div', { key: 'readonly', className: 'dssw-card-hint' }, t('settings.readonly')) : null,
        h('div', { key: 'actions', className: 'dssw-actions' }, [
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
        error !== null ? h('div', { key: 'error', className: 'dssw-error', role: 'alert' }, error) : null,
      ])
    }

    /**
     * The Plugins-page card: what is selected and the three provider keys,
     * written through the credentials domain exactly like the official
     * web-search settings page.
     */
    function SettingsCard(props) {
      const t = props.t
      const form = props.form
      const credentials = props.credentials
      const snapshot = useFormSnapshot(form)
      const state = readUiState(snapshot, UNKNOWN_KEY_STATES)
      const refs = keyRefs(snapshot)
      const pairStatus = React.useState(null)
      const status = pairStatus[0]
      const setStatus = pairStatus[1]

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

      if (props.view === 'summary') return t('settings.summary')

      const statusFor = function (provider) {
        return status === null ? null : status[provider]
      }

      return h('div', { className: 'dssw-card' }, [
        h('div', { key: 'current', className: 'dssw-card-row' }, [
          h('span', { key: 'label', className: 'dssw-card-label' }, t('settings.current')),
          h('span', { key: 'value' }, t('label.search') + ': ' + t('source.' + state.searchSource)
            + ' · ' + t('label.fetch') + ': ' + t('source.' + state.fetchSource)),
        ]),
        h('div', { key: 'scope', className: 'dssw-card-hint' }, t('settings.scope')),
        h('div', { key: 'keys-label', className: 'dssw-card-label' }, t('settings.keys')),
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
      readSearchSource: readSearchSource,
      readFetchSource: readFetchSource,
      readDepth: readDepth,
      readJinaReaderKeyMode: readJinaReaderKeyMode,
      readFallback: readFallback,
      isWritable: isWritable,
      keyRefs: keyRefs,
      missingKeyProvider: missingKeyProvider,
      searchMenuModel: searchMenuModel,
      fetchMenuModel: fetchMenuModel,
      menuPlacementFor: menuPlacementFor,
    }

    return module.exports
  },
})
