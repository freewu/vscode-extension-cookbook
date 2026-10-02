import * as vscode from 'vscode';
import { ToolDefinition, ToolResult } from './tools';

/**
 * 结果面板：一个**单例** Webview，所有工具的结果都渲染在这里。
 *
 * 设计要点：
 * - 结果数据不拼进 HTML，而是 `postMessage` 过去由 webview 用 `textContent` 渲染，
 *   这样用户输入里的 `<script>` 不会被当成 HTML 执行（XSS 的第一道防线）；
 * - webview 需要写剪贴板 / 重新运行，都要把消息发回扩展宿主，由扩展调用 VS Code API；
 * - `retainContextWhenHidden` 保持关闭（省内存），面板被隐藏后靠 `vscode.setState` 恢复。
 */
export class ResultPanel {
	private static current: ResultPanel | undefined;
	private readonly disposables: vscode.Disposable[] = [];
	private lastResult: ToolResult | undefined;
	private lastTool: ToolDefinition | undefined;

	private constructor(
		private readonly panel: vscode.WebviewPanel,
		private readonly extensionUri: vscode.Uri,
		private readonly onRerun: (tool: ToolDefinition) => Promise<void>
	) {
		this.panel.webview.html = this.buildHtml(this.panel.webview);

		this.panel.onDidDispose(() => this.cleanup(), null, this.disposables);

		this.panel.webview.onDidReceiveMessage(
			async (message: { command?: string }) => {
				switch (message.command) {
					case 'copy':
						if (this.lastResult) {
							await vscode.env.clipboard.writeText(this.lastResult.text);
							void vscode.window.setStatusBarMessage('Magic Tools：结果已复制到剪贴板', 3000);
						}
						break;
					case 'rerun':
						if (this.lastTool) {
							await this.onRerun(this.lastTool);
						}
						break;
					case 'ready':
						// webview 脚本就绪后再推数据，避免消息早于监听器注册而丢失
						this.postResult();
						break;
				}
			},
			null,
			this.disposables
		);
	}

	static show(
		extensionUri: vscode.Uri,
		onRerun: (tool: ToolDefinition) => Promise<void>,
		column: vscode.ViewColumn = vscode.ViewColumn.Beside
	): ResultPanel {
		if (ResultPanel.current) {
			ResultPanel.current.panel.reveal(column);
			return ResultPanel.current;
		}
		const panel = vscode.window.createWebviewPanel(
			'magicTools.result',
			'Magic Tools 结果',
			column,
			{
				enableScripts: true,
				retainContextWhenHidden: false,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
			}
		);
		ResultPanel.current = new ResultPanel(panel, extensionUri, onRerun);
		return ResultPanel.current;
	}

	/** 渲染一次工具结果（会自动打开/复用面板） */
	update(tool: ToolDefinition, result: ToolResult): void {
		this.lastTool = tool;
		this.lastResult = result;
		this.panel.title = `Magic Tools：${tool.label}`;
		this.postResult();
	}

	/** 工具抛错时，把错误也当作结果展示，避免只有一行 toast */
	updateError(tool: ToolDefinition, error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);
		this.update(tool, { language: 'text', text: message, summary: `运行失败：${tool.label}` });
	}

	/** 外部主动关闭面板：触发 onDidDispose，随后由 cleanup 收尾 */
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

	private postResult(): void {
		if (!this.lastResult) {
			return;
		}
		const maxLines = vscode.workspace.getConfiguration('magicTools').get<number>('previewMaxLines', 400);
		const lines = this.lastResult.text.split(/\r\n|\n/);
		const truncated = lines.length > maxLines;
		const shown = truncated ? lines.slice(0, maxLines).join('\n') : this.lastResult.text;

		void this.panel.webview.postMessage({
			command: 'result',
			tool: this.lastTool?.label ?? '',
			toolId: this.lastTool?.id ?? '',
			summary: this.lastResult.summary ?? '',
			language: this.lastResult.language,
			text: shown,
			fullLength: this.lastResult.text.length,
			truncated,
			omittedLines: truncated ? lines.length - maxLines : 0,
		});
	}

	private buildHtml(webview: vscode.Webview): string {
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'style.css'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js'));
		const nonce = createNonce();

		// 只允许自己的脚本 + 自己的样式，其余一律拒绝
		const csp = [
			"default-src 'none'",
			`style-src ${webview.cspSource}`,
			`script-src 'nonce-${nonce}'`,
			`font-src ${webview.cspSource}`,
		].join('; ');

		return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
	<head>
		<meta charset="UTF-8" />
		<meta http-equiv="Content-Security-Policy" content="${csp}" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<link href="${styleUri}" rel="stylesheet" />
		<title>Magic Tools 结果</title>
	</head>
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
</html>`;
	}
}

function createNonce(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';
	for (let index = 0; index < 32; index += 1) {
		nonce += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return nonce;
}
