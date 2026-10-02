import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	// ---------------- 运行时文案 ----------------
	context.subscriptions.push(
		vscode.commands.registerCommand('demoL10n.hello', async () => {
			// 位置占位符：{0} {1}
			const name = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Please enter your name'),
			});
			if (!name) {
				return;
			}
			void vscode.window.showInformationMessage(vscode.l10n.t('Hello {0}, welcome to the demo!', name));
		}),

		vscode.commands.registerCommand('demoL10n.survey', () => {
			// 具名占位符：{count}
			const message = vscode.l10n.t('Found {count} installed extensions', {
				count: vscode.extensions.all.length,
			});
			// 带 comment 的写法：comment 会写进 bundle，帮助译者理解上下文
			const hint = vscode.l10n.t({
				message: 'Translation bundle: {state}',
				args: { state: vscode.l10n.bundle ? 'loaded' : 'not loaded' },
				comment: ['{state} is either "loaded" or "not loaded"'],
			});
			void vscode.window.showInformationMessage(`${message}｜${hint}`);
		})
	);

	// ---------------- 调试信息 ----------------
	console.log('[demoL10n] 当前界面语言 env.language =', vscode.env.language);
	console.log('[demoL10n] 运行时语言包 =', vscode.l10n.bundle);
	// l10n.uri 指向当前生效的 bundle 文件；没有本地化时是 undefined
	console.log('[demoL10n] bundle uri =', vscode.l10n.uri?.toString() ?? '(未加载本地化 bundle)');
}

export function deactivate() {}
