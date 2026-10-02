import * as vscode from 'vscode';

const DEBUG_TYPE = 'demo17';

export function activate(context: vscode.ExtensionContext) {
	// ---------- 1. 提供调试适配器 ----------
	// 常见做法有四种：
	//   DebugAdapterExecutable      独立进程（Node 版适配器）
	//   DebugAdapterServer          监听端口（适配器自己实现 socket）
	//   DebugAdapterNamedPipeServer 命名管道
	//   DebugAdapterInlineImplementation —— 直接在当前扩展宿主里实现，本 demo 用它
	context.subscriptions.push(
		vscode.debug.registerDebugAdapterDescriptorFactory(DEBUG_TYPE, {
			createDebugAdapterDescriptor: (_session) =>
				new vscode.DebugAdapterInlineImplementation(new MockDebugSession(context.extensionUri)),
		})
	);

	// ---------- 2. 补全 / 生成调试配置 ----------
	context.subscriptions.push(
		vscode.debug.registerDebugConfigurationProvider(DEBUG_TYPE, {
			// 用户按 F5 但还没有 launch.json 时，提供初始配置
			provideDebugConfigurations: () => [
				{ type: DEBUG_TYPE, request: 'launch', name: 'Demo17: Mock 调试', stopOnEntry: true },
			],
			// 启动前补全缺省值；返回 undefined 可以取消本次调试
			resolveDebugConfiguration: (_folder, config) => {
				config.stopOnEntry = config.stopOnEntry ?? true;
				config.program = config.program ?? '${file}';
				return config;
			},
		})
	);

	// ---------- 3. 观察 DAP 通信（调试适配器协议） ----------
	context.subscriptions.push(
		vscode.debug.registerDebugAdapterTrackerFactory(DEBUG_TYPE, {
			createDebugAdapterTracker: () => ({
				onWillReceiveMessage: (message: any) => console.log('[vscode → demo17]', message.command ?? message.event),
				onDidSendMessage: (message: any) => console.log('[demo17 → vscode]', message.command ?? message.event),
				onExit: (code: number | undefined) => console.log('[demo17] 适配器退出，code =', code),
			}),
		})
	);

	context.subscriptions.push(
		vscode.debug.onDidStartDebugSession((session) => {
			if (session.type === DEBUG_TYPE) {
				console.log('[demo17] 会话开始：', session.name);
			}
		}),
		vscode.debug.onDidTerminateDebugSession((session) => {
			if (session.type === DEBUG_TYPE) {
				console.log('[demo17] 会话结束：', session.name);
			}
		})
	);
}

/**
 * 一个最小的调试适配器实现：不真的执行程序，只按 DAP 协议"演出"一次断点命中。
 * 真实适配器一般会继承某个 DAP 库的 DebugSession，这里为了自包含手写了消息处理。
 */
class MockDebugSession implements vscode.DebugAdapter {
	private readonly _onDidSendMessage = new vscode.EventEmitter<vscode.DebugProtocolMessage>();
	readonly onDidSendMessage: vscode.Event<vscode.DebugProtocolMessage> = this._onDidSendMessage.event;

	/** DAP 要求每个发出的消息带自增 seq */
	private seq = 1;
	/** 被"调试"的源码位置：指向扩展自带的 mock/demo.js，这样中断时能定位到真实文件 */
	private readonly sourcePath: string;
	private stopOnEntry = true;

	constructor(extensionUri: vscode.Uri) {
		this.sourcePath = vscode.Uri.joinPath(extensionUri, 'mock', 'demo.js').fsPath;
	}

	handleMessage(message: vscode.DebugProtocolMessage): void {
		// DebugProtocolMessage 在 @types/vscode 里是空接口（opaque），字段需要自行断言
		const msg = message as {
			seq?: number;
			type?: string;
			command?: string;
			arguments?: Record<string, any>;
		};

		if (msg.type !== 'request' || !msg.command) {
			return;
		}

		switch (msg.command) {
			// -------- 初始化握手 --------
			case 'initialize':
				this.respond(msg, {
					supportsConfigurationDoneRequest: true,
					supportsEvaluateForHovers: true,
					supportsSetVariable: false,
				});
				// 告诉 VS Code "我准备好了，可以把断点发过来了"
				this.event('initialized');
				break;

			case 'launch':
			case 'attach':
				this.stopOnEntry = msg.arguments?.stopOnEntry ?? true;
				this.respond(msg);
				break;

			case 'setBreakpoints':
				this.respond(msg, {
					breakpoints: (msg.arguments?.breakpoints ?? []).map((bp: any) => ({
						verified: true,
						line: bp.line,
					})),
				});
				break;

			case 'setExceptionBreakpoints':
			case 'setFunctionBreakpoints':
			case 'configurationDone':
				this.respond(msg);
				if (msg.command === 'configurationDone') {
					// 所有配置就绪，这里"假装"命中了断点
					this.event('stopped', {
						reason: this.stopOnEntry ? 'entry' : 'breakpoint',
						threadId: 1,
						allThreadsStopped: true,
					});
				}
				break;

			// -------- 停下来之后 VS Code 会依次问这些 --------
			case 'threads':
				this.respond(msg, { threads: [{ id: 1, name: 'mock 主线程' }] });
				break;

			case 'stackTrace':
				this.respond(msg, {
					totalFrames: 1,
					stackFrames: [
						{
							id: 1000,
							name: 'mockFrame',
							line: 4,
							column: 1,
							source: { name: 'demo.js', path: this.sourcePath },
						},
					],
				});
				break;

			case 'scopes':
				this.respond(msg, {
					scopes: [{ name: '局部变量', variablesReference: 1, expensive: false }],
				});
				break;

			case 'variables':
				this.respond(msg, {
					variables:
						msg.arguments?.variablesReference === 1
							? [
									{ name: 'name', value: "'demo17'", variablesReference: 0 },
									{ name: 'count', value: '1', variablesReference: 0 },
								]
							: [],
				});
				break;

			case 'evaluate':
				this.respond(msg, {
					result: `mock 求值结果：${msg.arguments?.expression ?? ''}`,
					variablesReference: 0,
				});
				break;

			// -------- 继续执行 --------
			case 'continue':
			case 'next':
			case 'stepIn':
			case 'stepOut':
				this.respond(msg, { allThreadsContinued: true });
				// mock 程序只有一步，直接结束会话
				this.event('exited', { exitCode: 0 });
				this.event('terminated');
				break;

			case 'pause':
				this.respond(msg);
				this.event('stopped', { reason: 'pause', threadId: 1 });
				break;

			case 'disconnect':
			case 'terminate':
				this.respond(msg);
				this.event('terminated');
				break;

			// -------- 兜底：任何未处理的请求都回一个成功的空响应 --------
			default:
				this.respond(msg);
				break;
		}
	}

	private respond(request: { seq?: number; command?: string }, body?: unknown): void {
		this.send({
			type: 'response',
			request_seq: request.seq,
			success: true,
			command: request.command,
			body,
		});
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

export function deactivate() {}
