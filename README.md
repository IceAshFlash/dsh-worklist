# dsh-worklist · 工作清单

项目 → 分类 → 工作单项 的三级看板，权重算进度，带一个「让 DSH 拆步骤」的按钮。
同一份数据、同一套界面，两种活法：

| 形态 | 怎么起 | 有什么 |
| --- | --- | --- |
| DSH 插件 | 装进 profile 后，侧栏第 45 位出图标，面板占 `main` 的 `dsh-worklist` key | 面板 + Agent 工具 `worklist` + AI 拆分 |
| 独立窗口 | 双击桌面「工作清单」，或 `node bin/worklist.js serve --open` | 面板（无 AI 拆分）、`list` / `path` 两个命令行子命令 |

两边共用 `$DSH_HOME/state/dsh-worklist.json`（本机 = `C:\Users\MX\.dsh\state\dsh-worklist.json`），
所以在独立窗口里改完，回到 DSH 刷新面板就能看见。

## 装到别人的机器上

**只用独立窗口**（完全不需要 DSH，零依赖）：

```bash
node bin/worklist.js serve --open     # 在当前目录跑
npm i -g dsh-worklist && worklist serve --open   # 装成全局命令
```

要求 **Node 22+**、**Windows**（桌面快捷方式靠 `.vbs`，选目录对话框靠 PowerShell 的
`FolderBrowserDialog`；mac / Linux 上界面能开，但这两处会退化）。

**当 DSH 插件用**：把 `install_bundle` 的 `target` 指向**包目录的绝对路径**（clone 下来的那个）：

```javascript
plugin_manager({ action: 'install_bundle', target: 'C:\\path\\to\\dsh-worklist' })
```

装完刷新页面，侧栏出「工作清单」。之后改了代码，用 `set_bundle { enabled: true }` 重新 apply 即可
（`link:` 装法，不需要重装）；改的是 `ui/app.js` 要先跑一次 `bin/build.js`。

## 数据模型

```
project { id, title, path, color, pinned, archived, archivedAt, warnHours, scaffold, createdAt }
  category { id, projectId, title, color, order, pinned, archived, archivedAt, kind: normal|ddl, locked }
    task { id, categoryId, title, weight, done, pinned, archived, archivedAt, dueAt, warnHours, steps[], createdAt, updatedAt }
      step { id, title, weight, done }
```

进度按权重算，不按条数：`task.progress = Σ(step.weight × done) / Σ(step.weight)`，
没有步骤的工作就是 done/1；分类和项目的进度是下属工作的加权平均。
`dueState` 分 overdue / today / soon(≤3 天) / later / none，列表按 DDL 升序、过期的置顶。

### 新项目自带的分类

新建项目时自动生成四个分类：

| 分类 | 能不能改 | 说明 |
| --- | --- | --- |
| 重要工作 / 一般工作 / 长期工作 | 可改名、可删除 | 普通分类，随手用 |
| **DDL预警** | **不能改名、不能删除**（接口回 409） | 自动收录撞上预警线的工作 |

DDL预警 里的条目是**克隆**：`id = "ddl:" + 原工作 id`、带 `cloneOf` 字段。
它只用于展示和快速勾选，真实数据还是原来那条工作——在预警分类里勾掉一条，原分类里那条也会一起完成；
项目的进度和任务数统计**不把克隆算进去**，同一件事不会被算两遍。

预警是**逐条**算的，不是整个项目共用一个刻度：

| 层级 | 字段 | 说明 |
| --- | --- | --- |
| 工作 | `task.warnHours` | 这条工作自己的提前量；`null` = 跟随项目默认 |
| 项目 | `project.warnHours` | 兜底默认值（新建项目 24 小时） |

判定用「生效值」：`taskWarnHours(task.warnHours) ?? project.warnHours`，然后
`dueAt - now <= 生效值 × 3600 × 1000`（含已逾期）；已完成的工作不进预警分类。

面板里改两处：工作编辑窗口的「预警」一栏可以选 **跟随项目** 或 **单独设置**（1–720 小时）；
DDL预警 分类头上的「默认预警 · 1天」按钮改的是项目默认值，只影响没单独设置的那些工作。
接口对应：

```
PATCH /api/tasks/{id}     { "warnHours": 6 }     // 单独设置
PATCH /api/tasks/{id}     { "warnHours": null }  // 回到跟随项目
PATCH /api/projects/{id}  { "warnHours": 1 }     // 改项目默认
```

同一条 DDL预警 分类里可以同时躺着 6 小时、48 小时、按项目默认的三种工作——
每条按自己的线进线出场，`cloneOf` 字段里的克隆会带上它自己的 `warnHours` 和 `warnOwn`。

老数据（0.1.x 建的）第一次读进来会补一次这四个分类，之后再删默认分类就不会反复冒出来。

### 置顶与右键菜单

项目、分类、工作三级都能置顶（`pinned: true`），排序规则固定：

