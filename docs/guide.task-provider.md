# 任务提供者 Task Provider

> 任务提供者让扩展向 VS Code 的「任务」系统注册**动态任务**，用户无需手写 `tasks.json`
> 就能在 `Terminal → Run Task` 里看到它们（编译、测试、部署、代码生成都常用）。
> 官方指南：https://code.visualstudio.com/api/extension-guides/task-provider

## 三条主线

| 环节                | API                                        | 作用                             |
| ------------------- | ------------------------------------------ | -------------------------------- |
| 声明任务类型        | `contributes.taskDefinitions`              | 让 `tasks.json` 能写 `"type": "demo15"` |
| 提供任务            | `tasks.registerTaskProvider` → `provideTasks` | 代码式生成任务                |
| 解析 `tasks.json`   | `TaskProvider.resolveTask`                 | 把用户写的配置补全为可执行任务   |

## 目录结构

```
task-provider-demo
├── package.json          taskDefinitions + 命令
└── src
    └── extension.ts      DemoTaskProvider / DemoPseudoterminal
```

## package.json 配置

```json
{
  "contributes": {
    "taskDefinitions": [
      {
        "type": "demo15",
        "required": ["command"],
        "properties": {
          "command": { "type": "string", "description": "要执行的 mock 命令名" },
          "args": { "type": "array", "items": { "type": "string" }, "default": [] },
          "fail": { "type": "boolean", "default": false }
        }
      }
    ]
  }
}
```

> 激活时机：自 VS Code **1.76** 起，贡献了 `taskDefinitions` 的扩展会被自动激活，
> 不需要写 `activationEvents`。如果要兼容更老的版本，可以显式声明
> `"activationEvents": ["onTaskType:demo15"]`
> （`onTaskType:type is emitted whenever tasks of a certain type need to be listed or resolved`）。

## 注册提供者

```typescript
import * as vscode from 'vscode';

interface DemoTaskDefinition extends vscode.TaskDefinition {
	command: string;
	args?: string[];
	fail?: boolean;
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.tasks.registerTaskProvider('demo15', new DemoTaskProvider()));

	// 从已注册任务里挑一个运行
	context.subscriptions.push(
		vscode.commands.registerCommand('demo15.pickTask', async () => {
			const tasks = await vscode.tasks.fetchTasks({ type: 'demo15' });
			const picked = await vscode.window.showQuickPick(
				tasks.map((task) => ({ label: task.name, description: task.source, task })),
				{ placeHolder: '选择要运行的任务' }
			);
			if (picked) {
				await vscode.tasks.executeTask(picked.task);
			}
		})
	);
}
```

## provideTasks：代码式任务

任务的 execution 有三种，按需要选：

```typescript
class DemoTaskProvider implements vscode.TaskProvider {
	provideTasks(): vscode.ProviderResult<vscode.Task[]> {
		return [
			this.createShellTask('hello'),
			this.createProcessTask('node-version'),
			this.createCustomTask('custom-terminal'),
			this.createFailingTask('failing'),
		];
	}

	/** 1. ShellExecution：在集成终端里执行命令行（会经过 shell，支持重定向/管道） */
	private createShellTask(name: string): vscode.Task {
		const definition: DemoTaskDefinition = { type: 'demo15', command: name };
		const task = new vscode.Task(
			definition,
			vscode.TaskScope.Workspace, // 也可以是某个 workspaceFolder
			name,                       // 任务名
			'demo15',                   // source：在 UI 里显示为 "demo15: hello"
			// 用 (命令, 参数数组) 形式，参数会自动转义
			new vscode.ShellExecution('echo', ['hello from demo15'])
		);
		task.group = vscode.TaskGroup.Build; // 归入"生成"任务组，Ctrl+Shift+B 可见
		task.presentationOptions = {
			reveal: vscode.TaskRevealKind.Always,
			panel: vscode.TaskPanelKind.Shared, // 多个任务复用同一个终端面板
			clear: true,
		};
		return task;
	}

	/** 2. ProcessExecution：直接启动进程，不经过 shell（更安全、更快） */
	private createProcessTask(name: string): vscode.Task {
		const definition: DemoTaskDefinition = { type: 'demo15', command: 'node', args: ['--version'] };
		return new vscode.Task(
			definition,
			vscode.TaskScope.Workspace,
			name,
			'demo15',
			new vscode.ProcessExecution('node', ['--version'])
		);
	}

	/** 3. CustomExecution：完全由扩展驱动输出，不启动任何进程 */
	private createCustomTask(name: string): vscode.Task {
		const definition: DemoTaskDefinition = { type: 'demo15', command: name };
		const execution = new vscode.CustomExecution(
			async (): Promise<vscode.Pseudoterminal> => new DemoPseudoterminal()
		);
		return new vscode.Task(definition, vscode.TaskScope.Workspace, name, 'demo15', execution);
	}

	/** 4. 故意失败的任务，用来观察 exitCode */
	private createFailingTask(name: string): vscode.Task {
		const definition: DemoTaskDefinition = { type: 'demo15', command: name, fail: true };
		return new vscode.Task(
			definition,
			vscode.TaskScope.Workspace,
			name,
			'demo15',
			new vscode.ShellExecution('node', ['-e', 'process.exit(1)'])
		);
	}
}
```

