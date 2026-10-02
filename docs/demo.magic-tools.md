# Magic Tools for VSCode（实战项目）

前面的章节都在讲「一个 API 怎么用」。这一章换个角度：把 Tree View、Webview、命令、配置、任务
这些能力**组装成一个能真正安装使用的扩展**，并走完从编码到打包发布的完整流程。

> 项目代码：[code/magic-tools](../code/magic-tools)

## 一、需求设计

### 1.1 要做什么

做一个「多合一工具箱」：活动栏多出一个视图，按分类列出日常小工具，点一下就能用，
结果呈现在独立的 Webview 面板里，支持复制和重新运行。

刻意选了这类需求，因为它**天然需要把多个 API 拼起来**：

| 能力 | 用到的章节 |
| --- | --- |
| 活动栏图标 + 工具清单树 | [树视图 Tree View](./guide.tree-view.md)、[Contribution Points](./references.contribution-points.md) |
| 结果面板（富展示、复制） | [Webview](./guide.webview.md) |
| 命令注册与调用、Tree Item 点击运行 | [命令 Command](./guide.command.md)、[commands 相关 API](./api.commands.md) |
| 「显示哪些分类」等开关 | [扩展配置](./demo.settings.md) |
| 运行 npm script | [任务提供者 Task Provider](./guide.task-provider.md)、[tasks 相关 API](./api.tasks.md) |
| 输出通道、状态栏入口、输入框、QuickPick | [window 相关 API](./api.window.md) |
| 写剪贴板、读工作区文件 | [env 相关 API](./api.env.md)、[workspace 相关 API](./api.workspace.md) |

### 1.2 工具清单

14 个工具，分 4 类。**工具不是硬编码在命令里，而是一张注册表** —— 加一个工具只需往数组里加一条：

| 分类 | id | 工具 | 需要输入 | 需要选模式 |
| --- | --- | --- | --- | --- |
| 文本工具 | `text.case` | 大小写 / 命名风格转换 | ✅ 选中文本或输入框 | ✅ upper / camel / snake / kebab … |
| 文本工具 | `text.trimBlank` | 整理空白行 | ✅ | — |
| 文本工具 | `text.sortLines` | 行排序并去重 | ✅ | ✅ 是否区分大小写 |
| 文本工具 | `text.count` | 字数 / 行数统计 | ✅ | — |
| 编码 / 解码 | `encode.base64` | Base64 编码 | ✅ | — |
| 编码 / 解码 | `encode.base64Decode` | Base64 解码（带合法性校验） | ✅ | — |
| 编码 / 解码 | `encode.url` | URL 编码 / 解码 | ✅ | ✅ 参数值 / 整条 URL / 解码 |
| 编码 / 解码 | `encode.html` | HTML 实体转义 / 还原 | ✅ | ✅ |
| 生成器 | `gen.uuid` | UUID v4 | — | ✅ 1 / 5 / 10 个 |
| 生成器 | `gen.timestamp` | 当前时间（ISO / 秒 / 毫秒 / 时区） | — | — |
| 生成器 | `gen.convertTime` | 时间戳 ⇄ 时间 | ✅ | ✅ 两个方向 |
| 生成器 | `gen.hash` | 文本哈希（djb2 / fnv-1a） | ✅ | — |
| 项目工具 | `proj.stats` | 工作区代码统计 | — | — |
| 项目工具 | `proj.scripts` | 运行 npm script | — | ✅ QuickPick 选脚本 |

### 1.3 交互设计（先定界面，再写代码）

```
活动栏                      编辑器                    侧边
┌──────────┐  点击工具   ┌──────────────┐  结果   ┌────────────────┐
│ 🧪 Magic │ ─────────▶ │ 选中 helloWo │ ──────▶ │ Magic Tools 结果│
│  Tools   │            │ rld          │         │ ┌────────────┐ │
│ ├ 文本   │            └──────────────┘         │ │hello_world │ │
│ │ ├ 大小写│                                    │ └────────────┘ │
│ │ └ 统计  │   Ctrl+Alt+M = 快速选择工具          │ [复制][重新运行]│
│ ├ 编码   │                                     └────────────────┘
│ └ 项目   │
└──────────┘
```

三条设计约束，后面所有实现都围绕它们：

1. **输入优先级**：编辑器里有选中文本就直接用，没有才弹输入框 —— 少一次打断；
2. **输出集中**：所有结果都进同一个 Webview 面板，而不是 14 个输出通道或一堆 toast；
3. **单例面板**：面板已存在就复用（`reveal`），不重复创建。

## 二、目录结构

```
magic-tools/
├── package.json              # 所有声明式配置：视图 / 命令 / 菜单 / 快捷键 / 设置项
├── tsconfig.json
├── .vscodeignore             # 打包时排除什么
├── src/
│   ├── extension.ts          # activate()：注册视图、命令、监听器；输入解析与编排
│   ├── tools.ts              # 14 个工具的注册表 + 与 vscode 无关的纯函数
│   ├── toolTreeProvider.ts   # TreeDataProvider：分类 → 工具两级树
│   └── resultPanel.ts        # 单例 Webview 结果面板
├── media/                    # webview 前端资源（会被打进 vsix）
│   ├── main.js
│   └── style.css
├── resources/
│   └── icon.svg              # 活动栏图标，必须是单色 SVG
└── samples/                  # 试手样例（打包时排除）
    ├── sample.json
    └── sample.md
```

