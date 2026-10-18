/**
 * Effort Dial — browser half.
 *
 * This file is the factory body: `build.mjs` wraps it in
 * `window.__ModuleLoader__.load({ id, factory })` and writes `lib/client.js`.
 * Every module body side effect (CSS injection) runs at materialization.
 *
 * The seat REPLACES the shipped composer model selector
 * (`conversation.input.model`, registered at priority -1 so it shadows the
 * shipped occupant). The shipped control carried both the model choice and the
 * reasoning effort (its two-level Model / Effort menu); this one carries the
 * same pair in a pixel-matched port of Codex's reasoning-effort card: the
 * current level in blue, the model row under it, and a segmented slider whose
 * thumb stops on every adapter-provided level (the highest level is the
 * model's own top level, e.g. Max).
 *
 * Motion is ported from the original CSS module as well: the card height
 * animates with .32s cubic-bezier(.19,1,.22,1); each view cross-fades with
 * opacity .2s cubic-bezier(.23,1,.32,1) and slides with translate .32s
 * cubic-bezier(.19,1,.22,1); entering views are delayed 56ms (top row) and
 * 40ms (slider / model list), leaving views 0ms / 16ms; reduced-motion turns
 * all of it off.
 */
const React = require('react')

const PLUGIN_NAME = 'effort-dial'
const STYLE_ATTR = 'data-dsh-effort-dial'

/** Codex's effort vocabulary, keyed by the adapter-owned ids DSH reports. */
const EFFORT_LABELS = {
  none: '无',
  off: '无',
  minimal: '最低',
  low: '轻度',
  medium: '中',
  high: '高',
  xhigh: '极高',
  highest: '极高',
  max: 'Max',
  ultra: 'Ultra',
  persistent: '持续',
}

/** Deterministic sparkle layout for the maximum-level aurora (percent of fill width, percent of track height, delay s). */
const SPARKLES = [
  [7, 44, 0.1, 2], [12, 66, 1.4, 1], [18, 36, 0.6, 3], [23, 58, 1.9, 2],
  [29, 30, 0.3, 1], [34, 72, 1.1, 2], [40, 46, 0.8, 3], [46, 62, 1.6, 1],
  [52, 34, 0.2, 2], [57, 56, 1.3, 2], [63, 40, 0.9, 1], [68, 70, 1.8, 3],
  [74, 48, 0.4, 2], [79, 32, 1.2, 1], [84, 60, 0.7, 2], [89, 42, 1.5, 3],
  [93, 56, 0.1, 1], [97, 36, 1.0, 2], [15, 50, 2.1, 1], [71, 60, 2.4, 1],
]

const FALLBACK_STATE = {
  current: null,
  routable: null,
  groups: [],
  failures: [],
  status: 'loading',
  error: null,
}

