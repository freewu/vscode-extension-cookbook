import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	// 注册自定义编辑器：viewType 必须与 package.json 中 contributes.customEditors 的 viewType 一致
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider('demo13.catEditor', new CatEditorProvider(context), {
			// 面板被隐藏时保留 DOM（编辑器场景一般开启，编辑体验更顺滑）
			webviewOptions: { retainContextWhenHidden: true },
			// 同一个文档是否允许同时打开多个自定义编辑器
			supportsMultipleEditorsPerDocument: false,
		})
	);

	// 生成一个示例文件，方便直接体验
	context.subscriptions.push(
		vscode.commands.registerCommand('demo13.createSample', async () => {
			const folder = vscode.workspace.workspaceFolders?.[0];
			if (!folder) {
				void vscode.window.showWarningMessage('请先打开一个文件夹工作区');
				return;
			}
			const uri = vscode.Uri.joinPath(folder.uri, 'demo13-cat.cat');
			const content = JSON.stringify({ name: '咪咪', age: 3, color: 'orange' }, null, 2);
			await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
			// 用指定的自定义编辑器打开
			await vscode.commands.executeCommand('vscode.openWith', uri, 'demo13.catEditor');
		})
	);
}

/**
 * CustomTextEditorProvider：自定义编辑器的一种，宿主仍然把它当作**文本文档**管理。
 * 优点：保存、撤销/重做、脏标记、文件监视全部由 VS Code 负责，我们只负责渲染与回写。
 * 二进制格式请改用 CustomEditorProvider（自行处理 save / backup / revert）。
 */
class CatEditorProvider implements vscode.CustomTextEditorProvider {
	constructor(private readonly context: vscode.ExtensionContext) {}

	async resolveCustomTextEditor(
		document: vscode.TextDocument,
		panel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
		};
		panel.webview.html = this.getHtml(panel.webview);

		// ---------- 文档 → webview ----------
		const syncToWebview = () => {
			void panel.webview.postMessage({ type: 'update', text: document.getText() });
		};
		syncToWebview();

		// 文档变化时同步（包括 VS Code 自己的撤销/重做）
		const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document.uri.toString() === document.uri.toString()) {
				syncToWebview();
			}
		});
		panel.onDidDispose(() => changeSubscription.dispose());

		// ---------- webview → 文档 ----------
		panel.webview.onDidReceiveMessage(
			async (message: { type: string; text?: string; message?: string }) => {
				switch (message.type) {
					case 'edit': {
						if (message.text === undefined) {
							return;
						}
						// 关键：必须用 WorkspaceEdit 修改文档，才能获得撤销/脏标记/保存能力
						const edit = new vscode.WorkspaceEdit();
						const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
						edit.replace(document.uri, fullRange, message.text);
						await vscode.workspace.applyEdit(edit);
						return;
					}
					case 'reload':
						// 放弃 webview 里的本地修改，重新用文档内容覆盖
						syncToWebview();
						return;
					case 'info':
						void vscode.window.showInformationMessage(message.message ?? '');
						return;
				}
			},
			undefined,
			this.context.subscriptions
		);
	}

	private getHtml(webview: vscode.Webview): string {
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'cat.css')
		);
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'cat.js')
		);
		const nonce = getNonce();

		return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
	<link href="${styleUri}" rel="stylesheet" />
</head>
<body>
	<h2>🐱 猫咪信息（demo13.catEditor）</h2>
	<p class="hint">编辑下面的 JSON，点击「应用」写回文档（会产生脏标记，Ctrl+S 保存，Ctrl+Z 撤销）。</p>
	<textarea id="editor" spellcheck="false"></textarea>
	<p id="status" class="status"></p>
	<div class="actions">
		<button id="apply">应用</button>
		<button id="reload">放弃修改</button>
		<button id="ping">问问扩展宿主</button>
	</div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
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