> `src/` 会被编译到 `out/`，`package.json` 的 `main` 指向 `./out/extension.js`。

## 三、package.json 配置

### 3.1 视图容器与视图

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        { "id": "magicTools", "title": "Magic Tools", "icon": "resources/icon.svg" }
      ]
    },
    "views": {
      "magicTools": [
        { "id": "magicTools.tools", "name": "工具箱", "icon": "resources/icon.svg" }
      ]
    }
  }
}
```

两个坑：

- `icon` 必须是**单色 SVG**（24×24，用 `fill="currentColor"`），彩色图标在活动栏会显示成黑块；
- `views.<containerId>` 的键必须与 `viewsContainers` 里声明的 `id` 完全一致，否则视图不出现，
  而且**不会报错**，只能靠 `Developer: Show Running Extensions` 排查。

### 3.2 命令与菜单

```json
{
  "contributes": {
    "commands": [
      { "command": "magicTools.pickTool", "title": "Magic Tools: 选择并运行工具", "icon": "$(list-selection)" },
      { "command": "magicTools.runTool", "title": "Magic Tools: 运行工具", "icon": "$(play)" },
      { "command": "magicTools.refresh", "title": "Magic Tools: 刷新工具列表", "icon": "$(refresh)" },
      { "command": "magicTools.copyResult", "title": "Magic Tools: 复制上一次结果", "icon": "$(copy)" }
    ],
    "menus": {
      "commandPalette": [
        { "command": "magicTools.runTool", "when": "false" }
      ],
      "view/title": [
        { "command": "magicTools.pickTool", "when": "view == magicTools.tools", "group": "navigation@1" },
        { "command": "magicTools.refresh", "when": "view == magicTools.tools", "group": "navigation@2" }
      ],
      "view/item/context": [
        { "command": "magicTools.runTool", "when": "view == magicTools.tools && viewItem == tool", "group": "inline" }
      ]
    }
  }
}
```

关键点：

- **`runTool` 从命令面板隐藏**（`"when": "false"`）。它的第一个参数是 `toolId`，在命令面板里
  执行会拿到 `undefined`，只会弹一句"找不到工具"，不如干脆不显示 —— 这是「带参数的内部命令」
  的标准做法；
- `view/title` 让两个图标出现在视图标题栏（视图获得焦点时可见）；
- `view/item/context` 的 `viewItem == tool` 对应 `TreeItem.contextValue`，我们给分类节点设的是
  `kind`、叶子设的是 `tool`，所以「运行」按钮只出现在工具上。

### 3.3 快捷键

```json
{
  "contributes": {
    "keybindings": [
      { "command": "magicTools.pickTool", "key": "ctrl+alt+m", "mac": "cmd+alt+m" }
    ]
  }
}
```

不建议加 `when` 条件：这个命令在编辑器聚焦、资源管理器聚焦、甚至关掉编辑器时都应该可用。
只有一种情况要加 `when` —— 想避开已被占用的组合键时可先查
`Developer: Inspect Key Mappings`。

### 3.4 配置项

```json
{
  "contributes": {
    "configuration": {
      "title": "Magic Tools",
      "properties": {
        "magicTools.enabledKinds": {
          "type": "array",
          "default": ["text", "encode", "generate", "project"],
          "items": { "type": "string", "enum": ["text", "encode", "generate", "project"] },
          "markdownDescription": "只显示这些分类下的工具。",
          "scope": "window"
        },
        "magicTools.previewMaxLines": {
          "type": "number", "default": 400, "minimum": 20, "maximum": 5000,
          "markdownDescription": "结果面板最多预览的行数，超出部分会被截断（完整内容仍可复制）。",
          "scope": "window"
        },
        "magicTools.autoCopyResult": {
          "type": "boolean", "default": false,
          "markdownDescription": "运行工具后自动把结果写入剪贴板。",
          "scope": "window"
        }
      }
    }
  }
}
```

- 设置项用 `array` + `items.enum`，设置界面会自动渲染成多选；
- `scope: window` 表示值随窗口走（不写进 `.vscode/settings.json` 参与团队共享）——
  这类纯个人偏好就该用 `window` 而不是默认的 `window`/`resource` 混合语义；
- 三个设置项的详细写法见 [扩展配置](./demo.settings.md)。

### 3.5 激活事件

```json
{
  "activationEvents": [],
  "main": "./out/extension.js"
}
```

**空数组就是正确写法。** 从 VS Code 1.74 起，`contributes.commands` / `contributes.views`
里的贡献点会自动生成对应的激活事件，不需要再手写 `onCommand:magicTools.runTool`、
`onView:magicTools.tools`。这也是 [任务提供者](./guide.task-provider.md) 里 `onTaskType`
不再必需的同一条规则。

## 四、核心代码

### 4.1 工具注册表：`src/tools.ts`

整个扩展的骨架就是这个接口。**工具 = 数据 + 一个 `run` 函数**：

```typescript
export interface ToolDefinition {
	/** 全局唯一，同时是 Tree Item 的 id */
	id: string;
	label: string;
	description: string;
	kind: ToolKind;
	/** codicon id，例如 `case-sensitive` */
	icon: string;
	/** true 表示没有选中文本时要弹输入框 */
	needsInput: boolean;
	inputPlaceholder?: string;
	/** 需要选择模式时声明；选中值会作为 `ctx.option` 传入 */
	options?: readonly ToolOption[];
	run(context: ToolContext): ToolResult | Promise<ToolResult>;
}
```

`ToolContext` 是工具能接触到的**全部**外部世界 —— 输入、模式、工作区、取消信号，以及
「怎么问用户」「怎么打日志」两个回调：

```typescript
export interface ToolContext {
	readonly input: string;
	readonly option: string | undefined;
	readonly workspaceFolder: vscode.WorkspaceFolder | undefined;
	/** 长耗时工具请在循环里检查它，用户点「取消」后会变成 aborted */
	readonly signal: AbortSignal;
	pick(items: readonly ToolOption[], placeHolder: string): Promise<string | undefined>;
	log(message: string): void;
}
```

这样设计的好处：

- **纯函数可单测**：`base64Decode`、`convertTime`、`sortUniqueLines` 都不碰 `vscode`，
  直接 `import` 就能断言，不需要跑扩展宿主；
- **加工具零成本**：往 `TOOLS` 数组追加一条即可，Tree View、命令、结果面板、配置过滤
  全都会自动生效；
- **不滥用全局**：工具拿不到 `vscode.window`，只能通过 `context.pick` 问用户，
  行为边界清晰。

一条真实注册项（带模式的工具）：

```typescript
{
	id: 'text.case',
	label: '大小写 / 命名风格转换',
	description: 'UPPER / camelCase / snake_case / kebab-case …',
	kind: 'text',
	icon: 'case-sensitive',
	needsInput: true,
	inputPlaceholder: '例如 helloWorld',
	options: [
		{ label: 'UPPER CASE', value: 'upper' },
		{ label: 'camelCase', value: 'camel' },
		{ label: 'snake_case', value: 'snake' },
		{ label: 'kebab-case', value: 'kebab' },
	],
	run: (context) => {
		const words = splitWords(context.input);
		const mode = context.option ?? 'upper';
		const convert: Record<string, () => string> = {
			upper: () => context.input.toUpperCase(),
			camel: () => words.map((word, index) => (index === 0 ? word.toLowerCase() : capitalize(word))).join(''),
			snake: () => words.map((word) => word.toLowerCase()).join('_'),
			kebab: () => words.map((word) => word.toLowerCase()).join('-'),
		};
		return { language: 'text', text: convert[mode]?.() ?? context.input, summary: `模式：${mode}` };
	},
}
```

把 `helloWorld` / `hello-world` / `hello_world` 统一拆词，是这个工具能用一行代码处理三种命名的前提：

```typescript
/** 把 `helloWorld` / `hello-world` / `hello_world` / `你好World` 拆成 ['hello', 'World'] */
export function splitWords(text: string): string[] {
	return text
		.replace(/([a-z0-9\u4e00-\u9fa5])([A-Z])/g, '$1 $2')   // helloWorld / 你好World → 分开
		.split(/[^A-Za-z0-9\u4e00-\u9fa5]+/)                   // 按非字母数字切（中文整体保留）
		.filter(Boolean);
}
```

那个 `\u4e00-\u9fa5` 不是多余的：先不加它写了 `/([a-z0-9])([A-Z])/`，结果
`你好World` 拆不开（`好` 不属于 `[a-z0-9]`），camelCase 转换会把中文一起吃进去。
把中文字符范围补进那个字符类后，`你好World → ['你好', 'World']`。写成纯函数后，
这类边界用上面那种断言小脚本一跑就能发现，不必反复 F5。

### 4.2 结果类型与截断

`ToolResult` 只有三个字段，但 `summary` 和 `language` 让面板可以做「说明 + 高亮」：

```typescript
export interface ToolResult {
	/** 供结果面板做语法高亮/展示的语言标识 */
	language: string;
	text: string;
	/** 结果上方的说明，例如「模式：snake_case」 */
	summary?: string;
}
```

### 4.3 输入解析：`resolveInput`

「选中文本优先」这条交互约定就落在这个 10 行函数里：

```typescript
async function resolveInput(tool: ToolDefinition): Promise<string | undefined> {
	if (!tool.needsInput) {
		return '';
	}
	const editor = vscode.window.activeTextEditor;
	const selected = editor ? editor.document.getText(editor.selection) : '';
	if (selected.trim() !== '') {
		output.info(`使用编辑器选中文本（${selected.length} 字符）作为输入`);
		return selected;
	}
	const text = await vscode.window.showInputBox({
		prompt: `${tool.label}：请输入要处理的内容`,
		placeHolder: tool.inputPlaceholder ?? '也可以先在编辑器里选中文本，再运行工具',
		ignoreFocusOut: true,
	});
	return text; // undefined 表示用户取消
}
```

三点注意：

- 返回 `undefined` 与返回 `''` 是**两种语义**：前者是"用户取消"，调用方要直接 `return`；
  后者是"这个工具不需要输入"。混用会出现"点取消却弹出错误面板"；
- `ignoreFocusOut: true` 防止用户点一下别处输入框就被关掉（默认 `false` 会关）；
- `tool.needsInput === false` 的工具（UUID、当前时间、项目工具）完全跳过输入环节，
  连输入框都不闪。

### 4.4 命令编排：`runTool` + `execute`

```typescript
async function runTool(toolId?: string): Promise<void> {
	const tool = toolId ? findTool(toolId) : undefined;
	if (!tool) {
		void vscode.window.showWarningMessage(`找不到工具：${toolId ?? '(未指定)'}`);
		return;
	}

	// 需要模式的工具先问模式
	let option: string | undefined;
	if (tool.options?.length) {
		const picked = await vscode.window.showQuickPick([...tool.options], {
			placeHolder: `${tool.label}：选择模式`,
			ignoreFocusOut: true,
		});
		if (!picked) {
			return;
		}
		option = picked.value;
	}

	// 需要输入的工具：优先用编辑器选中文本，没有就弹输入框
	const input = await resolveInput(tool);
	if (input === undefined) {
		return;
	}

	await execute(tool, input, option);
}
```

`execute` 负责「运行 + 展示 + 记日志 + 错误兜底」，并给项目级工具加上可取消的进度提示：

```typescript
const controller = new AbortController();
const context: ToolContext = {
	input,
	option,
	workspaceFolder: vscode.workspace.workspaceFolders?.[0],
	signal: controller.signal,
	pick: async (items, placeHolder) => {
		const picked = await vscode.window.showQuickPick([...items], { placeHolder, ignoreFocusOut: true });
		return picked?.value;
	},
	log: (message) => output.info(message),
};

