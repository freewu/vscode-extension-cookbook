import * as vscode from 'vscode';

let channel: vscode.LogOutputChannel;
let telemetry: vscode.TelemetryLogger;

export function activate(context: vscode.ExtensionContext) {
	// 带 { log: true } 的输出通道会多出 debug/info/warn/error 等方法和自己的 logLevel
	channel = vscode.window.createOutputChannel('DemoEnv', { log: true });
	context.subscriptions.push(channel);

	// ---------------- 遥测 ----------------
	// createTelemetryLogger 会尊重用户的遥测开关：
	// isTelemetryEnabled 为 false 时，logUsage / logError 不会真正调用 sender。
	telemetry = vscode.env.createTelemetryLogger({
		sendEventData(eventName: string, data?: Record<string, unknown>): void {
			console.log('[demoEnv][telemetry] event:', eventName, data);
		},
		sendErrorData(error: Error, data?: Record<string, unknown>): void {
			console.error('[demoEnv][telemetry] error:', error.message, data);
		},
		flush(): void {
			console.log('[demoEnv][telemetry] flush');
		},
	});
	context.subscriptions.push(telemetry);

	console.log(
		`[demoEnv] 遥测可用性 -> usage: ${telemetry.isUsageEnabled}, errors: ${telemetry.isErrorsEnabled}`
	);

	// ---------------- 命令 ----------------
	context.subscriptions.push(
		vscode.commands.registerCommand('demoEnv.info', () => {
			const env = vscode.env;
			channel.info('================ vscode.env ================');
			channel.info(`appName          = ${env.appName}`);
			channel.info(`appHost          = ${env.appHost}`);
			channel.info(`appRoot          = ${env.appRoot}`);
			channel.info(`uriScheme        = ${env.uriScheme}`);
			channel.info(`language         = ${env.language}`);
			channel.info(`uiKind           = ${vscode.UIKind[env.uiKind]}`);
			channel.info(`remoteName       = ${env.remoteName ?? '(本地窗口)'}`);
			channel.info(`shell            = ${env.shell}`);
			channel.info(`logLevel         = ${vscode.LogLevel[env.logLevel]}`);
			channel.info(`isNewAppInstall  = ${env.isNewAppInstall}`);
			channel.info(`isAppPortable    = ${env.isAppPortable}`);
			channel.info(`isTelemetryEnabled = ${env.isTelemetryEnabled}`);
			channel.info(`machineId        = ${env.machineId}`);
			channel.info(`sessionId        = ${env.sessionId}`);
			channel.show(true);
			void vscode.window.showInformationMessage(`运行环境：${env.appName} / ${env.appHost}`);
		}),

		vscode.commands.registerCommand('demoEnv.clipboard', async () => {
			const before = await vscode.env.clipboard.readText();
			const after = `[demoEnv] ${before}`.trim();
			await vscode.env.clipboard.writeText(after);
			void vscode.window.showInformationMessage(`已写入剪贴板，长度 ${after.length}`);
		}),

		vscode.commands.registerCommand('demoEnv.openExternal', async () => {
			const target = vscode.Uri.parse('https://code.visualstudio.com/api/references/vscode-api');
			// 远程/Web 环境下必须先用 asExternalUri 转换，浏览器才会在客户端打开
			const externalUri = await vscode.env.asExternalUri(target);
			channel.info(`asExternalUri: ${target.toString()} -> ${externalUri.toString()}`);
			const opened = await vscode.env.openExternal(externalUri);
			if (!opened) {
				void vscode.window.showWarningMessage('打开外部链接被拒绝');
			}
			telemetry.logUsage('demoEnv.openExternal', { host: target.authority });
		}),

		vscode.commands.registerCommand('demoEnv.telemetry', async () => {
			const level = await vscode.window.showQuickPick(['info', 'warn', 'error'], {
				placeHolder: '要记录哪个级别的日志 / 遥测？',
			});
			if (!level) {
				return;
			}

			channel[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'](
				`来自命令的 ${level} 日志`
			);
			telemetry.logUsage('demoEnv.log', { level });

			if (level === 'error') {
				telemetry.logError('演示错误', { level, reason: '用户主动触发' });
			}
			void vscode.window.showInformationMessage(`已记录 ${level}（实际发送取决于用户遥测开关）`);
		})
	);

	// ---------------- 运行期变化 ----------------
	context.subscriptions.push(
		vscode.env.onDidChangeTelemetryEnabled((enabled) => {
			console.log('[demoEnv] 遥测开关变化 ->', enabled);
		}),
		vscode.env.onDidChangeShell((shell) => {
			console.log('[demoEnv] 默认 shell 变化 ->', shell);
		}),
		vscode.env.onDidChangeLogLevel((level) => {
			channel.info(`日志级别变化 -> ${vscode.LogLevel[level]}`);
		})
	);
}

export function deactivate() {
	telemetry?.dispose();
}
