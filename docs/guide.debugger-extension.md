# 调试器扩展 Debugger Extension

> 调试器扩展示例分两半：**VS Code 侧的 UI**（调用栈、变量、断点）由 VS Code 提供，
> 扩展只需要实现一个**调试适配器（Debug Adapter）**，用 DAP（Debug Adapter Protocol）与 VS Code 通信。
> 官方指南：https://code.visualstudio.com/api/extension-guides/debugger-extension
> DAP 规范：https://microsoft.github.io/debug-adapter-protocol/

## 两类扩展别混淆

| 目标                             | 用到的 API                                  |
| -------------------------------- | ------------------------------------------- |
| 接入一门新语言/运行时的调试器    | `contributes.debuggers` + Debug Adapter     |
| 只是「一键启动调试」或补全配置   | `debug.registerDebugConfigurationProvider`  |
| 观察/记录 DAP 通信               | `debug.registerDebugAdapterTrackerFactory`  |

> 如果你要做的是「给某个语言做调试支持」，最省事的路线是**复用现成适配器**
> （如 `debugpy`、`daprd`、`vscode-java-debug` 的 jar），只写配置贡献点。

## 目录结构

```
debugger-demo
├── mock
│   └── demo.js           被"调试"的源码（不会真的执行，只用于给出源码位置）
├── package.json          contributes.debuggers
└── src
    └── extension.ts      MockDebugSession（内联 DAP 适配器）
```

## package.json 配置

```json
{
  "activationEvents": ["onDebug", "onDebugResolve:demo17", "onDebugInitialConfigurations"],
  "contributes": {
    "debuggers": [
      {
        "type": "demo17",
        "label": "Demo17 Mock 调试器",
        "languages": ["javascript"],
        "configurationAttributes": {
          "launch": {
            "properties": {
              "stopOnEntry": { "type": "boolean", "default": true },
              "program": { "type": "string", "default": "${file}" }
            }
          }
        },
        "initialConfigurations": [
          { "type": "demo17", "request": "launch", "name": "Demo17: Mock 调试", "stopOnEntry": true }
        ],
        "configurationSnippets": [
          {
            "label": "Demo17: Mock 调试",
            "body": { "type": "demo17", "request": "launch", "name": "Demo17: Mock 调试" }
          }
        ]
      }
    ]
  }
}
```

| 字段                       | 作用                                                     |
| -------------------------- | -------------------------------------------------------- |
| `type`                     | 调试类型，launch.json 里的 `"type": "demo17"`            |
| `label`                    | 调试配置下拉里的名字                                     |
| `configurationAttributes`  | launch.json 的字段校验与默认值（写错会标红）             |
| `initialConfigurations`    | 首次按 F5 时生成的 launch.json 内容                      |
| `configurationSnippets`    | 智能提示里可插入的配置片段                               |
| `languages`                | 关联语言，决定「运行和调试」里的默认入口                 |
| `breakpoints`              | 动态断点：按源码内容计算可打断点的位置（可选）           |

激活事件：`onDebug`（会话开始）、`onDebugResolve:demo17`（解析该类型的调试配置）、
`onDebugInitialConfigurations`（需要生成 launch.json 提示时）。

## 提供调试适配器

```typescript
import * as vscode from 'vscode';

const DEBUG_TYPE = 'demo17';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.debug.registerDebugAdapterDescriptorFactory(DEBUG_TYPE, {
			createDebugAdapterDescriptor: (_session) =>
				new vscode.DebugAdapterInlineImplementation(new MockDebugSession(context.extensionUri)),
		})
	);
}
```

四种适配器形态：

| 类型                             | 场景                                       |
| -------------------------------- | ------------------------------------------ |
| `DebugAdapterExecutable`         | 适配器是独立可执行文件/Node 脚本（最常见） |
| `DebugAdapterServer`             | 适配器自己监听端口（如 Java/Python）       |
| `DebugAdapterNamedPipeServer`    | 适配器监听命名管道                         |
| `DebugAdapterInlineImplementation` | 直接在当前扩展宿主里实现（本 demo）      |