### Pseudoterminal（CustomExecution 的搭档）

```typescript
class DemoPseudoterminal implements vscode.Pseudoterminal {
	private readonly writeEmitter = new vscode.EventEmitter<string>();
	private readonly closeEmitter = new vscode.EventEmitter<number>();

	readonly onDidWrite: vscode.Event<string> = this.writeEmitter.event;
	readonly onDidClose: vscode.Event<number> = this.closeEmitter.event;

	open(): void {
		// 终端里换行必须是 \r\n
		this.writeEmitter.fire('CustomExecution 正在运行……\r\n');
		this.closeEmitter.fire(0); // 关闭并给出退出码
	}

	close(): void {
		// 用户关闭终端时清理资源
	}
}
```

## resolveTask：解析 tasks.json

用户在 `.vscode/tasks.json` 里只写：

```json
{
  "version": "2.0.0",
  "tasks": [{ "type": "demo15", "command": "hello", "label": "跑一下 hello" }]
}
```

这个对象**没有 execution**，必须由 `resolveTask` 补全：

```typescript
resolveTask(task: vscode.Task): vscode.ProviderResult<vscode.Task> {
	const definition = task.definition as DemoTaskDefinition;
	if (!definition?.command) {
		return undefined; // 返回 undefined 表示"我解析不了"
	}
	return new vscode.Task(
		definition,
		task.scope ?? vscode.TaskScope.Workspace,
		task.name,      // 沿用 tasks.json 里的 label / name
		task.source,    // 沿用原来的 source，保证 UI 分组正确
		new vscode.ShellExecution('echo', [`resolved: ${definition.command}`])
	);
}
```

> `resolveTask` 与 `provideTasks` 的区别：前者处理用户写的任务，后者提供内置任务。
> 两条路径都要能返回**同一个 definition**，否则任务匹配不上。

## 生命周期

```typescript
context.subscriptions.push(
	vscode.tasks.onDidStartTask((event) => console.log('开始', event.execution.task.name)),
	vscode.tasks.onDidEndTaskProcess((event) => console.log('结束', event.exitCode)),
	vscode.tasks.onDidEndTask(() => console.log('全部结束'))
);
```

| 事件                    | 触发时机                       |
| ----------------------- | ------------------------------ |
| `onDidStartTask`        | 任务开始执行                   |
| `onDidEndTaskProcess`   | 底层进程结束（能拿到 exitCode）|
| `onDidEndTask`          | 任务完全结束（含依赖清理）     |
| `onDidStartTaskProcess` | 进程真正起来                   |

## 效果验证

1. 用 VS Code 打开 `code/task-provider-demo`，按 `F5` 启动扩展开发宿主；
2. 命令面板执行 `Terminal: Run Task` → 选择 `demo15` → 看到 4 个任务
   （`hello` / `node-version` / `custom-terminal` / `failing`）；
3. 运行 `custom-terminal` → 终端输出由扩展直接生成；
4. 运行 `failing` → 调试控制台/终端显示退出码 1；
5. 命令面板执行 `Demo15 选择并运行任务` → QuickPick 列表与 `fetchTasks` 结果一致。

> 📷 待补充截图：`docs/images/task-provider-demo/run-task.png`

## 常见坑

- **任务列表里没有我的任务**：`registerTaskProvider` 的 type 与 `taskDefinitions.type` 不一致；
- **选中任务报 "The task 'xxx' has no execution"**：`resolveTask` 没实现，或返回了原样的 task；
- **终端里换行乱掉**：`Pseudoterminal` 输出用了 `\n`，必须是 `\r\n`；
- **`provideTasks` 里的任务无法保存到 tasks.json**：`TaskDefinition` 缺字段，或没有 `label`；
- **重复注册**：`activate` 每次热重载都会跑一遍，务必把返回的 `Disposable` 注册进 `context.subscriptions`。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/task-provider-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/task-provider
https://code.visualstudio.com/api/references/vscode-api#tasks
https://code.visualstudio.com/api/references/activation-events#onTaskType
https://github.com/microsoft/vscode-extension-samples/tree/main/task-provider-sample
```