const CSS = `
.ded-trigger{display:inline-flex;align-items:center;gap:7px;height:32px;max-width:260px;padding:0 10px 0 6px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,currentColor);font:inherit;font-size:14px;line-height:1;cursor:pointer;white-space:nowrap}
.ded-trigger:hover{background:rgba(128,128,128,.16)}
.ded-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0169cc);outline-offset:1px}
.ded-trigger[disabled]{cursor:default;opacity:.5}
.ded-trigger[disabled]:hover{background:none}
.ded-trigger-model{font-size:14px;font-weight:600;letter-spacing:-.1px;color:var(--dsw-alias-label-primary,currentColor);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ded-trigger-effort{font-size:14px;font-weight:400;color:var(--dsw-alias-label-tertiary,#838383);flex:0 0 auto;transition:color .34s ease}
.ded-trigger-caret{width:11px;height:11px;flex:0 0 auto;color:var(--dsw-alias-label-tertiary,#838383)}

.ded-panel{position:fixed;z-index:2147483000;width:261px;background:#242424;border-radius:10px;overflow:hidden;box-shadow:0 10px 28px rgba(0,0,0,.42);font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color:#b1b1b1;user-select:none;-webkit-user-select:none;animation:ded-panel-in .36s cubic-bezier(.19,1,.22,1) both}
.ded-panel[data-closing=true]{animation:ded-panel-out .22s cubic-bezier(.4,0,1,1) both}
@keyframes ded-panel-in{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}
@keyframes ded-panel-out{from{opacity:1;transform:none}to{opacity:0;transform:translateY(12px) scale(.97)}}

.ded-body{position:relative;overflow:hidden;transition:height .36s cubic-bezier(.19,1,.22,1)}
.ded-view{width:100%;transition:opacity .2s cubic-bezier(.23,1,.32,1),translate .32s cubic-bezier(.19,1,.22,1)}
.ded-view[data-active=false]{opacity:0;pointer-events:none}
.ded-dial-view[data-active=true]{transition-delay:40ms}
.ded-dial-view[data-active=false]{translate:0 16px;transition-delay:16ms}
.ded-models-view{position:absolute;inset-block-start:0;inset-inline:0;translate:0 -16px}
.ded-models-view[data-active=true]{translate:0;transition-delay:40ms}
.ded-models-view[data-active=false]{translate:0 -16px;transition-delay:0s}

.ded-top{padding:14px 6px 0;transition:opacity .2s cubic-bezier(.23,1,.32,1),translate .32s cubic-bezier(.19,1,.22,1)}
.ded-top[data-active=true]{transition-delay:56ms}
.ded-top[data-active=false]{opacity:0;translate:0 14px;transition-delay:0s}
@keyframes ded-title-in{from{opacity:.35}to{opacity:1}}
.ded-title-row{position:relative;display:flex;align-items:center;justify-content:center;height:18px}
.ded-title{color:#0169cc;transition:color .34s ease;font-size:15px;font-weight:600;line-height:1;letter-spacing:-.4px;white-space:nowrap}
.ded-title-text{display:inline-block;animation:ded-title-in .24s cubic-bezier(.23,1,.32,1)}
.ded-title[data-warn=true]{color:#d9a441}
.ded-glyph{position:absolute;top:50%;translate:0 -50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:0;padding:0;background:none;color:#8a8a8a;border-radius:6px;cursor:pointer;transition:background .15s ease,color .15s ease}
.ded-glyph:hover{background:rgba(255,255,255,.08);color:#cfcfcf}
.ded-glyph:focus-visible{outline:2px solid #0169cc;outline-offset:1px}
.ded-glyph[disabled]{cursor:default;opacity:.45}
.ded-glyph[disabled]:hover{background:none;color:#8a8a8a}
.ded-glyph svg{width:13px;height:13px;display:block}
.ded-glyph.ded-left{left:2px}
.ded-glyph.ded-right{right:2px}
.ded-model{display:flex;align-items:center;justify-content:center;gap:1px;height:14px;margin:3px 0 0;padding-left:17px;width:100%;border:0;background:none;color:#b1b1b1;font:inherit;font-size:12px;line-height:1;cursor:pointer;transition:color .15s ease}
.ded-model:hover{color:#d0d0d0}
.ded-model:focus-visible{outline:2px solid #0169cc;outline-offset:2px}
.ded-model-name{letter-spacing:-.2px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ded-model-name[data-hint=true]{color:#aaaaaa;letter-spacing:0;transition:color .34s ease}
.ded-caret{width:8px;height:8px;color:#9a9a9a;display:block;flex:0 0 auto}

.ded-zone{background:#272727;padding:11px 17px 10px 12px;transition:opacity .2s cubic-bezier(.23,1,.32,1),translate .32s cubic-bezier(.19,1,.22,1)}
.ded-zone[data-active=true]{transition-delay:40ms}
.ded-zone[data-active=false]{opacity:0;translate:0 10px;transition-delay:16ms}
.ded-track{position:relative;height:30px;border-radius:15px;background:#3c3c3c;cursor:pointer;touch-action:none;outline:none}
.ded-track:focus-visible{box-shadow:0 0 0 2px rgba(1,105,204,.9)}
.ded-fill{position:absolute;left:0;top:0;bottom:0;border-radius:15px 0 0 15px;background:#0169cc;pointer-events:none;transition:width .26s cubic-bezier(.22,1.16,.36,1),background-color .34s ease}
.ded-dot{position:absolute;top:50%;width:4px;height:4px;margin-top:-2px;margin-left:-2px;border-radius:50%;background:rgba(255,255,255,.28);pointer-events:none}
.ded-thumb{position:absolute;top:1.5px;width:28px;height:28px;margin-left:-14px;border-radius:50%;background:#fff;pointer-events:none;transition:left .26s cubic-bezier(.22,1.16,.36,1)}
.ded-track[data-dragging=true] .ded-thumb{transition:none}
.ded-aurora{position:absolute;left:0;top:0;bottom:0;border-radius:15px 0 0 15px;overflow:hidden;pointer-events:none;opacity:0;background:linear-gradient(90deg,#2b4cc2 0%,#7e6def 28%,#ac72ff 50%,#8f60ec 72%,#9273f8 100%);transition:opacity .34s ease,width .26s cubic-bezier(.22,1.16,.36,1)}
.ded-aurora[data-active=true]{opacity:1}
.ded-sparkle{position:absolute;width:2px;height:2px;margin:-1px 0 0 -1px;border-radius:50%;background:#fff;animation:ded-twinkle 2.6s ease-in-out infinite}
@keyframes ded-twinkle{0%,100%{opacity:.12;transform:scale(.6)}50%{opacity:.92;transform:scale(1.2)}}
.ded-track[data-dragging=true] .ded-fill{transition:none}

.ded-empty{background:#272727;padding:10px 16px 13px;font-size:12px;line-height:16px;color:#8a8a8a}
.ded-list{background:#272727;padding:6px 0 8px}
.ded-list-scroll{max-height:232px;overflow-y:auto}
.ded-list-title{padding:6px 8px 4px;font-size:13px;line-height:16px;color:#9a9a9a}
.ded-group{margin-top:6px}
.ded-group-title{padding:2px 8px 0;font-size:14px;line-height:20px;color:#e6e6e6}
.ded-item{display:flex;align-items:center;width:100%;border:0;background:none;color:#d0d0d0;font:inherit;font-size:14px;line-height:20px;padding:5px 8px;cursor:pointer;text-align:left;gap:8px;transition:background .12s ease,color .12s ease}
.ded-item:hover{background:rgba(255,255,255,.06)}
.ded-item[data-active=true]{color:#fff}
.ded-check{width:12px;height:12px;margin-left:auto;flex:0 0 auto;color:#0169cc}
.ded-back{display:flex;align-items:center;gap:4px;border:0;background:none;color:#8a8a8a;font:inherit;font-size:13px;padding:6px 8px 2px;cursor:pointer;width:100%;transition:color .15s ease}
.ded-back:hover{color:#cfcfcf}

@media (prefers-reduced-motion: reduce){
  .ded-panel,.ded-panel[data-closing=true],.ded-title-text{animation:none}
  .ded-body,.ded-view,.ded-top,.ded-zone,.ded-thumb,.ded-fill,.ded-aurora,.ded-trigger-effort,.ded-title,.ded-glyph,.ded-model,.ded-item,.ded-back{transition:none}
  .ded-sparkle{animation:none;opacity:.6}
}
`

