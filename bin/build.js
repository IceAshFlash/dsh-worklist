#!/usr/bin/env node
/**
 * bin/build.js — 把 ui/app.js 拼进 client.js。
 *
 * 为什么要有这一步：client 侧只能加载**一个** bundle 文件（ModuleLoader 只认
 * package.json 里 ./client 指向的那一个），而独立模式又需要直接 <script src="/app.js">。
 * 于是 UI 只写一份（ui/app.js，纯 DOM、零依赖），这里把它内联进 client.js 的
 * factory 里，两边跑的是同一段代码。
 *
 *   node bin/build.js
 */

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const UI = path.join(ROOT, 'ui', 'app.js')
const OUT = path.join(ROOT, 'client.js')

/**
 * 先把源码当成一段程序解析一遍。
 *
 * 为什么必须做：client.js 是**整块**交给 ModuleLoader 的，只要有一个字符不对
 * （比如字符串里混进真实换行），整块都加载不了 —— 表现是启动校验
 * "1 entry did not activate"，而且面板上一片空白、后端却一切正常。
 * 这种错只有「冷启动重新拉 bundle」时才暴露，跑接口测试永远发现不了。
 */
const parse = (label, source) => {
  try {
    new vm.Script(source, { filename: label })
    return null
  } catch (error) {
    return error
  }
}

const ui = fs.readFileSync(UI, 'utf8')

const uiProblem = parse(UI, ui)
if (uiProblem !== null) {
  process.stderr.write(`[build] ui/app.js 有语法错误，没有生成 client.js：
${uiProblem.stack}
`)
  process.exit(1)
}

const HEADER = `/**
 * client.js — 由 bin/build.js 从 ui/app.js 生成，不要手改。
 *
 * 这一份同时是 DSH 的侧栏面板：图标占 sidebar.panellist，面板占 main 的 key
 * 'dsh-worklist'。UI 本身是纯 DOM，和独立模式（bin/worklist.js serve）跑的是同一段代码。
 */

window.__ModuleLoader__.load({
  id: 'dsh-worklist',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-worklist'
    const BASE = '/dsh-worklist-api'
    const ZH = /^zh/i.test(typeof navigator === 'object' ? String(navigator.language || '') : '')
    const LABEL = ZH ? '工作清单' : 'Worklist'
    // apply() 拿到的 ctx；面板里要用它取 uiWorkspace（原生选目录）。
    let CTX = null

    /* ------------------------------------------------------------ 内联的 UI */
`

const FOOTER = `
    /* ---------------------------------------------------------------- 图标 */

    function WorklistIcon(props) {
      const size = Number(props?.size) || 20
      const active = props?.active === true
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: active ? 2.2 : 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          style: { display: 'block', opacity: active ? 1 : 0.82 },
        },
        h('rect', { key: 'r', x: 3.2, y: 4.2, width: 17.6, height: 15.6, rx: 3.2 }),
        h('path', { key: 'a', d: 'M7.4 9.6l1.5 1.5 2.6-2.9' }),
        h('path', { key: 'b', d: 'M7.4 15.2l1.5 1.5 2.6-2.9' }),
        h('path', { key: 'c', d: 'M14.2 10.1h3.1' }),
        h('path', { key: 'd', d: 'M14.2 15.7h3.1' }),
      )
    }

    /* ---------------------------------------------------------------- 面板 */

    function WorklistPanel() {
      const ref = React.useRef(null)

      React.useEffect(() => {
        const host = ref.current
        if (host === null) return undefined
        // 原生选目录：DSH 的 uiWorkspace 背后是系统的文件夹对话框。
        // 取不到（独立窗口、或以后接口变了）就传 null，UI 只留自建浏览器。
        let pickDirectory = null
        try {
          const ws = CTX !== null && typeof CTX.get === 'function' ? CTX.get('uiWorkspace') : undefined
          if (ws !== undefined && ws !== null && typeof ws.pickDirectory === 'function') {
            pickDirectory = () => ws.pickDirectory()
          }
        } catch (error) {
          pickDirectory = null
        }
        const instance = window.__WorklistUI__.mount(host, { base: BASE, pickDirectory })
        return () => instance.unmount()
      }, [])

      return h('div', {
        ref: ref,
        style: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' },
      })
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        CTX = ctx
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: NS,
          order: 45,
          label: () => LABEL,
        }, WorklistIcon))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: NS,
        }, WorklistPanel))
      },
    }
  },
})
`

fs.writeFileSync(OUT, HEADER + ui + FOOTER, 'utf8')
process.stdout.write(`client.js <- ui/app.js (${ui.length} chars)\n`)