# Webview

> Webview 让扩展用 HTML/CSS/JS 渲染任意界面，适合图表、富文本预览、自定义表单等
> **用原生 VS Code UI 无法表达**的场景。
> 官方指南：https://code.visualstudio.com/api/extension-guides/webview

## 什么时候该用 Webview

| 优先级 | 方案                        | 场景                             |
| ------ | --------------------------- | -------------------------------- |
| 1      | 原生 API（QuickPick 等）    | 选择、输入、通知、树、状态栏     |
| 2      | TreeView / 自定义编辑器     | 结构化数据、文件预览             |
| 3      | **Webview**                 | 只有在必须自由绘制时才用          |

> Webview 代价：无法复用 VS Code 主题组件、需要自己做 CSP 与状态管理、启动有开销。

## 两种形态

| 形态                  | 创建方式                                     | 适用                 |
| --------------------- | -------------------------------------------- | -------------------- |
| 编辑器面板 Panel      | `window.createWebviewPanel`                  | 独立大页面           |
| 侧边栏视图 View       | `window.registerWebviewViewProvider`         | 常驻面板             |

## 目录结构

```
webview-demo
├── package.json         声明命令
├── media
│   ├── main.js          webview 内脚本
│   ├── style.css        使用 VS Code 主题变量
│   └── logo.svg         通过 asWebviewUri 加载的本地资源
└── src
    └── extension.ts     创建面板 + 消息通信
```

## package.json 配置

```json
{
  "contributes": {
    "commands": [
      { "command": "demo10.showWebview", "title": "Demo10 打开 Webview 面板" }
    ]
  }
}
```

## 创建面板

```typescript
import * as vscode from 'vscode';

let currentPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('demo10.showWebview', () => {
			const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

			// 复用已有面板，避免重复创建
			if (currentPanel) {
				currentPanel.reveal(column);
				return;
			}

			const panel = vscode.window.createWebviewPanel('demo10', 'Demo10 Webview', column, {
				enableScripts: true,             // 允许执行脚本
				retainContextWhenHidden: true,   // 隐藏时保留 DOM（内存开销大）
				localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
			});

			panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
			currentPanel = panel;
		})
	);
}
```

> `localResourceRoots` 是**必须**的安全边界：不配置的话，webview 无法加载扩展目录下的任何资源。

## HTML 与 CSP

```typescript
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	// 把磁盘路径转成 webview 可访问的 vscode-webview-resource:// 地址
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'style.css'));
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
	const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'logo.svg'));

	// 每次生成随机 nonce，配合 CSP 只放行自己的内联/外部脚本
	const nonce = getNonce();

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
	<link href="${styleUri}" rel="stylesheet" />
</head>
<body>
	<img src="${logoUri}" alt="logo" width="48" height="48" />
	<button id="say-hello">发送消息给扩展</button>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
```

CSP 要点：

- 默认写 `default-src 'none'`，再按需放行最小集合；
- `webview.cspSource` 是当前 webview 的资源源，等于允许加载 `localResourceRoots` 下的文件；
- 脚本要么用 `nonce-xxx` 放行，要么用 `webview.cspSource`；不要用 `unsafe-inline`；
- 图片用 `data:` 需要显式写进 `img-src`。

## 双向消息通信

扩展侧：

```typescript
// webview → 扩展
panel.webview.onDidReceiveMessage(
	async (message: { command: string; text?: string }) => {
		switch (message.command) {
			case 'alert':
				await vscode.window.showInformationMessage(message.text ?? '');
				return;
			case 'pickColor': {
				// 扩展 → webview
				const picked = await vscode.window.showQuickPick(['red', 'green', 'blue'], {
					placeHolder: '选择一个颜色',
				});
				panel.webview.postMessage({ command: 'setColor', color: picked });
				return;
			}
		}
	},
	undefined,
	context.subscriptions
);
```

webview 侧（`media/main.js`）：

```javascript
// acquireVsCodeApi 只能调用一次，务必放在模块顶层
const vscode = acquireVsCodeApi();

document.getElementById('say-hello').addEventListener('click', () => {
	vscode.postMessage({ command: 'alert', text: '来自 webview 的问候 👋' });
});

window.addEventListener('message', (event) => {
	const message = event.data;
	if (message.command === 'setColor') {
		document.getElementById('color').textContent = message.color || '（未选择）';
	}
});
```

## 状态持久化

面板被关闭或（未开启 `retainContextWhenHidden` 时）隐藏后，DOM 会被销毁。用 `getState` / `setState` 恢复：

```javascript
const previous = vscode.getState();
if (previous?.color) {
	document.getElementById('color').textContent = previous.color;
}
// 状态变化时写回
vscode.setState({ color: 'red' });
```

> `setState` 的数据会被 VS Code 持久化（面板重建后仍在），但**不会**跨窗口/重启保留。
> 需要长期保存请用 `ExtensionContext.workspaceState` / `globalState`。

## 主题适配

webview 里不要写死颜色，使用 CSS 变量：

```css
body {
	color: var(--vscode-foreground);
	background-color: var(--vscode-editor-background);
	font-family: var(--vscode-font-family);
}
button {
	color: var(--vscode-button-foreground);
	background-color: var(--vscode-button-background);
}
```

可用变量列表：命令面板执行 `Developer: Generate Color Theme From Current Settings`，
或参考 https://code.visualstudio.com/api/references/theme-color

## 生命周期

```typescript
panel.onDidDispose(() => {
	currentPanel = undefined;
}, null, context.subscriptions);
```

- 面板关闭后 `postMessage` 会静默失败，务必清理引用；
- `panel.dispose()` 主动关闭；
- 面板内容变化可监听 `panel.onDidChangeViewState`（可见性变化）。

## 效果验证

1. 用 VS Code 打开 `code/webview-demo`，按 `F5` 启动扩展开发宿主；
2. 命令面板执行 `Demo10 打开 Webview 面板`；
3. 点击「发送消息给扩展」→ 弹出信息提示；
4. 点击「让扩展弹出选择框」→ 选择颜色后页面文字同步更新；
5. 关闭面板再打开 → 颜色状态仍在（`getState`/`setState`）。

调试 webview 前端代码：命令面板执行 `Developer: Open Webview Developer Tools`。

> 📷 待补充截图：`docs/images/webview-demo/webview-panel.png`

## 常见坑

- 页面空白 + 控制台报 CSP 错误 → `localResourceRoots` 或 CSP 没配对；
- `<script>` 不执行 → 忘了 `enableScripts: true`；
- 资源 404 → 直接拼 `file://` 路径，没有用 `asWebviewUri`；
- 中文乱码 → 缺失 `<meta charset="UTF-8">`；
- 消息收不到 → 在 `activate` 之外注册了 `onDidReceiveMessage`，或 `acquireVsCodeApi` 调用了多次。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/webview-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/webview
https://code.visualstudio.com/api/references/vscode-api#WebviewPanel
https://code.visualstudio.com/api/extension-capabilities/extending-workbench
https://github.com/microsoft/vscode-extension-samples/tree/main/webview-sample
```
