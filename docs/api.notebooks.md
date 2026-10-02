# notebooks 相关 API

> `vscode.notebooks` 用来做**Notebook 扩展**：为某种 Notebook 实现序列化、
> 提供内核（执行器）、给单元格加状态栏项、以及与渲染器通信。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#notebooks
> 官方指南：https://code.visualstudio.com/api/extension-guides/notebook

## 方法 Functions

| 成员                                       | 签名                                                                                          | 说明                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `createNotebookController`                 | `(id, notebookType, label, handler?) => NotebookController`                                   | 创建控制器（"内核"），执行单元格         |
| `registerNotebookCellStatusBarItemProvider`| `(notebookType: string, provider) => Disposable`                                              | 单元格状态栏项                           |
| `createRendererMessaging`                  | `(rendererId: string) => NotebookRendererMessaging`                                           | 与自己的渲染器双向通信                   |

## 相关命名空间里的 Notebook 能力

| 命名空间    | 成员                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------- |
| `workspace` | `registerNotebookSerializer(type, serializer)`、`openNotebookDocument`、`notebookDocuments`、`onDidChangeNotebookDocument`、`onWillSaveNotebookDocument`、`onDidSaveNotebookDocument`、`onDidOpenNotebookDocument`、`onDidCloseNotebookDocument` |
| `window`    | `showNotebookDocument`、`visibleNotebookEditors`、`activeNotebookEditor`、`onDidChangeNotebookEditorSelection`、`onDidChangeActiveNotebookEditor`、`onDidChangeNotebookEditorVisibleRanges` |

## 三块拼图

| 角色             | 需要实现的东西                                                        |
| ---------------- | --------------------------------------------------------------------- |
| **序列化**       | `NotebookSerializer`：`deserialize` / `serialize`（`NotebookData` ↔ 文件字节） |
| **内核/执行器**  | `NotebookController` + `NotebookCellExecution`（把单元格代码交给运行时执行） |
| **渲染器**（可选）| 一个 Webview 前端 + `contributes.notebookRenderer`，用 `createRendererMessaging` 通信 |

## NotebookController

| 成员                        | 说明                                                       |
| --------------------------- | ---------------------------------------------------------- |
| `id` / `notebookType` / `label` | 标识；`notebookType` 要与贡献点 `notebooks[].type` 一致 |
| `supportedLanguages`        | 该控制器能执行的单元格语言（如 `['python']`）              |
| `supportsExecutionOrder`    | 是否支持执行序号（`[1]`、`[2]`…）                          |
| `description` / `detail`    | 选择内核列表里的补充说明                                   |
| `executeHandler`            | 执行入口：`(cells, notebook, controller) => void`          |
| `interruptHandler`          | 用户点「中断」时调用                                       |
| `createNotebookCellExecution(cell)` | 拿到该单元格的执行句柄，用来回写输出              |
| `updateNotebookAffinity(notebook, affinity)` | 提升自己作为默认内核的优先级           |
| `onDidChangeSelectedNotebooks` | 该控制器被选中/取消选中的事件                           |
| `dispose()`                 | 注销控制器                                                 |

### NotebookCellExecution

```typescript
const execution = controller.createNotebookCellExecution(cell);
execution.executionOrder = ++order;      // 执行序号
execution.start(Date.now());             // 开始计时（必须调用）
await execution.replaceOutput([          // 输出：文本 / 错误 / 富输出
	new vscode.NotebookCellOutput([
		vscode.NotebookCellOutputItem.text('Hello from demo', 'text/plain'),
	]),
]);
execution.end(true, Date.now());         // success + 结束时间（必须调用）
```

> 幂等性：`start` / `end` 只能各调用一次；长时间任务中可以多次
> `replaceOutput` / `appendOutput` 做流式更新。

## 序列化示例

