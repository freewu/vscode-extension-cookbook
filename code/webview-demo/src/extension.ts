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

			const panel = vscode.window.createWebviewPanel(
				'demo10',
				'Demo10 Webview',
				column,
				{
					// 允许 webview 内执行脚本
					enableScripts: true,
					// 关闭面板后保留 DOM 状态（内存开销较大，按需开启）
					retainContextWhenHidden: true,
					// 安全边界：只允许加载 media 目录下的本地资源
					localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
				}
			);

			panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

			// webview → 扩展：接收消息
			panel.webview.onDidReceiveMessage(
				async (message: { command: string; text?: string }) => {
					switch (message.command) {
						case 'alert':
							await vscode.window.showInformationMessage(message.text ?? '');
							return;
						case 'pickColor': {
							// 扩展 → webview：把 VS Code 的选择结果回传
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

			panel.onDidDispose(
				() => {
					currentPanel = undefined;
				},
				null,
				context.subscriptions
			);

			currentPanel = panel;
		})
	);
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	// asWebviewUri 把磁盘路径转换成 webview 可访问的 vscode-webview-resource:// 地址
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'style.css'));
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
	const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'logo.svg'));

	// 每次生成随机 nonce，配合 CSP 只放行自己的脚本
	const nonce = getNonce();

	return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<!-- 默认禁止一切，再按需放行；webview.cspSource 是当前 webview 的资源源 -->
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
	<link href="${styleUri}" rel="stylesheet" />
	<title>Demo10</title>
</head>
<body>
	<img src="${logoUri}" alt="logo" width="48" height="48" />
	<h1>Demo10 Webview</h1>
	<p>点击下面的按钮与扩展宿主通信。</p>
	<button id="say-hello">发送消息给扩展</button>
	<button id="pick-color">让扩展弹出选择框</button>
	<p>当前颜色：<span id="color">（未选择）</span></p>
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

export function deactivate() {}
