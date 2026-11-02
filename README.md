# dsh-worklist · 工作清单

项目 → 分类 → 工作单项 的三级看板，权重算进度，带一个「让 DSH 拆步骤」的按钮。
同一份数据、同一套界面，两种活法：

| 形态 | 怎么起 | 有什么 |
| --- | --- | --- |
| DSH 插件 | 装进 profile 后，侧栏第 45 位出图标，面板占 `main` 的 `dsh-worklist` key | 面板 + Agent 工具 `worklist` + AI 拆分 |
| 独立窗口 | 双击桌面「工作清单」，或 `node bin/worklist.js serve --open` | 面板（无 AI 拆分）、`list` / `path` 两个命令行子命令 |

两边共用 `$DSH_HOME/state/dsh-worklist.json`（本机 = `C:\Users\MX\.dsh\state\dsh-worklist.json`），
所以在独立窗口里改完，回到 DSH 刷新面板就能看见。

## 数据模型

```
project { id, title, path, color, createdAt }
  category { id, projectId, title, color, order }
    task { id, categoryId, title, weight, done, dueAt, steps[], createdAt, updatedAt }
      step { id, title, weight, done }
```

进度按权重算，不按条数：`task.progress = Σ(step.weight × done) / Σ(step.weight)`，
没有步骤的工作就是 done/1；分类和项目的进度是下属工作的加权平均。
`dueState` 分 overdue / today / soon(≤3 天) / later / none，列表按 DDL 升序、过期的置顶。

## 选文件夹

「文件夹」那一行只有一个「浏览…」按钮，两边弹的都是**操作系统自己的选目录对话框**：

- DSH 面板里走 client 服务 `uiWorkspace.pickDirectory()`。取法照 `dsh-drawai` 的样本：
  `ctx.get('uiWorkspace')`，判 `typeof ws.pickDirectory === 'function'`，取消返回 `null`，异常要 catch。
- 独立窗口里是普通 Node 进程，没有 Electron 的 dialog，于是 `POST /fs/pick` 让服务端起一个
  PowerShell 的 `FolderBrowserDialog`（`-STA`，owner 窗体 `TopMost`，否则会被 Edge 窗口盖住）。
  选中的路径**写进 UTF-8 临时文件再读回来**，不走 stdout —— 中文路径经过控制台编码会被打成问号。
  5 分钟没人理就杀掉进程回 504。

两条路都失败时（比如系统里没有 PowerShell），才退回自带的目录浏览器：顶部当前路径 +「主目录」+
盘符快捷跳；中间列子文件夹，点进去、「上一级」返回；底部输入框**默认填项目名** +「＋ 新建文件夹」，
回车即建并进入；右下角「选择这个文件夹」把路径回填。

服务端两个接口只给这条退路用：`GET /fs/list?path=` 只列**目录**（跳过 `$` 开头的系统目录，跟随符号链接
判断真实类型），`POST /fs/mkdir { parent, name }` 建一级目录，名字里有 `\ / : * ? " < > |` 直接拒。

`core/store.js` 的 `mutate(file, fn)` 对同一文件走一条 promise 队列：先重读、再改、再原子写
（临时文件 + rename），所以面板和 Agent 工具同时改也不会互相覆盖。

## 文件

```
package.json          dsh.bundle.patch + dsh.client（web 平台，inject slots）
cordis.patch.yml      - insert: { id: dsh-worklist, name: 'dsh-worklist' }
index.js              host：工具 worklist、路由 /dsh-worklist-api/*、AI 拆分、桌面快捷方式
core/store.js         数据模型 + 读写 + 装饰（progress / due）
core/api.js           纯函数路由表，host 和独立 server 共用
core/open.js          打开文件夹（explorer / open / xdg-open）
ui/app.js             全部界面（纯 DOM，零依赖）—— 唯一真源
bin/build.js          把 ui/app.js 内联进 client.js（client 只能加载一个 bundle）
bin/worklist.js       独立模式：list / path / serve [--port] [--open]
bin/worklist-open.vbs 快捷方式的入口，隐藏控制台起 node
bin/shortcut.js       生成/重建桌面快捷方式（也可以在面板里点按钮）
bin/make-icon.js      零依赖生成 bin/icon.ico
ui/standalone.html    独立模式的外壳，补一套 --dsw-alias-* 变量（含深色）
test/smoke.mjs        端到端冒烟：14 项断言
```

**改完 `ui/app.js` 必须跑 `node bin/build.js`**，`client.js` 是生成物（43981 字节），别手改。

