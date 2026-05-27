import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "settings-demo" is now active!');

	const disposable = vscode.commands.registerCommand('settings-demo.get.enumExample', () => {
		// 获取枚举值在配置值
		const enumExample = vscode.workspace.getConfiguration().get('demo3.enumExample');
		vscode.window.showInformationMessage('demo3.enumExample: ' + enumExample);
	});

	context.subscriptions.push(disposable);

	// 配置值变化事件
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
		console.log('配置发生变化！', e);
	}));
}

export function deactivate() {}