try {
	const result =
		tool.kind === 'project'
			? await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: `Magic Tools：正在运行 ${tool.label}`,
						cancellable: true,
					},
					(_progress, token) => {
						token.onCancellationRequested(() => controller.abort());
						return Promise.resolve(tool.run(context));
					}
				)
			: await tool.run(context);
	panel.update(tool, result);
} catch (error) {
	panel.updateError(tool, error);
	output.error(`工具 ${tool.id} 失败：${error instanceof Error ? error.message : String(error)}`);
}
```

**错误展示在面板里而不是只弹 toast**：`updateError` 把异常当成一次正常结果渲染，
用户复制错误信息、对照输入排查都比一闪而过的通知好用。

### 4.5 树视图：`src/toolTreeProvider.ts`

两级树：分类 → 工具。三个实现细节值得记：

```typescript
getChildren(element?: ToolTreeNode): ToolTreeNode[] {
	const tools = enabledTools();
	if (!element) {
		// 去重得到"有工具的分类"，避免配置裁剪后剩下空文件夹
		return tools
			.reduce<ToolKind[]>((kinds, tool) => (kinds.includes(tool.kind) ? kinds : [...kinds, tool.kind]), [])
			.map((kind) => ({ type: 'kind', kind }));
	}
	if (element.type === 'kind') {
		return tools.filter((tool) => tool.kind === element.kind).map((tool) => ({ type: 'tool', tool }));
	}
	return [];
}
```

1. **分类节点动态生成**：`getChildren()` 每次都重新读配置，因此
   `magicTools.enabledKinds` 里去掉 `project` 后，分类节点自己就消失了，不会留一个空文件夹；
2. **把 `命令 + 参数` 挂在 `TreeItem.command` 上**：点击即运行，不需要额外注册
   `onDidChangeSelection` 之类的监听：

   ```typescript
   item.command = { command: 'magicTools.runTool', title: '运行工具', arguments: [tool.id] };
   ```

   `arguments` 会作为注册回调的第一个参数传进来，这正是 `runTool(toolId?: string)` 的来源；
3. **`contextValue` 决定右键菜单**：分类是 `kind`、工具是 `tool`，
   与 `package.json` 里的 `viewItem == tool` 一一对应。

另外给每个工具配了 Markdown 悬浮提示（`tooltip`），并开启 `supportThemeIcons`，
这样提示里可以直接用 `$(play)` 这类 codicon：

```typescript
const tooltip = new vscode.MarkdownString();
tooltip.appendMarkdown(`**${tool.label}**\n\n${tool.description}\n\n`);
tooltip.appendMarkdown(`- id: \`${tool.id}\`\n- 分类: ${KIND_LABELS[tool.kind]}\n`);
if (tool.options?.length) {
	tooltip.appendMarkdown(`- 可选模式: ${tool.options.map((option) => `\`${option.label}\``).join('、')}\n`);
}
tooltip.appendMarkdown(`\n$(play) 单击运行`);
tooltip.supportThemeIcons = true;
item.tooltip = tooltip;
```

