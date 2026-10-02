# env 相关 API

> `vscode.env` 描述**扩展宿主所处的运行环境**：应用名、本地/远程、Web 还是桌面、
> 界面语言、剪贴板、遥测、外部链接、日志级别等。
> 写"跨本地/远程/Web 都能跑"的扩展时，这个命名空间必看。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#env

## 全局变量 Variables

| 成员                        | 类型                        | 说明                                                                 |
| --------------------------- | --------------------------- | -------------------------------------------------------------------- |
| `appName`                   | `string`                    | 应用名（如 `Visual Studio Code`），**不要**用来写 `if` 判断          |
| `appHost`                   | `string`                    | 宿主位置：`desktop` / `web` / `github.dev` / `codespaces`…           |
| `appRoot`                   | `string`                    | 应用安装根目录；Web 端为空字符串                                     |
| `uriScheme`                 | `string`                    | 生成 `vscode://` 深层链接时用的 scheme（Insiders 会是 `vscode-insiders`） |
| `language`                  | `string`                    | 界面语言（如 `zh-cn`），l10n 与日期格式化的依据                      |
| `uiKind`                    | `UIKind`                    | `Desktop` 或 `Web`                                                   |
| `remoteName`                | `string \| undefined`       | `wsl` / `ssh-remote` / `dev-container`…；本地为 `undefined`          |
| `shell`                     | `string`                    | 扩展宿主平台的默认 shell（`terminal.integrated.defaultProfile.*` 可覆盖） |
| `machineId`                 | `string`                    | ⚠️ 机器标识，**属于用户隐私**，只有遥测/许可校验才该用                |
| `sessionId`                 | `string`                    | ⚠️ 本次会话标识，同上                                                |
| `isNewAppInstall`           | `boolean`                   | 是否首次安装运行                                                     |
| `isAppPortable`             | `boolean`                   | 是否便携模式运行                                                     |
| `isTelemetryEnabled`        | `boolean`                   | 用户是否开启了遥测                                                   |
| `logLevel`                  | `LogLevel`                  | 全局日志级别（`Off`~`Trace`）                                        |
| `clipboard`                 | `Clipboard`                 | `readText()` / `writeText()`                                         |

## 事件 Events

| 成员                          | 说明                     |
| ----------------------------- | ------------------------ |
| `onDidChangeTelemetryEnabled` | 遥测开关变化             |
| `onDidChangeShell`            | 默认 shell 变化          |
| `onDidChangeLogLevel`         | 日志级别变化             |

## 方法 Functions

| 成员                 | 签名                                                        | 说明                                                                 |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `openExternal`       | `(uri: Uri) => Thenable<boolean>`                           | 用系统默认程序打开链接（**Web 端会被拦截，需先 asExternalUri**）     |
| `asExternalUri`      | `(uri: Uri) => Thenable<Uri>`                               | 把 `Uri` 转成"在客户端可访问"的形式（远程/Web 端口转发必需）         |
| `createTelemetryLogger` | `(sender: TelemetrySender, options?) => TelemetryLogger` | 创建遥测记录器，**自动尊重用户的遥测开关**                          |

## 示例

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const log = vscode.window.createOutputChannel('DemoEnv', { log: true });
	context.subscriptions.push(log);

	// 1) 环境信息
	log.info(`appHost = ${vscode.env.appHost}`);
	log.info(`uiKind  = ${vscode.UIKind[vscode.env.uiKind]}`);   // Desktop / Web
	log.info(`remote  = ${vscode.env.remoteName ?? '(本地)'}`);
	log.info(`shell   = ${vscode.env.shell}`);

	// 2) 跨环境打开外部链接
	context.subscriptions.push(
		vscode.commands.registerCommand('demoEnv.openExternal', async () => {
			const target = vscode.Uri.parse('https://code.visualstudio.com');
			const external = await vscode.env.asExternalUri(target); // 远程/Web 必需
			await vscode.env.openExternal(external);
		}),

		// 3) 剪贴板
		vscode.commands.registerCommand('demoEnv.clipboard', async () => {
			const text = await vscode.env.clipboard.readText();
			await vscode.env.clipboard.writeText(`[demo] ${text}`);
		})
	);

	// 4) 遥测：isTelemetryEnabled 为 false 时 sender 不会被调用
	const telemetry = vscode.env.createTelemetryLogger({
		sendEventData: (eventName, data) => console.log('event', eventName, data),
		sendErrorData: (error, data) => console.error('error', error.message, data),
		flush: () => console.log('flush'),
	});
	context.subscriptions.push(telemetry);

	telemetry.logUsage('demoEnv.activate', { host: vscode.env.appHost });
	log.info(`遥测可用：usage=${telemetry.isUsageEnabled} errors=${telemetry.isErrorsEnabled}`);
}
```

## 判断运行环境

```typescript
const isWeb = vscode.env.uiKind === vscode.UIKind.Web;
const isRemote = vscode.env.remoteName !== undefined;
const isDesktopLocal = !isWeb && !isRemote;
```

- **不要**用 `env.appName` 或 `env.appRoot` 判断环境（两者在不同发行版/Web 端行为不同）；
- 要区分"扩展自身跑在本地还是远程"，用 `context.extension.extensionKind`。

## 效果验证

1. `F5` 启动扩展开发宿主，执行「DemoEnv 打印运行环境信息」；
2. 在「输出 → DemoEnv」查看全部字段；
3. 尝试「打开外部链接」「读写剪贴板」；
4. 关闭/打开遥测设置，观察 `onDidChangeTelemetryEnabled` 日志。

> 📷 待补充截图：`docs/images/api-env/output-channel.png`

## 常见坑

- **`openExternal` 在 Web/远程下没反应**：必须先 `asExternalUri` 转换；
- **`env.appRoot` 在 Web 端是空串**，别拼路径；
- **`machineId` / `sessionId` 是隐私数据**：只用于遥测与授权，别落盘明文、别打日志；
- **遥测必须走 `createTelemetryLogger`**：自己发 HTTP 请求会绕过用户的遥测设置，
  上架市场时属于违规；
- **`env.shell` 与 `terminal.integrated.defaultProfile` 可能不一致**：它反映的是扩展宿主看到的默认值；
- **`uiKind` 不能判断"是否支持某个 API"**：应该用能力探测（try/catch 或判断函数是否存在）。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/api-env-demo

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#env
https://code.visualstudio.com/api/extension-capabilities/common-capabilities
https://code.visualstudio.com/api/advanced-topics/remote-extensions
https://code.visualstudio.com/api/advanced-topics/using-proposed-api
```