/** Inject the plugin stylesheet once per document. */
function ensureStyles() {
  if (typeof document === 'undefined') return
  if (document.head.querySelector(`style[${STYLE_ATTR}]`) !== null) return
  const style = document.createElement('style')
  style.setAttribute(STYLE_ATTR, '')
  style.textContent = CSS
  document.head.appendChild(style)
}

/**
 * Human label for one adapter effort id, falling back to the adapter's own name.
 * @param {string} id effort id.
 * @param {{ id: string, name?: string }[]} efforts the model's effort list.
 * @returns {string} display label.
 */
function effortLabel(id, efforts) {
  const row = efforts.find(entry => entry.id === id)
  if (row && typeof row.name === 'string' && row.name.length > 0) return row.name
  const known = EFFORT_LABELS[id]
  return known !== undefined ? known : id
}

function BoltIcon() {
  return React.createElement('svg', {
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.25,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }, React.createElement('path', { d: 'M8.9 1.5 3.3 8.6h3.3l-.8 5.9 5.9-7.7H8.2z' }))
}

function ResetIcon() {
  return React.createElement('svg', {
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.25,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  },
  React.createElement('path', { d: 'M13.1 8a5.1 5.1 0 1 1-1.52-3.61' }),
  React.createElement('path', { d: 'M13.3 2.4v3h-3' }))
}