配置变化时直接整体重建，不做 diff：

```typescript
vscode.workspace.onDidChangeConfiguration((event) => {
	if (event.affectsConfiguration('magicTools')) {
		treeProvider.refresh();       // 内部就是 fire(undefined)
	}
});
```

### 4.6 单例 Webview 结果面板：`src/resultPanel.ts`

这是本项目的技术核心。四个必须做对的地方：

#### （1）单例复用

```typescript
private static current: ResultPanel | undefined;

static show(extensionUri: vscode.Uri, onRerun: (tool: ToolDefinition) => Promise<void>, column = vscode.ViewColumn.Beside): ResultPanel {
	if (ResultPanel.current) {
		ResultPanel.current.panel.reveal(column);   // 已存在 → 只 reveal
		return ResultPanel.current;
	}
	const panel = vscode.window.createWebviewPanel('magicTools.result', 'Magic Tools 结果', column, {
		enableScripts: true,
		retainContextWhenHidden: false,
		localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
	});
	ResultPanel.current = new ResultPanel(panel, extensionUri, onRerun);
	return ResultPanel.current;
}
```

- `reveal(column)` 而不是再 `createWebviewPanel`：连续运行 10 个工具只会有 1 个面板；
- `localResourceRoots` 只放开 `media/`：webview 无法读取扩展目录之外的文件，越权直接被拦；
- `retainContextWhenHidden: false`（默认值，显式写出来是为了提醒）：面板被隐藏时销毁 DOM
  以省内存，代价是**脚本状态会丢** —— 所以下面要用 `setState` 兜。

