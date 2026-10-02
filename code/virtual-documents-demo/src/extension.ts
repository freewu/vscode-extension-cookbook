import * as vscode from 'vscode';

/** 自定义 scheme：虚拟文档的“协议”，不能与 file / untitled 等内置 scheme 冲突 */
const SCHEME = 'demo14';

/** 虚拟文档的固定地址；path 以 .md 结尾，VS Code 会自动按 markdown 处理 */
const DOC_URI = vscode.Uri.parse(`${SCHEME}://info/readme.md`);

export function activate(context: vscode.ExtensionContext) {
	const provider = new DemoContentProvider();

	// 注册内容提供者：只要有人打开 demo14:// 的文档，就回调 provideTextDocumentContent
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider));

	// 打开虚拟文档
	context.subscriptions.push(
		vscode.commands.registerCommand('demo14.open', async () => {
			// 必须先注册 provider，再 openTextDocument，否则 VS Code 无法解析该 scheme
			const document = await vscode.workspace.openTextDocument(DOC_URI);
			await vscode.window.showTextDocument(document, { preview: false });
		})
	);

	// 内容变化后刷新：通过 onDidChange 通知 VS Code 重新调用 provider
	context.subscriptions.push(vscode.commands.registerCommand('demo14.refresh', () => provider.refresh()));

	// 演示：监听虚拟文档的保存/关闭事件（虚拟文档默认不可编辑、不可保存）
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument((document) => {
			if (document.uri.scheme === SCHEME) {
				console.log('[demo14] 打开虚拟文档：', document.uri.toString(), '语言 =', document.languageId);
			}
		})
	);
}

class DemoContentProvider implements vscode.TextDocumentContentProvider {
	/** 版本号：每次 refresh 递增，用于直观看到内容确实重新生成了 */
	private version = 0;

	// 内容变化事件：fire(uri) 会让 VS Code 重新调用 provideTextDocumentContent
	private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	readonly onDidChange: vscode.Event<vscode.Uri> = this._onDidChange.event;

	refresh(): void {
		this.version += 1;
		this._onDidChange.fire(DOC_URI);
	}

	/**
	 * 生成文档内容。可以是同步返回字符串，也可以返回 Promise。
	 * 这里的实现是"随取随生成"，所以不需要提前把内容存起来。
	 */
	provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): string {
		return [
			'# Demo14 虚拟文档',
			'',
			'这份内容没有对应的磁盘文件，是扩展在内存里生成的。',
			'',
			'| 项目 | 值 |',
			'| --- | --- |',
			`| scheme | \`${uri.scheme}\` |`,
			`| authority | \`${uri.authority}\` |`,
			`| path | \`${uri.path}\` |`,
			`| 版本 | ${this.version} |`,
			`| 生成时间 | ${new Date().toLocaleString()} |`,
			'',
			'> 执行命令 `Demo14 刷新虚拟文档`，可以看到「版本」和「生成时间」变化。',
			'',
			'## 常见用途',
			'',
			'- 展示 Git 提交内容（`git:` scheme 就是内置实现）',
			'- 展示压缩包 / 二进制文件的可读视图',
			'- 把远程接口返回的数据做成"只读文件"，从而复用语法高亮、搜索、Diff',
			'',
		].join('\n');
	}
}

export function deactivate() {}