function CaretIcon() {
  return React.createElement('svg', {
    className: 'ded-caret',
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }, React.createElement('path', { d: 'm6.2 3.8 4.2 4.2-4.2 4.2' }))
}

function CheckIcon() {
  return React.createElement('svg', {
    className: 'ded-check',
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }, React.createElement('path', { d: 'm3 8.4 3.2 3.2L13 5' }))
}

function CaretDownIcon() {
  return React.createElement('svg', {
    className: 'ded-trigger-caret',
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }, React.createElement('path', { d: 'm4 6.2 4 4 4-4' }))
}

/** Resolve the current model row inside a directory snapshot. */
function currentRow(state) {
  if (state.current === null) return undefined
  for (const group of state.groups) {
    if (group.id !== state.current.provider) continue
    for (const model of group.models) {
      if (model.id === state.current.model) return { model, group }
    }
  }
  return undefined
}

/**
 * The composer seat: replaces the shipped model selector, opening the Codex
 * effort card. Model choice lives in the card's model row, reasoning effort on
 * the slider.
 * @param {object} props slot props (owner `locked`, standard `sessionId`) plus the bound directory resolver.
 * @returns {object} React element tree.
 */
function Dial(props) {
  const { models, locked } = props
  const sessionId = props.sessionId ?? (props.session !== undefined && props.session !== null
    ? props.session.sessionId
    : undefined)
  const directory = React.useMemo(() => {
    if (sessionId === undefined) return null
    try {
      return models.directoryFor(sessionId)
    } catch (error) {
      console.error('[effort-dial] directoryFor failed', String(error))
      return null
    }
  }, [models, sessionId])

  const subscribe = React.useCallback(
    (notify) => (directory === null ? () => {} : directory.store.subscribe(notify)),
    [directory],
  )
  const read = React.useCallback(
    () => (directory === null ? FALLBACK_STATE : directory.store.getSnapshot()),
    [directory],
  )
  const state = React.useSyncExternalStore(subscribe, read)

  React.useEffect(() => {
    if (directory === null) return
    directory.load().catch(() => {})
  }, [directory])

  const [open, setOpen] = React.useState(false)
  const [closing, setClosing] = React.useState(false)
  const [pane, setPane] = React.useState('dial')
  const [dragIndex, setDragIndex] = React.useState(null)
  const [dragging, setDragging] = React.useState(false)
  const [pendingIndex, setPendingIndex] = React.useState(null)
  const [anchor, setAnchor] = React.useState(null)
  const triggerRef = React.useRef(null)
  const rootRef = React.useRef(null)
  const trackRef = React.useRef(null)
  const bodyRef = React.useRef(null)
  const dialViewRef = React.useRef(null)
  const modelsViewRef = React.useRef(null)
  const closeTimer = React.useRef(0)
  const dragRef = React.useRef(null)

  const row = currentRow(state)
  const reasoning = row === undefined ? undefined : row.model.reasoning
  const efforts = reasoning === undefined || !Array.isArray(reasoning.efforts) ? [] : reasoning.efforts
  const currentEffort = state.current === null ? undefined : state.current.reasoningEffort
  const effectiveEffort = currentEffort === undefined
    ? (reasoning === undefined ? undefined : reasoning.defaultEffort)
    : currentEffort
  let index = -1
  if (effectiveEffort !== undefined) {
    index = efforts.findIndex(effort => effort.id === effectiveEffort)
  }
  if (index < 0 && efforts.length > 0) index = 0
  const shownIndex = dragIndex ?? pendingIndex ?? index
  const ratio = efforts.length > 1 ? shownIndex / (efforts.length - 1) : 0
  const title = efforts.length === 0
    ? '推理强度'
    : effortLabel(efforts[Math.max(0, shownIndex)].id, efforts)
  // Codex paints the maximum level with the theme's purple (semanticColors.skill).
  const isTop = efforts.length > 0 && shownIndex === efforts.length - 1
  const accent = isTop ? '#b06dff' : '#0169cc'
  // Codex shows a warning line where the model name sits once the maximum level is armed.
  const maxHint = '使用额度消耗更快'
  const modelName = row === undefined
    ? (state.current === null ? '模型' : state.current.model)
    : row.model.name

  const close = React.useCallback((restoreFocus) => {
    if (closeTimer.current !== 0) return
    setClosing(true)
    setPane('dial')
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = 0
      setOpen(false)
      setClosing(false)
      setDragIndex(null)
      if (restoreFocus && triggerRef.current !== null) triggerRef.current.focus()
    }, 180)
  }, [])

  React.useEffect(() => () => {
    if (closeTimer.current !== 0) window.clearTimeout(closeTimer.current)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (rootRef.current !== null && rootRef.current.contains(event.target)) return
      if (triggerRef.current !== null && triggerRef.current.contains(event.target)) return
      close(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close(true)
    }
    document.addEventListener('mousedown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, close])

  // Height animation of the two-view track (Codex animates the menu height).
  React.useLayoutEffect(() => {
    if (!open) return
    const target = pane === 'models' ? modelsViewRef.current : dialViewRef.current
    const body = bodyRef.current
    if (target === null || body === null) return
    body.style.height = `${target.scrollHeight}px`
  }, [open, pane, state.groups, state.status, efforts.length, shownIndex, state.error])

  const openPanel = () => {
    const rect = triggerRef.current === null ? null : triggerRef.current.getBoundingClientRect()
    if (rect !== null) {
      const width = 261
      const left = Math.min(Math.max(8, rect.right - width), Math.max(8, window.innerWidth - width - 8))
      setAnchor({ left, bottom: Math.max(8, window.innerHeight - rect.top + 6) })
    }
    setPane('dial')
    setDragIndex(null)
    setOpen(true)
    if (directory !== null) directory.load().catch(() => {})
  }

  const commit = (nextIndex) => {
    if (directory === null || state.current === null) return
    if (nextIndex < 0 || nextIndex >= efforts.length) return
    const target = efforts[nextIndex]
    if (target.id === effectiveEffort) return
    // Optimistic position so the thumb slides to the picked level while the
    // request is in flight; the durable projection lands right after.
    setPendingIndex(nextIndex)
    directory.select({
      provider: state.current.provider,
      model: state.current.model,
      reasoningEffort: target.id,
    }).catch((error) => { console.error('[effort-dial]', error) })
      .finally(() => { setPendingIndex(null) })
  }

  const reset = () => {
    if (directory === null || state.current === null || reasoning === undefined) return
    const selection = { provider: state.current.provider, model: state.current.model }
    if (reasoning.defaultEffort !== undefined) selection.reasoningEffort = reasoning.defaultEffort
    directory.select(selection).catch((error) => { console.error('[effort-dial]', error) })
  }

  const indexAt = (clientX) => {
    const el = trackRef.current
    if (el === null || efforts.length < 2) return 0
    const rect = el.getBoundingClientRect()
    const radius = 14
    const span = Math.max(1, rect.width - radius * 2)
    const ratioAt = Math.max(0, Math.min(1, (clientX - rect.left - radius) / span))
    return Math.round(ratioAt * (efforts.length - 1))
  }

  const onPointerDown = (event) => {
    if (efforts.length < 2) return
    event.preventDefault()
    dragRef.current = { startX: event.clientX }
    const el = trackRef.current
    if (el !== null && typeof el.setPointerCapture === 'function') {
      try { el.setPointerCapture(event.pointerId) } catch { /* noop */ }
    }
  }

  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (drag === null || efforts.length < 2) return
    // A click must keep the thumb transition; only a real drag follows the pointer.
    if (!dragging && Math.abs(event.clientX - drag.startX) < 2) return
    if (!dragging) setDragging(true)
    setDragIndex(indexAt(event.clientX))
  }

  const onPointerUp = (event) => {
    const drag = dragRef.current
    if (drag === null) return
    dragRef.current = null
    const next = indexAt(event.clientX)
    setDragIndex(null)
    setDragging(false)
    commit(next)
  }

  const onTrackKeyDown = (event) => {
    if (efforts.length < 2) return
    let next = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(efforts.length - 1, index + 1)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0, index - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = efforts.length - 1
    if (next === null) return
    event.preventDefault()
    commit(next)
  }

  const chooseModel = (group, model) => {
    if (directory === null) return
    const selection = { provider: group.id, model: model.id }
    const defaultEffort = model.reasoning === undefined ? undefined : model.reasoning.defaultEffort
    if (defaultEffort !== undefined) selection.reasoningEffort = defaultEffort
    setPane('dial')
    directory.select(selection).catch((error) => { console.error('[effort-dial]', error) })
  }

  const trigger = React.createElement('button', {
    ref: triggerRef,
    type: 'button',
    className: 'ded-trigger',
    'aria-label': `模型与推理强度：${modelName}${efforts.length === 0 ? '' : ` · ${title}`}`,
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    disabled: locked === true,
    onClick: () => { if (open) close(true); else openPanel() },
  },
  React.createElement('span', { className: 'ded-trigger-model' }, modelName),
  efforts.length > 0 ? React.createElement('span', {
    className: 'ded-trigger-effort',
    style: isTop ? { color: accent } : undefined,
  }, title) : null,
  React.createElement(CaretDownIcon))

  if (!open && !closing) return trigger

  const top = React.createElement('div', {
    className: 'ded-top',
    'data-active': pane === 'dial' ? 'true' : 'false',
  },
  React.createElement('div', { className: 'ded-title-row' },
    React.createElement('button', {
      type: 'button',
      className: 'ded-glyph ded-left',
      tabIndex: -1,
      'aria-hidden': 'true',
      title: '推理强度',
    }, React.createElement(BoltIcon)),
    React.createElement('span', {
      className: 'ded-title',
      style: { color: accent },
      'data-warn': efforts.length === 0 ? 'true' : 'false',
    }, React.createElement('span', { key: title, className: 'ded-title-text' }, title)),
    React.createElement('button', {
      type: 'button',
      className: 'ded-glyph ded-right',
      'aria-label': '恢复默认推理强度',
      disabled: efforts.length === 0 || index < 0 || effectiveEffort === reasoning?.defaultEffort,
      onClick: reset,
    }, React.createElement(ResetIcon))),
  React.createElement('button', {
    type: 'button',
    className: 'ded-model',
    onClick: () => setPane(pane === 'models' ? 'dial' : 'models'),
  },
  React.createElement('span', {
    className: 'ded-model-name',
    'data-hint': isTop ? 'true' : 'false',
  }, isTop ? maxHint : modelName),
  isTop ? null : React.createElement(CaretIcon)))

  let dialBody
  if (efforts.length === 0) {
    const emptyText = directory === null
      ? '无法读取模型目录'
      : state.status === 'loading'
        ? '正在加载模型能力…'
        : state.error !== null
          ? `模型目录加载失败：${state.error}`
          : '当前模型不支持推理强度档位'
    dialBody = React.createElement('div', { className: 'ded-empty', 'data-status': state.status }, emptyText)
  } else {
    const dots = efforts.map((effort, i) => React.createElement('span', {
      key: effort.id,
      className: 'ded-dot',
      style: { left: `calc(14px + (100% - 28px) * ${efforts.length > 1 ? i / (efforts.length - 1) : 0})` },
    }))
    dialBody = React.createElement('div', {
      className: 'ded-zone',
      'data-active': pane === 'dial' ? 'true' : 'false',
    }, React.createElement('div', {
      ref: trackRef,
      className: 'ded-track',
      role: 'slider',
      tabIndex: pane === 'dial' ? 0 : -1,
      'aria-valuemin': 0,
      'aria-valuemax': efforts.length - 1,
      'aria-valuenow': Math.max(0, shownIndex),
      'aria-valuetext': title,
      'aria-label': '推理强度',
      'data-dragging': dragging ? 'true' : 'false',
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: () => { dragRef.current = null; setDragIndex(null); setDragging(false) },
      onKeyDown: onTrackKeyDown,
    },
    React.createElement('div', {
      className: 'ded-fill',
      style: { width: `calc(14px + (100% - 28px) * ${ratio})`, background: accent },
    }),
    React.createElement('div', {
      className: 'ded-aurora',
      'data-active': isTop ? 'true' : 'false',
      style: { width: `calc(14px + (100% - 28px) * ${ratio})` },
    }, SPARKLES.map(([left, top, delay, size], i) => React.createElement('span', {
      key: i,
      className: 'ded-sparkle',
      style: {
        left: `${left}%`,
        top: `${top}%`,
        width: `${size}px`,
        height: `${size}px`,
        margin: `-${size / 2}px 0 0 -${size / 2}px`,
        animationDelay: `${delay}s`,
        animationDuration: `${2 + (i % 5) * 0.37}s`,
      },
    }))),
    React.createElement('div', null, dots),
    React.createElement('div', {
      className: 'ded-thumb',
      style: { left: `calc(14px + (100% - 28px) * ${ratio})` },
    })))
  }

  const modelsView = React.createElement('div', {
    ref: modelsViewRef,
    className: 'ded-view ded-models-view',
    'data-active': pane === 'models' ? 'true' : 'false',
  },
  React.createElement('div', { className: 'ded-list' },
    React.createElement('button', {
      type: 'button',
      className: 'ded-back',
      onClick: () => setPane('dial'),
    }, React.createElement('span', { 'aria-hidden': 'true' }, '←'), React.createElement('span', null, '返回')),
    React.createElement('div', { className: 'ded-list-title' }, '选择模型'),
    React.createElement('div', { className: 'ded-list-scroll', role: 'menu' },
      state.groups.map((group) => React.createElement('div', { className: 'ded-group', key: group.id },
        React.createElement('div', { className: 'ded-group-title' }, group.name),
        group.models.map((model) => {
          const active = state.current !== null
            && state.current.provider === group.id
            && state.current.model === model.id
          return React.createElement('button', {
            key: model.id,
            type: 'button',
            role: 'menuitemradio',
            'aria-checked': active,
            className: 'ded-item',
            'data-active': active ? 'true' : 'false',
            onClick: () => chooseModel(group, model),
          },
          React.createElement('span', { className: 'ded-model-name' }, model.name),
          active ? React.createElement(CheckIcon) : null)
        }))))))

  const dialView = React.createElement('div', {
    ref: dialViewRef,
    className: 'ded-view ded-dial-view',
    'data-active': pane === 'dial' ? 'true' : 'false',
  }, top, dialBody)

  const panel = React.createElement('div', {
    ref: rootRef,
    className: 'ded-panel',
    role: 'dialog',
    'aria-label': '模型与推理强度',
    'data-closing': closing ? 'true' : 'false',
    style: anchor === null ? { visibility: 'hidden' } : { left: `${anchor.left}px`, bottom: `${anchor.bottom}px` },
  },
  React.createElement('div', { className: 'ded-body', ref: bodyRef }, dialView, modelsView))

  return React.createElement(React.Fragment, null, trigger, panel)
}

exports.name = PLUGIN_NAME
exports.inject = ['slots', 'modelDirectories', 'sessions', 'remote', 'remote.session']
exports.apply = function apply(ctx) {
  ctx.effect(() => {
    ensureStyles()
    return () => {}
  }, 'effort-dial: styles')

  ctx.inject(['slots', 'modelDirectories'], (scope) => {
    const models = scope.modelDirectories
    // Priority -1 shadows the shipped occupant of this single seat: the
    // composer keeps one control, and it is this one.
    scope.slots.inject('conversation.input.model', () => scope.slots.register({
      name: 'conversation.input.model',
      priority: -1,
    }, (props) => React.createElement(Dial, Object.assign({}, props, { models }))))
  })
}