| 位置 | 排序 |
| --- | --- |
| 侧栏项目 | 置顶在前 → 建得早的在前 |
| 项目内分类 | **DDL预警 永远第一** → 置顶的 → 各自排的顺序 |
| 分类里的工作 | 置顶 → 没完成的在前 → DDL 早的在前 → 建得早的在前 |

置顶只影响显示顺序，不改进度、不改统计。

删除项目会弹两次确认：第一次问要不要「同时删除磁盘上的项目文件夹」，勾上之后再弹一次「永久删除」，第二次点下去才真的动磁盘。默认不勾，只删清单里的记录。

右键（项目行 / 分类头 / 工作行上）是功能入口：

- **项目**：置顶、新建分类、项目设置、打开文件夹、删除项目
- **普通分类**：置顶、新建工作、重命名、删除；**DDL预警** 只给「折叠/展开」和「默认预警时间」
- **工作**：置顶、标记完成/未完成、编辑、删除；DDL预警 里的克隆行，操作作用到原来那条工作

项目标题下面那行 `DDL 工作 N 项` 就是当前撞线的条数，点一下直接跳到 DDL预警 分类。

```
PATCH /api/projects/{id}    { "pinned": true }
PATCH /api/categories/{id}  { "pinned": true }
PATCH /api/tasks/{id}       { "pinned": true }
```

## 分类文件夹与记录文件

项目填了文件夹（`project.path`）时，**新建分类会顺手在项目文件夹里建一个同名文件夹**，
里面放一个同名 `.txt` 当流水账：

```
D:\work\我的项目\          ← project.path
├── 重要工作\ 重要工作.txt
├── 开发\ 开发.txt        ← 新建分类「开发」时自动出现
└── 长期工作\ 长期工作.txt
```

txt 是 UTF-8 带 BOM、CRLF 换行，记事本双击就能看：

```
分类：开发
项目：我的项目
建立：2026-11-03 12:22
说明：这个文件由「工作清单」自动追加，记录本分类下的改动；手写的备注不会被覆盖。
--------------------------------------------------------
2026-11-03 12:22  新建分类「开发」
2026-11-03 12:22  新建工作「写接口」（权重 3，截止 2026-11-05 18:00）
2026-11-03 12:25  修改工作「写接口」：标记完成
```

规矩：

- **只追加，不覆盖**——手写的备注留着，不会被下次写入冲掉
- 建分类、建/改/删工作、勾步骤、置顶、改预警，都会追加一行
- **改名会连文件夹一起改**：分类改名 → 分类文件夹和 txt 一起改名；项目改名 → 如果项目文件夹的名字本来就是旧项目名，整个文件夹（连同里面的分类文件夹）跟着改名。你手挑的、名字和项目名无关的目录不会被改动。
- 删除分类**不删文件夹**，只在 txt 里记一句「已删除」，盘上的东西归你
- DDL预警 是虚拟分类（克隆桶），不落盘
- 项目没填文件夹、或者盘上没权限 → 安静跳过，清单本身照常用
- 右键分类 →「打开分类文件夹」直接打开那个目录

接口：`POST /api/categories/{id}/open`

## 归档

三级都能归档：右键项目 / 分类 / 工作 →「归档…」。归档的东西**数据还在**，只是从视线里撤下去：

- 默认不显示、不参与进度和计数、不进 DDL预警
- 侧栏「项目」右边有个小按钮，点一下切换查看方式：

| 按钮显示 | 看到什么 |
| --- | --- |
| `归档 关` | 只看没归档的（默认） |
| `归档 含` | 全都在，归档的压暗显示 |
| `归档 只` | 只看归档的，方便批量恢复或删除 |

这个选择记在 `localStorage`，刷新页面不会忘。归档的项目、分类、工作随时能右键「取消归档」拉回来。

```
PATCH /api/projects/{id}    { "archived": true }
PATCH /api/categories/{id}  { "archived": true }
PATCH /api/tasks/{id}       { "archived": true }
```

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
test/smoke.mjs        端到端冒烟：65 项断言
```

**改完 `ui/app.js` 必须跑 `node bin/build.js`**，`client.js` 是生成物（大小随界面变，别记数字），
直接手改会被下一次构建覆盖。仓库里提交生成物，是为了 clone 下来不用先构建就能装。

## 删除项目与磁盘清理

删项目有两种删法：

| 怎么删 | 清单里的记录 | 磁盘上的项目文件夹 |
| --- | --- | --- |
| 直接「删除项目」 | 删 | 保留 |
| 勾上「同时删除磁盘上的项目文件夹」 | 删 | **永久删除**（不进回收站） |

勾上之后要再点一次「永久删除」才生效——这一步不可撤销，所以故意做成两下。

安全闸在 `core/api.js` 的 `safePurgePath()`：盘符根（`C:`）、用户主目录、清单自己的数据文件所在目录（及其上级）、不是已存在目录的，一律不删，返回 `skipped` 告诉界面为什么没删。路径为空的项目（只做清单不绑文件夹）本来就没有可删的。

```bash
# 只删记录
curl -X DELETE http://127.0.0.1:7419/api/projects/<id>
# 连文件夹一起删
curl -X DELETE "http://127.0.0.1:7419/api/projects/<id>?files=1"
```

返回：

```json
{ "ok": true, "removed": { "categories": 4, "tasks": 9 },
  "purged": "D:\work\my-project", "purgeError": null,
  "filesRequested": true, "skipped": null }