#### （2）CSP + nonce

```typescript
const csp = [
	"default-src 'none'",
	`style-src ${webview.cspSource}`,
	`script-src 'nonce-${nonce}'`,
	`font-src ${webview.cspSource}`,
].join('; ');
```

- `default-src 'none'` 先全禁，再逐项放开，比逐项禁止安全得多；
- 脚本用 **nonce**：`<script nonce="${nonce}" src="${scriptUri}">`。nonce 每次构建 HTML
  时随机生成 32 位，外部注入的脚本拿不到它，浏览器就不会执行；
- 写 `'unsafe-inline'` 会让 nonce 白做，**不要**为了图方便加上。

#### （3）数据走 `postMessage`，绝不拼 HTML

```typescript
void this.panel.webview.postMessage({
	command: 'result',
	tool: this.lastTool?.label ?? '',
	summary: this.lastResult.summary ?? '',
	language: this.lastResult.language,
	text: shown,
	fullLength: this.lastResult.text.length,
	truncated,
	omittedLines: truncated ? lines.length - maxLines : 0,
});
```

webview 侧对应地用 `textContent` 赋值：

```javascript
function render(data) {
	// 关键：用 textContent 而不是 innerHTML —— 用户输入里的标签不会被解析
	resultEl.textContent = data.text || '（空结果）';
	toolEl.textContent = data.tool || 'Magic Tools';
	languageEl.textContent = data.language || '';
	languageEl.hidden = !data.language;
	// …
}
```

这一点在「工具箱」类扩展里尤其重要：用户会把任意文本（甚至别人发来的 HTML 片段）
喂给工具，如果结果用 `innerHTML` 渲染，就相当于给了一个 XSS 入口，
而 webview 默认能访问 `acquireVsCodeApi()` 与工作区外的资源 URI。

#### （4）ready 握手 + 状态恢复

扩展和 webview 是两条独立的时间线：`createWebviewPanel` 之后立刻 `postMessage`，
消息**会在脚本执行前丢失**。所以让 webview 主动报到：

```javascript
// main.js 末尾：通知扩展「脚本已就绪」，此时再推数据就不会丢消息
vscode.postMessage({ command: 'ready' });
```

```typescript
case 'ready':
	// webview 脚本就绪后再推数据，避免消息早于监听器注册而丢失
	this.postResult();
	break;
```

再配合 webview 侧的状态持久化，面板被隐藏/重建后也能立刻显示上次的结果：

```javascript
const previousState = vscode.getState();
if (previousState && previousState.result) {
	render(previousState.result);
}
// 收到结果时
vscode.setState({ result: message });
```

#### （5）剪贴板必须由扩展侧写

```javascript
document.getElementById('copy').addEventListener('click', () => {
	// 浏览器剪贴板在 webview 里不可靠，交给扩展宿主写
	vscode.postMessage({ command: 'copy' });
	flash('已请求复制');
});
```

```typescript
case 'copy':
	if (this.lastResult) {
		await vscode.env.clipboard.writeText(this.lastResult.text);
		void vscode.window.setStatusBarMessage('Magic Tools：结果已复制到剪贴板', 3000);
	}
	break;
```

`navigator.clipboard` 在 webview 里受 iframe 权限与用户手势限制，时灵时不灵；
`vscode.env.clipboard.writeText` 稳定、可测，还能顺带写状态栏提示。
注意复制的是**完整结果**（`lastResult.text`），而不是被 `previewMaxLines` 截断后的预览文本。