## 实现适配器（DAP）

`vscode.DebugAdapter` 接口只有三个成员：

```typescript
interface DebugAdapter extends Disposable {
	readonly onDidSendMessage: Event<DebugProtocolMessage>;
	handleMessage(message: DebugProtocolMessage): void;
}
```

- 你 `fire` 出的每条消息都会被转发给 VS Code；
- VS Code 发来的每个请求都在 `handleMessage` 里收到。

### 握手顺序（必须按这个节奏）

```
VS Code                    适配器
   │  initialize        →   │   回应 capabilities
   │  ←  event initialized  │   "我准备好了"
   │  setBreakpoints    →   │   回应 verified 断点
   │  configurationDone →   │   回应后发 event stopped（reason: entry/breakpoint）
   │  threads           →   │   线程列表
   │  stackTrace        →   │   调用栈
   │  scopes/variables  →   │   变量
   │  continue          →   │   回应 + event exited + event terminated
```

### 核心代码

```typescript
class MockDebugSession implements vscode.DebugAdapter {
	private readonly _onDidSendMessage = new vscode.EventEmitter<vscode.DebugProtocolMessage>();
	readonly onDidSendMessage: vscode.Event<vscode.DebugProtocolMessage> = this._onDidSendMessage.event;

	private seq = 1;
	private readonly sourcePath: string;

	constructor(extensionUri: vscode.Uri) {
		this.sourcePath = vscode.Uri.joinPath(extensionUri, 'mock', 'demo.js').fsPath;
	}

	handleMessage(message: vscode.DebugProtocolMessage): void {
		// DebugProtocolMessage 在 @types/vscode 里是空接口（opaque），字段需要自行断言
		const msg = message as { type?: string; command?: string; arguments?: Record<string, any> };
		if (msg.type !== 'request' || !msg.command) {
			return;
		}

		switch (msg.command) {
			case 'initialize':
				this.respond(msg, { supportsConfigurationDoneRequest: true });
				this.event('initialized'); // 关键：通知 VS Code 可以发断点了
				break;

			case 'launch':
				this.stopOnEntry = msg.arguments?.stopOnEntry ?? true;
				this.respond(msg);
				break;

			case 'setBreakpoints':
				this.respond(msg, {
					breakpoints: (msg.arguments?.breakpoints ?? []).map((bp: any) => ({ verified: true, line: bp.line })),
				});
				break;

			case 'configurationDone':
				this.respond(msg);
				// 所有配置就绪，这里"假装"命中了断点
				this.event('stopped', { reason: this.stopOnEntry ? 'entry' : 'breakpoint', threadId: 1 });
				break;

			case 'threads':
				this.respond(msg, { threads: [{ id: 1, name: 'mock 主线程' }] });
				break;

			case 'stackTrace':
				this.respond(msg, {
					totalFrames: 1,
					stackFrames: [
						{ id: 1000, name: 'mockFrame', line: 4, column: 1, source: { name: 'demo.js', path: this.sourcePath } },
					],
				});
				break;

			case 'scopes':
				this.respond(msg, { scopes: [{ name: '局部变量', variablesReference: 1, expensive: false }] });
				break;

			case 'variables':
				this.respond(msg, {
					variables:
						msg.arguments?.variablesReference === 1
							? [{ name: 'name', value: "'demo17'", variablesReference: 0 }]
							: [],
				});
				break;

			case 'continue':
			case 'next':
				this.respond(msg, { allThreadsContinued: true });
				this.event('exited', { exitCode: 0 });
				this.event('terminated');
				break;

			default:
				this.respond(msg); // 兜底：任何未处理的请求回成功空响应
				break;
		}
	}

	private respond(request: { seq?: number; command?: string }, body?: unknown): void {
		this.send({ type: 'response', request_seq: request.seq, success: true, command: request.command, body });
	}

	private event(event: string, body?: unknown): void {
		this.send({ type: 'event', event, body });
	}

	private send(message: unknown): void {
		this._onDidSendMessage.fire({ ...(message as object), seq: this.seq++ } as vscode.DebugProtocolMessage);
	}

	dispose(): void {
		this._onDidSendMessage.dispose();
	}
}
```