```typescript
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.workspace.registerNotebookSerializer('demo-notebook', {
			async deserializeNotebook(content: Uint8Array): Promise<vscode.NotebookData> {
				const text = new TextDecoder().decode(content);      // 空文件时是空串
				const raw = text ? (JSON.parse(text) as DemoCell[]) : [];
				const cells = raw.map((item) => {
					const cell = new vscode.NotebookCellData(
						item.kind === 'markdown' ? vscode.NotebookCellKind.Markup : vscode.NotebookCellKind.Code,
						item.value,
						item.kind === 'markdown' ? 'markdown' : 'plaintext'
					);
					cell.metadata = { custom: true };                 // 任意自定义元数据
					return cell;
				});
				return new vscode.NotebookData(cells);
			},

			async serializeNotebook(data: vscode.NotebookData): Promise<Uint8Array> {
				const raw: DemoCell[] = data.cells.map((cell) => ({
					kind: cell.kind === vscode.NotebookCellKind.Markup ? 'markdown' : 'code',
					value: cell.value,
				}));
				return new TextEncoder().encode(JSON.stringify(raw, null, 2));
			},
		})
	);
}
```

## 内核示例

```typescript
export function activate(context: vscode.ExtensionContext) {
	const controller = vscode.notebooks.createNotebookController(
		'demo-controller',
		'demo-notebook',
		'Demo 内核'
	);
	controller.supportedLanguages = ['plaintext', 'markdown'];
	controller.supportsExecutionOrder = true;
	context.subscriptions.push(controller);

	controller.executeHandler = async (cells) => {
		for (const cell of cells) {
			const execution = controller.createNotebookCellExecution(cell);
			execution.start(Date.now());
			try {
				// 真实实现：把 cell.document.getText() 交给运行时并收集输出
				await execution.replaceOutput([
					new vscode.NotebookCellOutput([
						vscode.NotebookCellOutputItem.text(`回显：${cell.document.getText()}`, 'text/plain'),
					]),
				]);
				execution.end(true, Date.now());
			} catch (error) {
				await execution.replaceOutput([
					new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.error(error as Error)]),
				]);
				execution.end(false, Date.now());
			}
		}
	};
}
```

## 贡献点

```jsonc
{
  "contributes": {
    "notebooks": [
      {
        "type": "demo-notebook",
        "displayName": "Demo Notebook",
        "selector": [{ "filenamePattern": "*.demo-nb" }],
        "priority": "default"
      }
    ],
    "notebookRenderer": [
      {
        "id": "demo.renderer",
        "displayName": "Demo 渲染器",
        "entrypoint": "./out/renderer.js",
        "mimeTypes": ["application/demo+json"]
      }
    ]
  }
}
```

配套命令与菜单（例如"新建 Notebook"）：

```jsonc
{
  "commands": [{ "command": "demoNotebook.new", "title": "新建 Demo Notebook" }],
  "menus": {
    "commandPalette": [{ "command": "demoNotebook.new" }]
  }
}
```

## 效果验证

1. `F5` 启动扩展开发宿主；
2. 新建 `示例.demo-nb` 文件 → 自动用 Demo 序列化器解析；
3. 点「运行全部」→ 每个单元格出现输出与执行序号；
4. 保存后重新打开 → 内容与单元格类型保持不变；
5. 若实现了渲染器，`application/demo+json` 输出会渲染成自定义 UI。

> 📷 待补充截图：`docs/images/api-notebooks/run-all.png`

## 常见坑

- **`.xxx` 打不开**：`contributes.notebooks[].selector.filenamePattern` 或 `type` 与
  `registerNotebookSerializer` / `createNotebookController` 的 `notebookType` 不一致；
- **单元格一直转圈**：`execution.start()` 与 `execution.end()` 没配对调用；
- **保存后内容丢失**：`serializeNotebook` 没把全部信息（含 `metadata`、输出）写回文件；
- **输出不显示**：`NotebookCellOutputItem.text(value, mime)` 的 mime 要和渲染器支持的匹配；
- **控制器不 dispose**：切换内核后残留，`context.subscriptions.push(controller)`；
- **`executeHandler` 里直接 await 长任务**：会让"全部运行"串行卡住，应该并行/分派并尽快返回；
- **渲染器是 Webview**：即使不需要 `enableScripts` 之外的能力，也要遵守 Webview 的 CSP 与
  资源限制，通信走 `createRendererMessaging`。

## 项目代码
> 本仓库暂无独立 demo，可参考官方 notebook 系列示例：
> https://github.com/microsoft/vscode-extension-samples/tree/main/notebook-serializer-sample

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#notebooks
https://code.visualstudio.com/api/extension-guides/notebook
https://code.visualstudio.com/api/extension-guides/custom-editors
https://github.com/microsoft/vscode-extension-samples/tree/main/notebook-renderer-react-sample
```