```

`purged` 是真正删掉的路径，`skipped` 是被安全闸拦下的原因，`purgeError` 是删的时候系统报的错（比如文件被占用）。

## AI 拆分

「新建 / 编辑工作」窗口底部，`✦ 让 DSH 拆分` 上方有一个**拆分要求**输入框，留空也行。填了的内容会原样变成提示词里的一句：

```
用户对拆分方式的要求（优先满足）：按上线顺序拆，每步半天以内
```

限制 400 字（`core/api.js` 里 `hint` 用 `text().slice(0, 400)`）。它只影响这一次请求，不写进数据、也不影响手动写的步骤。输入框旁边那句提示会告诉你拆了几步。

不点按钮就不发任何模型请求——这是这个插件唯一的模型入口。

### 附图片

输入框下面有 `＋ 图片`，最多 4 张，单张上限 8MB。选完会在浏览器里先缩到最长边 1568px（超过 1.2MB 的转 JPEG 0.86），再按 base64 发给 `/ai-split`；宿主用 `attachments.saveImage()` 存进附件库，作为 `{ type: 'image', attachment }` 块跟在文本后面交给子代理。图片不写进数据文件，关掉窗口就没了。

**注意**：这条路需要模型本身能读图。`deepseek-v4.1-flash-1017` 不支持图像输入，请求会明确回一句

```
当前这个模型不支持读图：把图片去掉再拆，或在 DSH 里换一个支持视觉的模型。
```

换支持视觉的模型（或子代理路由）后不用改代码。

## 预警时长的填法

两处都是「天 / h」两个框（`makeHoursField`）：合计 = 天 × 24 + h，上限 30 天（720 小时），至少 1 小时。

- 工作编辑窗口里的「预警 → 单独设置」
- 项目右键 →「默认预警时间…」（预设 chip 会同时填这两个框）

天和 h 都不填时，这条工作回到「跟随项目」。

## 专注小窗

每个分类标题最右侧有一枚「窗口套窗口」的图标。点它，主面板让位，换成一个小窗，只放这个分类下的工作和步骤：

- 工作行左侧的圆点勾选 = 完成整条工作（有步骤时连带全勾/全取消）
- 点工作标题展开它的步骤，每条步骤单独勾
- 小窗标题右侧是分类进度和 `未完成/总数`
- `✕` 关掉小窗，主面板回来

小窗用 **Document Picture-in-Picture**（Chromium 116+：Electron 里的 DSH、Edge 桌面窗口都支持）——它是一块真正独立的系统窗口，**始终在最上层**，可以从边角自由拉伸，切到别的应用上也压在它们上面。

拿不到这个能力时（比如 Firefox）退回页面内的浮动小窗：可以按住顶部拖动、右下角拉伸、层级最高，但会随浏览器最小化一起收起来。

小窗里的勾选走的是同一套接口（`PATCH /tasks/:id`、`PATCH /tasks/:id/steps/:stepId`），所以主面板、桌面窗口、Agent 工具看到的是同一份数据；小窗开着的时候主面板会显示一张「正在小窗里」的卡片，避免两处同时操作。

## 接口

`core/api.js` 里的路由表，前缀由宿主给：

```
GET    /state
GET    /meta
GET    /fs/list?path=         列子文件夹（给「选择文件夹」弹窗用，返回 path/parent/roots/entries）
POST   /fs/mkdir              { parent, name } 新建文件夹，返回新路径
POST   /fs/pick               弹系统选目录对话框，返回 { path }（取消是 null；只在 Windows 上有）
POST   /projects              { title, path?, color? }
PATCH  /projects/:id          { title?, path?, color? } 改名时项目文件夹跟着改（文件夹名 == 旧项目名时）
DELETE /projects/:id          连带分类和工作；加 ?files=1 连磁盘上的项目文件夹一起删
POST   /projects/:id/open     用系统文件管理器打开项目目录
POST   /categories            { projectId, title, color? } 会顺手在项目文件夹里建同名文件夹 + txt
PATCH  /categories/:id        { title?, color?, pinned? } 改名时文件夹和 txt 一起改
DELETE /categories/:id        文件夹保留，只在 txt 里记一行
POST   /categories/:id/open   用系统文件管理器打开这个分类的文件夹
POST   /tasks                 { categoryId, title, weight?, dueAt?, steps? }
PATCH  /tasks/:id             done=true 时会级联勾选所有步骤
DELETE /tasks/:id
PUT    /tasks/:id/steps       { steps: [{ title, weight }] }
POST   /ai-split              { title, note?, hint?, projectTitle?, categoryTitle?, steps? }
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