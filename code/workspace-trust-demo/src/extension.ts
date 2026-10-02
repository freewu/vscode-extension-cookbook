import * as vscode from 'vscode';

const CONFIG_SECTION = 'demo7';

export function activate(context: vscode.ExtensionContext) {
	// 1. 读取当前工作区的信任状态
	context.subscriptions.push(
		vscode.commands.registerCommand('demo7.showTrustStatus', async () => {
			const status = vscode.workspace.isTrusted ? '已信任（trusted）' : '受限模式（restricted）';
			await vscode.window.showInformationMessage(`工作区状态：${status}`);
		})
	);

	// 2. 敏感操作必须显式判断 isTrusted，未信任时引导用户授权
	context.subscriptions.push(
		vscode.commands.registerCommand('demo7.runScript', async () => {
			if (!vscode.workspace.isTrusted) {
				// 不提供 requestWorkspaceTrust API，引导用户走 VS Code 自身的授权入口：
				// 窗口顶部的「限制模式」横幅，或命令面板 “Workspaces: Manage Workspace Trust”
				await vscode.window.showWarningMessage(
					'执行脚本需要信任工作区。请点击窗口顶部的「限制模式」横幅，或执行 “Workspaces: Manage Workspace Trust” 完成授权。'
				);
				return;
			}
			// 只有受信任的工作区才会走到这里
			await vscode.window.showInformationMessage('正在执行脚本……（受信任代码路径）');
		})
	);

	// 3. 监听信任状态变化：信任后启用完整功能
	context.subscriptions.push(
		vscode.workspace.onDidGrantWorkspaceTrust(() => {
			console.log('[demo7] 工作区已被信任，启动完整功能');
		})
	);

	// 4. 受限配置项：restrictedConfigurations 中的配置在受限模式下读不到值
	const token = vscode.workspace.getConfiguration(CONFIG_SECTION).get<string>('secretToken');
	console.log('[demo7] secretToken =', token || '（受限模式下为空）');
}

export function deactivate() {}