## 接口

`core/api.js` 里的路由表，前缀由宿主给：

```
GET    /state
GET    /meta
GET    /fs/list?path=         列子文件夹（给「选择文件夹」弹窗用，返回 path/parent/roots/entries）
POST   /fs/mkdir              { parent, name } 新建文件夹，返回新路径
POST   /fs/pick               弹系统选目录对话框，返回 { path }（取消是 null；只在 Windows 上有）
POST   /projects              { title, path?, color? }
PATCH  /projects/:id          { title?, path?, color? }
DELETE /projects/:id          连带分类和工作
POST   /projects/:id/open     用系统文件管理器打开项目目录
POST   /categories            { projectId, title, color? }
PATCH  /categories/:id
DELETE /categories/:id
POST   /tasks                 { categoryId, title, weight?, dueAt?, steps? }
PATCH  /tasks/:id             done=true 时会级联勾选所有步骤
DELETE /tasks/:id
PUT    /tasks/:id/steps       { steps: [{ title, weight }] }
POST   /ai-split              { title, note?, projectTitle?, categoryTitle?, steps? }
```

`/ai-split` 只在 DSH 里有实现（独立模式回 501）。它走 `subagents.startActivation`
起一个 `delivery:'caller'` 的子代理，用 `outputSchema` 收 `{ steps: [{ title, weight }] }`，
150 秒超时；模型没按 schema 回，就退回从文本里抠 JSON。**只有界面上点了那个按钮才会调用**，
没有任何后台定时调用。

Agent 侧对应的是工具 `worklist`：
`overview` / `add_project` / `add_category` / `add_task` / `set_steps` / `update_task`。

## 独立窗口

`node bin/worklist.js serve --open` 先起一个只服务本包的 HTTP 服务（默认 7419，占用就往上找），
再用 Edge/Chrome 的 `--app=<url>` 开一个没有地址栏的窗口（单独的 `--user-data-dir`，不污染日常
浏览器）。页面每 25 秒 ping 一次 `/api/meta`，**3 分钟没人来就自己退出**，不会常驻。

桌面快捷方式指向 `wscript.exe "…\bin\worklist-open.vbs"`，图标用 `bin/icon.ico`，
所以双击不弹黑框。重建：面板里点「放到桌面」，或 `node bin/shortcut.js`。

`bin/worklist-open.vbs` 里有两件事不能省：

- 找 node 的第一条候选必须用 `%USERPROFILE%\.dsh\dsh-runtimes\…` 拼。从资源管理器双击启动的进程
  **拿不到 DSH_HOME**（那个变量只活在 DSH 自己进程里），写 `%DSH_HOME%` 会展开成空、退到 `"node"`
  上，PATH 里又没有 node，于是弹出 `80070002 系统找不到指定的文件`。
- 这个文件必须存成 **UTF-16LE 带 BOM**（或纯 ASCII）。UTF-8 的中文被 VBScript 按 GBK 解码时，
  末尾字节会把后面的引号吃掉，报 `未结束的字符串常量` —— 行号还指在错误的地方，很难查。

## 踩过的坑（别再踩）

1. `install_bundle` 在 Windows 上可能报 `ERR_PNPM_EPERM ... rename`，那不是权限问题，是 pnpm
   要把新包 rename 到一个**已存在**的目录上。把那个目录挪走再装即可。
2. 工具的 `output.schema` 是真 JSON Schema：`required` 只能写在对象级，属性上写
   `required: true` 会直接 `JsonSchemaError`，插件不激活。
3. 热重载时旧实例的路由如果没被拆掉，会 `duplicate prefix route`。前缀换一个（这里是
   `/dsh-worklist-api`）最省事；所以别复用别的插件的路由前缀。
4. 本机桌面被重定向到 `D:\new`，bash 沙箱**写不进去**（`rm`/`touch` 全 EPERM），但 DSH host
   进程可以。所以快捷方式由插件路由生成，不是在 shell 里建。
5. 用 PowerShell 建快捷方式时，脚本要写成 **UTF-8 带 BOM** 再喂给 `powershell.exe -File`，
   否则 `工作清单.lnk` 会变成乱码。临时 ps1 要放在包目录里（`os.tmpdir()` 会 EPERM）。
6. `client.js` 只能是一个 bundle，所以界面写在 `ui/app.js`、由 `bin/build.js` 内联；
   直接 `import './app.js'` 不会被加载器解析。