#### （6）避免 dispose 重入

```typescript
this.panel.onDidDispose(() => this.cleanup(), null, this.disposables);

dispose(): void {
	this.panel.dispose();
}

/** 只做内部清理。注意不要在这里再调 panel.dispose()，否则会重入 onDidDispose */
private cleanup(): void {
	ResultPanel.current = undefined;
	while (this.disposables.length) {
		this.disposables.pop()?.dispose();
	}
}
```

`onDidDispose` 里再调 `panel.dispose()` 会造成重入（有些实现里会重复触发事件）。
把"外部主动关"和"内部收尾"拆成两个方法，是 Webview 面板最容易踩的一个坑。

### 4.7 一个真实工具：工作区代码统计

`proj.stats` 把 `workspace.fs` 的常见用法串了一遍：`findFiles` 找文件、`stat` 看大小、
`readFile` 读内容、跳过不该读的目录：

```typescript
const uris = await vscode.workspace.findFiles(
	'**/*',
	'**/{node_modules,.git,out,dist,build,coverage,.vscode-test}/**',
	MAX_FILES                       // 上限 2000，防止大型仓库卡死
);

for (const uri of uris) {
	if (context.signal.aborted) {
		throw new Error('已取消');
	}
	if (SKIP_DIRS.test(uri.fsPath) || !TEXT_EXTENSIONS.test(uri.fsPath)) {
		continue;
	}
	let content: Uint8Array;
	try {
		const stat = await vscode.workspace.fs.stat(uri);
		if (stat.size > MAX_FILE_BYTES) {   // 单文件上限 512 KB
			continue;
		}
		content = await vscode.workspace.fs.readFile(uri);
	} catch {
		continue; // 读不了就跳过：虚拟文件系统、权限不足等
	}
	const text = Buffer.from(content).toString('utf8');
	const lineCount = text === '' ? 0 : text.split(/\r\n|\n/).length;
	files += 1;
	lines += lineCount;
	bytes += content.byteLength;
}
```

四个工程化细节：

| 细节 | 原因 |
| --- | --- |
| `findFiles` 第二个参数排除目录 | 不排除 `node_modules` 会扫出几十万文件 |
| `MAX_FILES` / `MAX_FILE_BYTES` 双上限 | 保证"最坏情况"也有界，不把扩展宿主拖死 |
| `try/catch` 包住 `stat`/`readFile` | 虚拟文件系统（见[虚拟工作区](./guide.virtual-workspaces.md)）可能不支持某些操作 |
| `signal.aborted` 检查 | 配合 `withProgress({ cancellable: true })`，用户能中途取消 |

`readFile` 返回的是 `Uint8Array`，转文本要显式指定编码：
`Buffer.from(content).toString('utf8')` —— 不要用 `content.toString()`（会得到逗号分隔的数字）。

### 4.8 与任务系统联动：`proj.scripts`

「在扩展里跑 npm script」最小实现就是构造一个 `ShellExecution` 任务并执行：

```typescript
const task = new vscode.Task(
	{ type: 'npm-script', script: chosen },
	folder,
	`npm: ${chosen}`,
	'npm',
	new vscode.ShellExecution(`npm run ${chosen}`, { cwd: folder.uri.fsPath })
);
task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, panel: vscode.TaskPanelKind.Shared };
task.group = vscode.TaskGroup.Build;
const execution = await vscode.tasks.executeTask(task);
```

- 第一个参数是 **task definition**（`{ type, script }`）。这里没有对应的
  `contributes.taskDefinitions`，因为任务是我们自己直接 `executeTask` 的，
  不经过任务解析流程 —— 只有在"让用户按 `Ctrl+Shift+P → Run Task` 也能选到"时才需要
  `registerTaskProvider`，详见 [任务提供者 Task Provider](./guide.task-provider.md)；
- `panel: TaskPanelKind.Shared` 复用同一个终端面板，连跑多个脚本不会开一堆终端；
- 任务结束的事件在 `activate` 里统一监听并记日志：

  ```typescript
  vscode.tasks.onDidEndTaskProcess((event) => {
  	output.info(`任务结束：${event.execution.task.name}（exit=${event.exitCode ?? 'unknown'}）`);
  });
  ```

### 4.9 输出通道与状态栏

```typescript
output = vscode.window.createOutputChannel('Magic Tools', { log: true });
output.info(`Magic Tools 已激活，共注册 ${enabledTools().length} 个工具`);
```

`{ log: true }` 拿到的是 `LogOutputChannel`，比普通通道多三样东西：
带级别的 `trace/debug/info/warn/error`、用户可调的日志级别、以及自动加时间戳。
排查用户问题时，让用户把日志级别调到 `Trace` 再复现即可。

状态栏留了一个常驻入口，减少"找不到这个功能"的成本：

```typescript
const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
statusItem.text = '$(beaker) Magic Tools';
statusItem.tooltip = new vscode.MarkdownString('单击选择工具\n\n快捷键 `Ctrl+Alt+M`');
statusItem.command = 'magicTools.pickTool';
statusItem.show();
```

