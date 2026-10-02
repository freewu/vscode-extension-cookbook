import * as vscode from 'vscode';

/** 纯函数：不依赖 VS Code API，可以在普通单元测试里直接断言 */
export function add(a: number, b: number): number {
	return a + b;
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('demo12.add', (a: number, b: number) => {
			const result = add(a, b);
			vscode.window.showInformationMessage(`${a} + ${b} = ${result}`);
			// 返回值会被 executeCommand 的 Promise 解析，方便测试断言
			return result;
		})
	);
}

export function deactivate() {}