要点：

- **每条 response 必须带 `request_seq`**，否则 VS Code 无法把响应和请求对应起来；
- `stackFrames[].source.path` 指向真实文件时，VS Code 才能打开源码并高亮行号；
- 会话结束必须发 `terminated`（发 `exited` 只是标记进程退出）；
- 真实适配器通常会继承某个 DAP 库的 `DebugSession`（Node 用 `@vscode/debugadapter`），
  不必手写消息分发。

## 配置提供者（可单独使用）

```typescript
context.subscriptions.push(
	vscode.debug.registerDebugConfigurationProvider(DEBUG_TYPE, {
		// 用户按 F5 但还没有 launch.json 时提供初始配置
		provideDebugConfigurations: () => [
			{ type: DEBUG_TYPE, request: 'launch', name: 'Demo17: Mock 调试', stopOnEntry: true },
		],
		// 启动前补全缺省值；返回 undefined 可以取消本次调试
		resolveDebugConfiguration: (_folder, config) => {
			config.stopOnEntry = config.stopOnEntry ?? true;
			return config;
		},
		// 变量替换（${workspaceFolder} 等）之后再改一遍，可以拿到解析后的路径
		resolveDebugConfigurationWithSubstitutedVariables: (_folder, config) => config,
	})
);
```

也可以用代码启动调试：

```typescript
await vscode.debug.startDebugging(vscode.workspace.workspaceFolders?.[0], {
	type: DEBUG_TYPE,
	request: 'launch',
	name: 'Demo17: 代码启动',
});
```

## 观察 DAP 通信

```typescript
context.subscriptions.push(
	vscode.debug.registerDebugAdapterTrackerFactory(DEBUG_TYPE, {
		createDebugAdapterTracker: () => ({
			onWillReceiveMessage: (message: any) => console.log('[vscode → adapter]', message.command ?? message.event),
			onDidSendMessage: (message: any) => console.log('[adapter → vscode]', message.command ?? message.event),
			onExit: (code: number | undefined) => console.log('适配器退出，code =', code),
		}),
	})
);
```

这是排查"配置没生效 / 断点不命中"的第一手段。

## 效果验证

1. 用 VS Code 打开 `code/debugger-demo`，按 `F5` 启动扩展开发宿主；
2. 在扩展宿主里按 `F5` → 选择 `Demo17: Mock 调试`；
3. 会话在入口处中断（`stopped`），「运行和调试」视图出现：
   - 调用栈：`mockFrame`（打开 `mock/demo.js` 第 4 行）
   - 变量：`name = 'demo17'`
4. 按 `F10`（单步）或继续 → 会话结束，调试控制台打印退出码；
5. 调试控制台输入表达式 → `evaluate` 返回 `mock 求值结果：<表达式>`。

> 📷 待补充截图：`docs/images/debugger-demo/mock-session.png`

## 常见坑

- **按 F5 提示"找不到调试适配器"**：`registerDebugAdapterDescriptorFactory` 的 type 与
  `contributes.debuggers.type` 不一致，或扩展没被激活（补 `onDebug` / `onDebugResolve:type`）；
- **会话一直转圈**：忘了在 `initialize` 之后发 `initialized` 事件，或没处理 `configurationDone`；
- **调用栈点击无法打开源码**：`stackFrames[].source.path` 为空或路径不可解析；
- **断点变空心**：`setBreakpoints` 没回 `verified: true`；静态断点也可以用
  `contributes.debuggers[].breakpoints` 预声明；
- **VS Code 提示响应超时**：`response` 缺 `request_seq`；
- **会话结束但 UI 不恢复**：只发了 `exited` 没发 `terminated`；
- **热退出后窗口卡住**：`dispose()` 里没释放 `EventEmitter`。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/debugger-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/debugger-extension
https://code.visualstudio.com/api/references/vscode-api#debug
https://microsoft.github.io/debug-adapter-protocol/
https://github.com/microsoft/vscode-debugadapter-node
https://github.com/microsoft/vscode-mock-debug
```
