import * as vscode from 'vscode';

let myStatusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
	const statusBarClickId = 'demo2.showStatusBar';
	context.subscriptions.push(vscode.commands.registerCommand(statusBarClickId, () => { // 注册 status bar item 点击事件
		vscode.window.showInformationMessage(`click bluefrog status bar`);
	}));
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100); // 展示位置
	myStatusBarItem.command = statusBarClickId; // 绑定点击事件
	context.subscriptions.push(myStatusBarItem); // 注册到上下文
	myStatusBarItem.text = 'bluefrog status bar'; // status bar 要展示的内容
	myStatusBarItem.show(); // 显示
}

// This method is called when your extension is deactivated
export function deactivate() {}