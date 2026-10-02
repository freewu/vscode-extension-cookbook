# debug 相关 API

> `vscode.debug` 是**调试器扩展的 VS Code 侧入口**：注册调试适配器、调试配置提供者、
> 观察 DAP 通信、以及用代码启动/停止调试会话。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#debug
> 配套指南：[调试器扩展 Debugger Extension](./guide.debugger-extension.md)

## 全局变量 Variables

| 成员                          | 类型                                  | 说明                                          |
| ----------------------------- | ------------------------------------- | --------------------------------------------- |
| `activeDebugSession`          | `DebugSession \| undefined`           | 当前活动调试会话                              |
| `activeDebugConsole`          | `DebugConsole`                        | 调试控制台，可 `appendLine` / `append`        |
| `activeStackItem`             | `DebugThread \| DebugStackFrame \| undefined` | 当前聚焦的线程/栈帧（用于自定义视图联动） |
| `breakpoints`                 | `readonly Breakpoint[]`               | 所有已设置的断点                              |

## 事件 Events

| 成员                                        | 说明                                       |
| ------------------------------------------- | ------------------------------------------ |
| `onDidStartDebugSession` / `onDidTerminateDebugSession` | 会话开始 / 结束              |
| `onDidChangeActiveDebugSession`             | 活动会话切换                               |
| `onDidReceiveDebugSessionCustomEvent`       | 适配器通过 `customRequest` 之外发的 `event` |
| `onDidChangeBreakpoints`                    | 断点增删改                                 |
| `onDidChangeActiveStackItem`                | 聚焦的栈帧变化                             |

## 方法 Functions

| 成员                                        | 签名                                                          | 说明                                     |
| ------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------- |
| `registerDebugAdapterDescriptorFactory`     | `(debugType, factory) => Disposable`                          | 提供调试适配器（4 种形态）               |
| `registerDebugConfigurationProvider`        | `(debugType, provider, triggerKind?) => Disposable`           | 生成/补全调试配置                        |
| `registerDebugAdapterTrackerFactory`        | `(debugType, factory) => Disposable`                          | 观察 DAP 消息（调试排障神器）            |
| `startDebugging`                            | `(folder: WorkspaceFolder \| undefined, config) => Thenable<boolean>` | 用代码启动调试                    |
| `stopDebugging`                             | `(session?: DebugSession) => Thenable<void>`                  | 结束调试                                 |
| `addBreakpoints` / `removeBreakpoints`      | `(breakpoints: Breakpoint[]) => void`                         | 动态增删断点（配合 `SourceBreakpoint`）  |
| `asDebugSourceUri`                          | `(source: DebugProtocolSource, session?) => Uri`              | 把 DAP 的 source 转成可打开的 `Uri`      |

## 四种适配器描述符

```typescript
// 1) 可执行文件 / Node 脚本（最常见）
new vscode.DebugAdapterExecutable('node', ['/abs/path/adapter.js'], { env: { DEBUG: '1' } });

// 2) 适配器自己监听端口
new vscode.DebugAdapterServer(4711, '127.0.0.1');

// 3) 命名管道
new vscode.DebugAdapterNamedPipeServer('/tmp/demo.pipe');

// 4) 直接在扩展宿主里实现（本仓库的 demo 用这种）
new vscode.DebugAdapterInlineImplementation(new MockDebugSession());

// 5) 工厂里返回 undefined 可以让 VS Code 走 launch.json 里的 debugServer / runtime
```

## DebugConfigurationProvider 的三个钩子

```typescript
vscode.debug.registerDebugConfigurationProvider('demo17', {
	// F5 但没有 launch.json 时生成初始配置
	provideDebugConfigurations: (folder) => [{ type: 'demo17', request: 'launch', name: 'Mock' }],
	// 启动前补全/校验；返回 undefined 或 null 可取消本次调试
	resolveDebugConfiguration: (folder, config) => config,
	// 变量替换（${workspaceFolder} 等）之后再改一遍
	resolveDebugConfigurationWithSubstitutedVariables: (folder, config) => config,
});
```

## 观察 DAP 通信

```typescript
vscode.debug.registerDebugAdapterTrackerFactory('demo17', {
	createDebugAdapterTracker: (session) => ({
		onWillReceiveMessage: (m: any) => console.log('[vscode → adapter]', m.command ?? m.event),
		onDidSendMessage: (m: any) => console.log('[adapter → vscode]', m.command ?? m.event),
		onError: (e) => console.error(e),
		onExit: (code, signal) => console.log('适配器退出', code, signal),
	}),
});
```

> `DebugProtocolMessage` 在 `@types/vscode` 里是**空接口**（故意不透明），
> 想读字段必须自己断言类型，如上例的 `as any`。

## 自定义调试视图

```typescript
const factory: vscode.DebugAdapterDescriptorFactory = { createDebugAdapterDescriptor: () => descriptor };

// 会话内自定义请求
const response = await vscode.debug.activeDebugSession?.customRequest('demo17.echo', { text: 'hi' });

// 自定义事件
vscode.debug.onDidReceiveDebugSessionCustomEvent((e) => console.log(e.event, e.body));
```

配套需要在 `package.json` 里声明视图与 when 条件：

```jsonc
{
  "contributes": {
    "views": {
      "debug": [{ "id": "demo17.panel", "name": "Demo17 面板", "when": "debugType == 'demo17'" }]
    }
  }
}
```

## 效果验证

1. `F5` 启动扩展开发宿主，在宿主里按 `F5` 选择 `Demo17: Mock 调试`；
2. 「运行和调试」视图出现调用栈与变量；
3. 打开 Debug Adapter Tracker 的日志（调试控制台）观察完整 DAP 往返。

> 📷 待补充截图：`docs/images/debugger-demo/mock-session.png`

## 常见坑

- **`registerDebugAdapterDescriptorFactory` 不生效**：`debugType` 与 `contributes.debuggers.type` 不一致；
- **会话卡在"正在启动"**：适配器没回 `initialize` 响应，或没发 `initialized` 事件；
- **`startDebugging` 返回 `false`**：配置里 `type` 无人注册，或用户取消了；
- **`DebugProtocolMessage` 读不到字段**：它是空接口，必须 `as` 断言（见上）；
- **`addBreakpoints` 之前要先确保文件已打开**：否则 `Uri` 无法定位到文档；
- **`onDidReceiveDebugSessionCustomEvent` 只收非标准事件**：标准 DAP 事件不会走这里；
- **调试器扩展记得贡献 `debuggers`**：只注册工厂而不写贡献点，用户无法在 launch.json 里选到该类型。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/debugger-demo

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#debug
https://code.visualstudio.com/api/extension-guides/debugger-extension
https://microsoft.github.io/debug-adapter-protocol/specification
https://code.visualstudio.com/api/references/contribution-points#contributes.debuggers
```