别忘了 `context.subscriptions.push(statusItem)` —— 状态栏项不 dispose 会一直残留。

## 五、前端资源

### 5.1 结果面板的 HTML 骨架

```html
<body>
	<header class="toolbar">
		<div class="meta">
			<span class="tool" id="tool-name">Magic Tools</span>
			<span class="badge" id="language"></span>
			<span class="summary" id="summary"></span>
		</div>
		<div class="actions">
			<button id="copy" title="复制完整结果">复制</button>
			<button id="rerun" title="用同样的输入再跑一次">重新运行</button>
		</div>
	</header>
	<div class="notice" id="notice" hidden></div>
	<pre id="result" tabindex="0"></pre>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
```

- `<pre>` 用 `white-space: pre-wrap`，长行自动折行、缩进保留；
- `tabindex="0"` 让结果区可聚焦，方便键盘滚动与 `Ctrl+C`；
- 「重新运行」用的是**扩展侧保存的上一次输入**，所以用户在面板里点它不会又被问一遍输入：

  ```typescript
  let lastRun: { tool: ToolDefinition; input: string; option: string | undefined } | undefined;
  // …
  ResultPanel.show(extensionUri, async (rerunTool) => {
  	const saved = lastRun;
  	if (saved) {
  		await execute(rerunTool, saved.input, saved.option);
  	}
  });
  ```

### 5.2 只用主题变量写样式

```css
.toolbar {
	border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
	background-color: var(--vscode-sideBar-background, transparent);
}

button {
	color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
	background-color: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
}

#result {
	font-family: var(--vscode-editor-font-family, monospace);
	font-size: var(--vscode-editor-font-size, 13px);
}
```

硬编码颜色会在浅色/深色/高对比度主题下出问题（尤其是高对比度）。
`var(--vscode-*, fallback)` 的写法既跟随主题，又给老版本 VS Code 留了兜底。
可用的变量清单见 <https://code.visualstudio.com/api/references/theme-color>。

## 六、效果验证

1. 用 VS Code 打开 `code/magic-tools`，按 `F5` 启动扩展开发宿主；
2. 在宿主里打开 `samples/` 文件夹，打开 `sample.md`；
3. 选中 `helloWorld` → 活动栏点「Magic Tools」→ 点「大小写 / 命名风格转换」→ 选 `snake_case`
   → 右侧面板出现 `hello_world`，标题栏显示 `模式：snake`；
4. 不选任何文本，直接点「Base64 解码」，输入 `5L2g5aW977yMVlMgQ29kZSE=` → 得到中文结果；
5. 点「复制」→ 状态栏提示"结果已复制到剪贴板"，粘贴验证；
6. 点「重新运行」→ 结果重新计算，且**不再**弹输入框；
7. 运行 `proj.scripts` → QuickPick 选 `compile` → 终端自动打开并执行 `npm run compile`，
   输出面板出现"任务结束：npm: compile（exit=0）"；
8. 运行 `proj.stats` → 通知区出现可取消的进度条，结束后面板显示文件数/行数/Top 8 扩展名；
9. 设置里把 `magicTools.enabledKinds` 改成只留 `["text"]` → 树里只剩「文本工具」一个分类；
10. 设置 `magicTools.previewMaxLines` 为 `20`，运行 `proj.stats` → 面板顶部出现"预览已截断"提示，
    但复制拿到的仍是完整结果；
11. 按 `Ctrl+Alt+M` → 快速选择工具列表（按分类分隔）。

> 📷 待补充截图：`docs/images/demo-magic-tools/tree.png`
> 📷 待补充截图：`docs/images/demo-magic-tools/result-panel.png`
> 📷 待补充截图：`docs/images/demo-magic-tools/task.png`

## 七、从 demo 到发布

章节开头说"走完从编码到打包发布的完整流程"，这里是后半段。

### 7.1 打包 vsix

```bash
# 用 npx 免安装；全局安装则是 npm i -g @vscode/vsce
npx @vscode/vsce package
```

产物是 `magic-tools-0.0.1.vsix`，可以直接安装验证：

```bash
code --install-extension magic-tools-0.0.1.vsix
```

`package.json` 里 `publisher` 字段是打包的硬性要求（本项目填的是占位值
`vscode-extension-cookbook`，正式发布要换成你自己的 Marketplace publisher id）。

### 7.2 `.vscodeignore` 该排除什么

```
.vscode/**
.vscode-test/**
src/**            # 源码不进包，运行时只用 out/
**/tsconfig.json
**/*.map          # sourcemap 可留（便于线上排查），但会显著增大体积
**/*.ts
samples/**        # 样例数据没必要跟着发布
```

两条经验：

- **`src/` 和 `**/*.ts` 一定要排**：否则包体积翻倍，而且用户能在扩展目录里改"源码"却没效果；
- **`media/`、`resources/` 千万别排**：Webview 的 `localResourceRoots` 与活动栏图标都指向它们，
  漏打会导致面板白屏或图标消失 —— 这类问题**本地 F5 调试时不会出现**（直接读磁盘），
  只有装了 vsix 才暴露。所以打包后一定要用 vsix 装一次再走一遍验证清单。

