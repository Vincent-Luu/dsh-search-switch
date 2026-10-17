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

    const SOURCE_OPTIONS = ['deepseek', 'tavily']
    const DEPTH_OPTIONS = ['basic', 'advanced']
    const DEFAULT_SOURCE = 'deepseek'
    const DEFAULT_DEPTH = 'basic'
    const DEFAULT_API_KEY_REF = 'TAVILY_API_KEY'

    /** English copy. */
    const en = {
      'label.source': 'Search source',
      'label.depth': 'Depth',
      'source.deepseek': 'Native',
      'source.tavily': 'Tavily',
      'depth.basic': 'Basic',
      'depth.advanced': 'Advanced',
      'tip.source.deepseek': 'DSH native search: uses the DeepSeek account or key, never bills Tavily',
      'tip.source.tavily': 'Tavily search: uses the Tavily API key and spends Tavily credits per search',
      'tip.depth.basic': 'Basic: lower latency, 1 credit per search',
      'tip.depth.advanced': 'Advanced: higher relevance and longer snippets, 2 credits per search',
      'tip.keyMissing': 'No Tavily API key configured',
      'status.failed': 'Switch failed, please retry',
      'settings.summary': 'Switch the search source and Tavily depth, and store the Tavily API key.',
      'settings.current': 'Current',
      'settings.scope': 'Source and depth apply to every session; Advanced spends 2 credits per search.',
      'settings.key': 'Tavily API key',
      'settings.keyPlaceholder': 'Enter a new API key',
      'settings.keyHint': 'Stored in the credential store (TAVILY_API_KEY), never in the settings file. Leave blank to keep the current key.',
      'settings.keySet': 'A key is configured',
      'settings.keyUnset': 'No key configured; set one before switching to Tavily',
      'settings.readonly': 'Credentials are read-only in this deployment, so the key cannot be saved here.',
      'settings.save': 'Save',
      'settings.saving': 'Saving…',
      'settings.saved': 'Saved',
      'settings.failed': 'Save failed: ',
    }

    /** Simplified Chinese copy. */
    const zh = {
      'label.source': '搜索来源',
      'label.depth': '搜索强度',
      'source.deepseek': '原生',
      'source.tavily': 'Tavily',
      'depth.basic': '基础',
      'depth.advanced': '高级',
      'tip.source.deepseek': 'DSH 原生搜索：使用 DeepSeek 账号或密钥，不产生 Tavily 费用',
      'tip.source.tavily': 'Tavily 搜索：使用 Tavily API Key，并按次消耗 Tavily 积分',
      'tip.depth.basic': '基础：延迟更低，每次搜索 1 积分',
      'tip.depth.advanced': '高级：相关度更高、片段更长，每次搜索 2 积分',
      'tip.keyMissing': '未配置 Tavily API Key',
      'status.failed': '切换失败，请重试',
      'settings.summary': '切换搜索来源与 Tavily 强度，并配置 Tavily API Key。',
      'settings.current': '当前',
      'settings.scope': '来源与强度对所有会话生效；高级强度每次搜索消耗 2 积分。',
      'settings.key': 'Tavily API Key',
      'settings.keyPlaceholder': '填入新的 API Key',
      'settings.keyHint': '保存在凭据库（TAVILY_API_KEY），不会写入设置文件。留空表示保持当前密钥。',
      'settings.keySet': '已配置密钥',
      'settings.keyUnset': '未配置密钥；切到 Tavily 前请先填写',
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

    /** The active source, falling back to the plugin default. */
    function readSource(snapshot) {
      const value = fieldValue(snapshot, 'active')
      return SOURCE_OPTIONS.indexOf(value) >= 0 ? value : DEFAULT_SOURCE
    }

    /**
     * The active Tavily depth, restricted to the two modes this UI exposes.
     * `fast` / `ultra-fast` (config-only) display as Basic without rewriting
     * the stored value.
     */
    function readDepth(snapshot) {
      const value = fieldValue(snapshot, 'tavilySearchDepth')
      return DEPTH_OPTIONS.indexOf(value) >= 0 ? value : DEFAULT_DEPTH
    }

    /** Whether the host accepts writes for this entry right now. */
    function isWritable(snapshot) {
      return snapshot !== null && typeof snapshot === 'object'
        && snapshot.writable === true
        && snapshot.status === 'ready'
    }

    /**
     * Whether the depth group is part of the control at all. Depth only governs
     * Tavily, so selecting the native source removes the group entirely.
     */
    function showsDepth(snapshot) {
      return readSource(snapshot) === 'tavily'
    }

    /** The credential reference the page writes and describes. */
    function apiKeyRef(snapshot) {
      const value = fieldValue(snapshot, 'tavilyApiKeyEnv')
      return typeof value === 'string' && value.length > 0 ? value : DEFAULT_API_KEY_REF
    }

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */

    const STYLE_TAG_ID = 'dsh-search-switch'

    const CSS = [
      '.dssw-root{display:inline-flex;align-items:center;gap:6px;min-width:0}',
      '.dssw-group{display:inline-flex;align-items:center;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);overflow:hidden;background:transparent}',
      '.dssw-group--off{opacity:.55}',
      '.dssw-seg{appearance:none;border:0;margin:0;height:24px;padding:0 8px;font:inherit;font-size:12px;line-height:24px;white-space:nowrap;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color .12s,color .12s}',
      '.dssw-seg:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dssw-seg:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}',
      '.dssw-seg:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}',
      '.dssw-seg--on{background:var(--dsw-alias-button-tool-bar-fill);color:var(--dsw-alias-label-primary);font-weight:500}',
      '.dssw-seg:disabled{cursor:not-allowed;color:var(--dsw-alias-label-tertiary)}',
      '.dssw-status{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}',
      '.dssw-warn{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:0.5px solid var(--dsw-alias-border-l1);font-size:11px;line-height:1;color:var(--dsw-alias-label-secondary);cursor:help}',
      '.dssw-card{display:flex;flex-direction:column;gap:10px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);max-width:520px}',
      '.dssw-card-row{display:flex;flex-direction:column;gap:4px}',
      '.dssw-card-label{font-weight:500}',
      '.dssw-card-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
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

    /* ------------------------------------------------------------------ *
     * Composer control
     * ------------------------------------------------------------------ */

    /**
     * The composer-bar control: two source segments plus two depth segments.
     * Depth is disabled while the native source is active because the native
     * backend exposes no equivalent knob.
     */
    function SearchSwitch(props) {
      const t = props.t
      const form = props.form
      const credentials = props.credentials
      const snapshot = useFormSnapshot(form)
      const source = readSource(snapshot)
      const depth = readDepth(snapshot)
      const writable = isWritable(snapshot)
      const pairPending = React.useState(null)
      const pending = pairPending[0]
      const setPending = pairPending[1]
      const pairFailed = React.useState(false)
      const failed = pairFailed[0]
      const setFailed = pairFailed[1]
      const pairKeyState = React.useState('unknown')
      const keyState = pairKeyState[0]
      const setKeyState = pairKeyState[1]
      const keyRef = apiKeyRef(snapshot)

      React.useEffect(function () {
        if (!credentials || typeof credentials.describe !== 'function') {
          setKeyState('unknown')
          return function () {}
        }
        let alive = true
        Promise.resolve(credentials.describe([keyRef])).then(function (response) {
          if (!alive) return
          const view = response && response.ok && response.value ? response.value[keyRef] : undefined
          setKeyState(view && view.configured === true ? 'set' : view && view.configured === false ? 'unset' : 'unknown')
        }, function () {
          if (alive) setKeyState('unknown')
        })
        return function () { alive = false }
      }, [credentials, keyRef, setKeyState])

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
      const keyMissing = source === 'tavily' && keyState === 'unset'

      const sourceButtons = SOURCE_OPTIONS.map(function (id) {
        const selected = source === id
        const title = (id === 'tavily' && keyMissing ? t('tip.keyMissing') + ' · ' : '') + t('tip.source.' + id)
        return h('button', {
          key: id,
          type: 'button',
          className: 'dssw-seg' + (selected ? ' dssw-seg--on' : ''),
          'aria-pressed': selected ? 'true' : 'false',
          'data-value': id,
          title: title,
          disabled: !writable || busy,
          onClick: function () {
            if (!selected) choose('active', id)
          },
        }, t('source.' + id))
      })

      const depthButtons = DEPTH_OPTIONS.map(function (id) {
        const selected = depth === id
        return h('button', {
          key: id,
          type: 'button',
          className: 'dssw-seg' + (selected ? ' dssw-seg--on' : ''),
          'aria-pressed': selected ? 'true' : 'false',
          'data-value': id,
          title: t('tip.depth.' + id),
          disabled: !writable || busy,
          onClick: function () {
            if (!selected) choose('tavilySearchDepth', id)
          },
        }, t('depth.' + id))
      })

      // Depth only exists for Tavily, so the group disappears while the native
      // source is active instead of sitting there greyed out.
      const showDepth = showsDepth(snapshot)

      return h('div', { className: 'dssw-root', 'data-dsh-search-switch': '1' }, [
        h('div', {
          key: 'source',
          className: 'dssw-group' + (writable ? '' : ' dssw-group--off'),
          role: 'group',
          'aria-label': t('label.source'),
          'data-group': 'source',
        }, sourceButtons),
        showDepth ? h('div', {
          key: 'depth',
          className: 'dssw-group' + (writable ? '' : ' dssw-group--off'),
          role: 'group',
          'aria-label': t('label.depth'),
          'data-group': 'depth',
        }, depthButtons) : null,
        keyMissing ? h('span', {
          key: 'warn',
          className: 'dssw-warn',
          title: t('tip.keyMissing'),
          'aria-label': t('tip.keyMissing'),
        }, '!') : null,
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
     * The Plugins-page card: what is selected, the credit cost, and the one
     * control that cannot live in the composer — the Tavily API key, written
     * through the credentials domain exactly like the official web-search page.
     */
    function SettingsCard(props) {
      const t = props.t
      const form = props.form
      const credentials = props.credentials
      const snapshot = useFormSnapshot(form)
      const source = readSource(snapshot)
      const depth = readDepth(snapshot)
      const keyRef = apiKeyRef(snapshot)
      const pairDraft = React.useState('')
      const draft = pairDraft[0]
      const setDraft = pairDraft[1]
      const pairBusy = React.useState(false)
      const busy = pairBusy[0]
      const setBusy = pairBusy[1]
      const pairError = React.useState(null)
      const error = pairError[0]
      const setError = pairError[1]
      const pairSaved = React.useState(false)
      const saved = pairSaved[0]
      const setSaved = pairSaved[1]
      const pairStatus = React.useState(null)
      const status = pairStatus[0]
      const setStatus = pairStatus[1]

      const refresh = React.useCallback(function () {
        if (!credentials || typeof credentials.describe !== 'function') return Promise.resolve(null)
        return Promise.resolve(credentials.describe([keyRef])).then(function (response) {
          const view = response && response.ok && response.value ? response.value[keyRef] : undefined
          const next = view
            ? { configured: view.configured === true, writable: view.writable !== false }
            : null
          setStatus(next)
          return next
        }, function () {
          setStatus(null)
          return null
        })
      }, [credentials, keyRef, setStatus])

      React.useEffect(function () {
        refresh()
      }, [refresh])

      if (props.view === 'summary') return t('settings.summary')

      const save = function () {
        const value = draft.trim()
        if (value.length === 0 || busy || !credentials) return
        setBusy(true)
        setError(null)
        setSaved(false)
        Promise.resolve(credentials.set(keyRef, value)).then(function (response) {
          if (response && response.ok === false) {
            const detail = response.error && response.error.message ? response.error.message : ''
            throw new Error(detail.length > 0 ? detail : t('settings.failed'))
          }
          setDraft('')
          setSaved(true)
          return refresh()
        }, function (reason) {
          throw reason
        }).catch(function (reason) {
          const detail = reason && reason.message ? reason.message : String(reason)
          setError(t('settings.failed') + detail)
        }).then(function () {
          setBusy(false)
        })
      }

      const readOnly = status !== null && status.writable === false

      return h('div', { className: 'dssw-card' }, [
        h('div', { key: 'current', className: 'dssw-card-row' }, [
          h('span', { key: 'label', className: 'dssw-card-label' }, t('settings.current')),
          h('span', { key: 'value' }, t('source.' + source) + ' · ' + t('depth.' + depth)),
        ]),
        h('div', { key: 'scope', className: 'dssw-card-hint' }, t('settings.scope')),
        h('label', { key: 'key', className: 'dssw-card-row' }, [
          h('span', { key: 'label', className: 'dssw-card-label' }, t('settings.key')),
          h('input', {
            key: 'input',
            className: 'dssw-input',
            type: 'password',
            autoComplete: 'off',
            spellCheck: false,
            value: draft,
            disabled: busy || readOnly,
            placeholder: status !== null && status.configured
              ? t('settings.keySet')
              : t('settings.keyPlaceholder'),
            onChange: function (event) { setDraft(event.target.value) },
          }),
        ]),
        h('div', { key: 'hint', className: 'dssw-card-hint' }, t('settings.keyHint')),
        status !== null ? h('div', {
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
              label: function () { return t('label.source') },
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
      SOURCE_OPTIONS: SOURCE_OPTIONS,
      DEPTH_OPTIONS: DEPTH_OPTIONS,
      readSource: readSource,
      readDepth: readDepth,
      isWritable: isWritable,
      showsDepth: showsDepth,
      apiKeyRef: apiKeyRef,
    }

    return module.exports
  },
})
