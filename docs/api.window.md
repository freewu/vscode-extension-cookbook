# window 相关 API

> `vscode.window` 是**面向用户的一切 UI**：消息提示、输入框、快速选择、状态栏、输出通道、
> 终端、Webview、树视图、文本编辑器的显示。写扩展时用得最多的命名空间。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#window
> 相关指南：[树视图](./guide.tree-view.md)、[Webview](./guide.webview.md)、
> [自定义编辑器](./guide.custom-editors.md)

## 编辑器与终端 Variables

| 成员                            | 类型                              | 说明                                             |
| ------------------------------- | --------------------------------- | ------------------------------------------------ |
| `activeTextEditor`              | `TextEditor \| undefined`         | 当前聚焦的编辑器；**没有编辑器时是 `undefined`** |
| `visibleTextEditors`            | `readonly TextEditor[]`           | 可见编辑器（含分屏）                             |
| `activeNotebookEditor`          | `NotebookEditor \| undefined`     | 当前聚焦的 Notebook 编辑器                       |
| `tabGroups`                     | `TabGroups`                       | 编辑器分组的布局操作接口                         |
| `terminals` / `activeTerminal`  | `readonly Terminal[]` / `Terminal \| undefined` | 由扩展创建的终端                    |
| `state`                         | `WindowState`                     | `{ focused, active }`                            |

## 事件 Events

| 成员                                       | 说明                             |
| ------------------------------------------ | -------------------------------- |
| `onDidChangeActiveTextEditor`              | 活动编辑器切换                   |
| `onDidChangeVisibleTextEditors`            | 可见编辑器集合变化               |
| `onDidChangeTextEditorSelection`           | 选区/光标移动                    |
| `onDidChangeTextEditorVisibleRanges`       | 滚动                             |
| `onDidChangeTextEditorOptions`             | Tab 大小等编辑器选项变化         |
| `onDidChangeTextEditorViewColumn`          | 编辑器被移到别的分栏             |
| `onDidOpenTerminal` / `onDidCloseTerminal` | 扩展创建的终端开/关              |
| `onDidChangeActiveTerminal` / `onDidChangeTerminalState` | 终端焦点/状态       |
| `onDidStartTerminalShellExecution` 等      | Shell 集成事件（1.93+）          |
| `onDidChangeWindowState`                   | 窗口获得/失去焦点                |
| `onDidChangeActiveColorTheme`              | 主题切换（**写主题相关样式必用**） |

## 消息与输入

```typescript
// 提示：返回用户点击的按钮文案，取消则 undefined
const answer = await vscode.window.showInformationMessage('要继续吗？', { modal: true }, '继续', '取消');
// 警告 / 错误同理
await vscode.window.showWarningMessage('注意');
await vscode.window.showErrorMessage('出错了', '查看日志');

// 输入框
const name = await vscode.window.showInputBox({ prompt: '你的名字', placeHolder: 'demo', validateInput: (v) => (v ? undefined : '不能为空') });

// 快速选择
const picked = await vscode.window.showQuickPick(
	[{ label: 'A', description: '选项 A' }, { label: 'B' }],
	{ placeHolder: '请选择', canPickMany: false, matchOnDescription: true }
);

// 选工作区文件夹 / 文件对话框
await vscode.window.showWorkspaceFolderPick();
const uris = await vscode.window.showOpenDialog({ canSelectMany: true, filters: { 文本: ['txt', 'md'] } });
const saveUri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file('/tmp/out.txt') });
```

需要**动态刷新**候选项时用 `createQuickPick` / `createInputBox`（它们是对象，可以 `onDidChangeValue`）：

```typescript
const qp = vscode.window.createQuickPick();
qp.title = '动态列表';
qp.onDidChangeValue(async (value) => {
	qp.busy = true;
	qp.items = await search(value);
	qp.busy = false;
});
qp.onDidAccept(() => qp.hide());
qp.show();
```

## 状态栏 StatusBarItem

```typescript
const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
item.text = '$(sync) 同步中';
item.tooltip = '点击查看详情';
item.command = 'demo.status.click';
item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
item.show(); // 记得放进 subscriptions，并在需要时 dispose
```

> 只有你需要长时间显示状态时才创建状态栏项；短提示用 `setStatusBarMessage(text, timeout)`。

## 输出通道 OutputChannel / LogOutputChannel

```typescript
// 普通输出
const out = vscode.window.createOutputChannel('Demo');
out.appendLine('普通日志');

// 带日志级别的输出（推荐）：会出现在「输出」面板并遵守 logLevel 设置
const log = vscode.window.createOutputChannel('Demo Log', { log: true });
log.info('启动完成');
log.error('出错了', new Error('示例'));
```

## UI 承载物（注册类）

| 成员                                                     | 说明                              | 配套指南                       |
| -------------------------------------------------------- | --------------------------------- | ------------------------------ |
| `createWebviewPanel(viewType, title, column, options)`   | 创建 Webview 面板                 | [Webview](./guide.webview.md)  |
| `registerWebviewViewProvider(viewId, provider)`          | 侧边栏 Webview 视图               | [Webview](./guide.webview.md)  |
| `registerWebviewPanelSerializer(viewType, serializer)`   | 恢复上次会话遗留的 Webview        |                                |
| `createTreeView(viewId, options)` / `registerTreeDataProvider` | 树视图                     | [树视图](./guide.tree-view.md) |
| `registerCustomEditorProvider(viewType, provider)`       | 自定义编辑器                      | [自定义编辑器](./guide.custom-editors.md) |
| `registerFileDecorationProvider(provider)`               | 资源管理器里的徽标/颜色           |                                |
| `createTerminal(options)` / `registerTerminalProfileProvider(id, provider)` | 终端  |                            |
| `registerTerminalLinkProvider` / `registerUriHandler`    | 终端链接 / `vscode://` 协议处理    |                                |
| `createTextEditorDecorationType(options)`                | 创建装饰类型（配合 `setDecorations`） |                            |
| `showTextDocument(document, options?)`                   | 在编辑器中显示文档                |                                |
| `withProgress(options, task)` / `setStatusBarMessage`    | 进度提示 / 状态栏消息             |                                |

## 效果验证

1. `F5` 启动扩展开发宿主；
2. 逐个执行命令，观察消息、输入框、快速选择、状态栏、输出通道；
3. 切换主题观察 `onDidChangeActiveColorTheme` 的日志。

> 📷 待补充截图：`docs/images/api-window/quickpick.png`

## 常见坑

- **`activeTextEditor` 判空**：命令从命令面板触发时可能根本没有活动编辑器；
- **状态栏项不 dispose**：`createStatusBarItem` / `createOutputChannel` 的资源
  必须放进 `subscriptions`，否则扩展停用后还残留；
- **`showInformationMessage` 的按钮最多别超过 3 个**，多了会被折叠到「更多操作」；
- **`createQuickPick` 必须先 `show()` 再设置 items 的异步刷新**，且别忘记处理 `onDidHide` 清理；
- **主题颜色别写死**：用 `ThemeColor('...')` 或 CSS 变量，否则换主题后不可读；
- **`showOpenDialog` 在 Web 环境不支持**（浏览器没有本地文件选择器语义），需要降级方案；
- **`withProgress` 的 `cancellable: true`** 必须配合 `token.onCancellationRequested` 才真的能取消。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/webview-demo
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/tree-view-demo

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#window
https://code.visualstudio.com/api/references/vscode-api#StatusBarItem
https://code.visualstudio.com/api/extension-capabilities/extending-workbench
https://code.visualstudio.com/api/extension-guides/webview
```
