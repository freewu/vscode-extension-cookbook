import * as vscode from 'vscode';

/** 作用范围：这里用纯文本语言，方便随手打开一个 txt 文件验证 */
const SELECTOR: vscode.DocumentSelector = { language: 'plaintext' };

export function activate(context: vscode.ExtensionContext) {
	// ---------------- 1. 悬停 Hover ----------------
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(SELECTOR, {
			provideHover(document, position) {
				// 只在 TODO 这个词上提供悬停
				const range = document.getWordRangeAtPosition(position, /TODO/);
				if (!range) {
					return undefined;
				}
				const markdown = new vscode.MarkdownString('**TODO** —— 内容由 `api-languages-demo` 提供');
				markdown.isTrusted = true; // 允许渲染命令链接：command:xxx
				markdown.appendMarkdown('\n\n[点我执行命令](command:demoLang.survey)');
				return new vscode.Hover(markdown, range);
			},
		})
	);

	// ---------------- 2. 补全 Completion ----------------
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			SELECTOR,
			{
				provideCompletionItems(document, position) {
					// 用光标前的文本来决定给什么建议
					const linePrefix = document.lineAt(position).text.slice(0, position.character);

					const item = new vscode.CompletionItem('console.log', vscode.CompletionItemKind.Snippet);
					item.insertText = new vscode.SnippetString('console.log(${1:value});');
					item.detail = 'demo 提供的补全';
					item.documentation = new vscode.MarkdownString('插入一条 `console.log`');
					item.filterText = linePrefix + 'console.log';

					return [item];
				},
			},
			'.' // 输入 . 时触发（也可以传多个触发字符）
		)
	);

	// ---------------- 3. 诊断 Diagnostics ----------------
	const diagnostics = vscode.languages.createDiagnosticCollection('demoLang');
	context.subscriptions.push(diagnostics);

	const refreshDiagnostics = (document?: vscode.TextDocument): void => {
		if (!document || document.languageId !== 'plaintext') {
			return;
		}
		const found: vscode.Diagnostic[] = [];
		const text = document.getText();

		for (const match of text.matchAll(/FIXME/g)) {
			const range = new vscode.Range(
				document.positionAt(match.index),
				document.positionAt(match.index + match[0].length)
			);
			const diagnostic = new vscode.Diagnostic(
				range,
				'发现 FIXME，建议处理',
				vscode.DiagnosticSeverity.Warning
			);
			diagnostic.code = 'demo-lang-001';
			diagnostic.source = 'demoLang';
			found.push(diagnostic);
		}

		diagnostics.set(document.uri, found);
	};

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => refreshDiagnostics(event.document)),
		vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
		vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)),
		vscode.window.onDidChangeActiveTextEditor((editor) => refreshDiagnostics(editor?.document)),
		// 诊断变化事件（可以拿到所有 URI 的诊断汇总）
		vscode.languages.onDidChangeDiagnostics((event) => {
			console.log('[demoLang] 诊断发生变化：', event.uris.length, '个文件');
		})
	);

	if (vscode.window.activeTextEditor) {
		refreshDiagnostics(vscode.window.activeTextEditor.document);
	}

	// ---------------- 4. 语言状态项 Language Status Item ----------------
	const statusItem = vscode.languages.createLanguageStatusItem('demoLang.status', SELECTOR);
	statusItem.name = 'DemoLang';
	statusItem.text = '$(beaker) DemoLang';
	statusItem.detail = '由 api-languages-demo 提供';
	statusItem.severity = vscode.LanguageStatusSeverity.Information;
	statusItem.command = { command: 'demoLang.showInfo', title: '查看信息' };
	context.subscriptions.push(statusItem);

	// ---------------- 5. 命令 ----------------
	context.subscriptions.push(
		vscode.commands.registerCommand('demoLang.showInfo', () => {
			void vscode.window.showInformationMessage('语言状态项被点击了');
		}),

		vscode.commands.registerCommand('demoLang.survey', async () => {
			// 查询所有已注册的语言
			const languages = await vscode.languages.getLanguages();
			// 查询所有已有诊断的文件
			const withDiagnostics = vscode.languages.getDiagnostics().length;
			void vscode.window.showInformationMessage(
				`VS Code 支持 ${languages.length} 种语言；当前 ${withDiagnostics} 个文件有诊断`
			);
		})
	);
}

export function deactivate() {}