### 7.3 发布前检查清单

| 检查项 | 说明 |
| --- | --- |
| `name` / `publisher` / `version` | 三者共同决定扩展 id 与市场 URL；`version` 每次发布必须递增 |
| `displayName` / `description` | Marketplace 列表页的标题与摘要，中文不要超过一行 |
| `engines.vscode` | 写的是**最低**支持版本。本项目声明 `^1.120.0`，因为依赖 1.74+ 的自动激活事件 |
| `categories` / `keywords` | 影响市场搜索与筛选；`categories` 只能取官方枚举值 |
| `icon` | 128×128 PNG，放市场列表页（与活动栏的 `resources/icon.svg` 不是一回事） |
| `license` | 缺了 Marketplace 会告警 |
| `repository` | 建议补上，方便用户点进源码 |
| `README.md` | 市场详情页正文，支持相对路径图片 |
| `CHANGELOG.md` | 有的话市场会展示"更新日志"标签页 |
| `activationEvents` | 应尽量为空 —— 让 VS Code 按贡献点自动激活，冷启动更快 |
| vsix 实测 | 装 vsix 走一遍第六节的验证清单，重点看 Webview 与图标 |

### 7.4 用 `vscode:prepublish` 保证包内是编译产物

```json
{
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "package": "vsce package"
  }
}
```

`vsce package` 会**自动**先跑 `vscode:prepublish`，所以永远不会打包出过期的 `out/`。
调试用 `watch`（增量编译，配合 F5 的 `preLaunchTask`），发布交给 `prepublish`。

### 7.5 发布

```bash
npx @vscode/vsce login <publisher-id>     # 用 Azure DevOps PAT 登录
npx @vscode/vsce publish                  # 或 publish minor / major 直接升版本
```

只想打包给同事试用，`package` + `code --install-extension` 就够了，不必上架。

## 八、常见坑

- **视图不显示**：`views` 的键与 `viewsContainers` 的 `id` 不一致（不报错！），
  或活动栏图标不是单色 SVG；
- **点 Tree Item 毫无反应**：`TreeItem.command.arguments` 里的顺序与命令回调参数不一致；
- **命令在命令面板里报"找不到工具"**：带参数的内部命令忘了用
  `"menus": { "commandPalette": [{ "command": "…", "when": "false" }] }` 隐藏；
- **Webview 白屏**：`localResourceRoots` 没包含 `media/`，或 `asWebviewUri` 没用就直接拼
  `file://` 路径；本地调试正常、装包后白屏则多半是 `.vscodeignore` 排除了 `media/`；
- **Webview 里的脚本不执行**：CSP 缺 `nonce`，或 `enableScripts` 为 `false`；
- **推到面板的第一条消息丢了**：没有 ready 握手，`postMessage` 早于脚本注册监听器；
- **结果里的 `<b>` 变成粗体**：用了 `innerHTML`。必须 `textContent`；
- **面板关掉后再运行报错**：`onDidDispose` 里重复 `panel.dispose()` 造成重入，
  或没把 `ResultPanel.current` 置空导致 `reveal` 到已销毁的面板；
- **结果被截断后复制也不全**：复制用的是预览文本而不是原始结果；
- **面板在深色主题下看不清**：硬编码了颜色，应使用 `--vscode-*` 变量；
- **`Buffer.from(uint8array).toString()` 得到数字串**：没有传 `'utf8'`；
- **`proj.stats` 卡住**：`findFiles` 没排除 `node_modules`，或没设文件数/体积上限；
- **取消后显示"运行失败：已取消"**：这是有意为之（错误也进面板），
  若要区分取消与失败，可在工具里 `throw new vscode.CancellationError()` 再单独判断；
- **改了设置树不刷新**：没有监听 `onDidChangeConfiguration`，或判断时写错了配置前缀；
- **状态栏图标残留**：`createStatusBarItem` 的结果没放进 `context.subscriptions`。

## 九、项目代码

- [code/magic-tools](../code/magic-tools) —— 完整工程（`npm i && npm run compile`，然后 F5）
  - `src/tools.ts` —— 14 个工具与纯函数
  - `src/toolTreeProvider.ts` —— 树视图
  - `src/resultPanel.ts` —— 单例 Webview 面板
  - `src/extension.ts` —— 激活、命令、监听器、编排
  - `media/` —— webview 前端

## 十、资料

```markdown
https://code.visualstudio.com/api/get-started/your-first-extension
https://code.visualstudio.com/api/extension-guides/webview
https://code.visualstudio.com/api/extension-guides/tree-view
https://code.visualstudio.com/api/extension-guides/command
https://code.visualstudio.com/api/references/contribution-points
https://code.visualstudio.com/api/references/theme-color
https://code.visualstudio.com/api/references/activation-events
https://code.visualstudio.com/api/working-with-extensions/publishing-extension
https://code.visualstudio.com/api/working-with-extensions/bundling-extension
https://github.com/microsoft/vscode-extension-samples
```
