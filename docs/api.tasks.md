# tasks 相关 API

> `vscode.tasks` 让扩展**向 VS Code 贡献任务**（`Tasks: Run Task` 里出现的项目，
> 可以绑定快捷键、被 `dependsOn` 串联、出现在 `preLaunchTask` 里）。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#tasks
> 配套指南：[任务提供者 Task Provider](./guide.task-provider.md)

## 全局变量 Variables

| 成员                  | 类型                              | 说明                             |
| --------------------- | --------------------------------- | -------------------------------- |
| `taskExecutions`      | `readonly TaskExecution[]`        | 当前正在运行的任务               |

## 事件 Events

| 成员                    | 回调参数                          | 说明                       |
| ----------------------- | --------------------------------- | -------------------------- |
| `onDidStartTask`        | `TaskStartEvent`                  | 任务开始（含 `TaskExecution`） |
| `onDidEndTask`          | `TaskEndEvent`                    | 任务结束                   |
| `onDidStartTaskProcess` | `TaskProcessStartEvent`           | 底层进程启动（能拿到 `processId`） |
| `onDidEndTaskProcess`   | `TaskProcessEndEvent`             | 底层进程退出（能拿到 `exitCode`） |

> 「任务开始」不等于「进程已启动」：Shell/Process 任务才会有 `*TaskProcess*` 事件，
> `CustomExecution` 任务没有真实进程。

## 方法 Functions

| 成员                   | 签名                                                             | 说明                                    |
| ---------------------- | ---------------------------------------------------------------- | --------------------------------------- |
| `registerTaskProvider` | `(type: string, provider: TaskProvider) => Disposable`            | 注册任务提供者（`type` 要和 `taskDefinitions` 一致） |
| `fetchTasks`           | `(filter?: TaskFilter) => Thenable<Task[]>`                       | 主动查询任务（不传 filter 会**要求用户选择**类型） |
| `executeTask`          | `(task: Task) => Thenable<TaskExecution>`                         | 立即执行一个任务                        |

## 任务的构成

```typescript
// 1) 任务定义（package.json）
// "taskDefinitions": [{ "type": "demo15", "required": ["kind"] }]

// 2) Task + Execution
const task = new vscode.Task(
	{ type: 'demo15', kind: 'shell' },            // definition：任务身份
	vscode.TaskScope.Workspace,                    // scope：Workspace / Global / 具体文件夹
	'构建',                                        // name
	'demo15',                                      // source
	new vscode.ShellExecution('echo 你好')         // execution
);
task.group = vscode.TaskGroup.Build;              // Build / Test / Clean（决定默认快捷键）
task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, panel: vscode.TaskPanelKind.Dedicated };
task.problemMatchers = ['$tsc'];                  // 复用内置问题匹配器，把输出里的错误变成诊断
```

三种 `TaskExecution`：

| 类型                | 用途                                                     |
| ------------------- | -------------------------------------------------------- |
| `ShellExecution`    | 交给系统 shell 执行（支持 `ShellQuotedString` 转义）      |
| `ProcessExecution`  | 直接 `spawn` 进程，不经过 shell（参数不需要转义）          |
| `CustomExecution`   | 交给你自己的 `Pseudoterminal`，可以在"任务面板"里跑任意逻辑 |

## 示例：提供并执行任务

```typescript
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.tasks.registerTaskProvider('demo15', {
			// 首次发现：返回该类型的全部任务
			provideTasks: () => [createEchoTask(), createScriptTask()],
			// 从 tasks.json 里读到的任务：补全缺失字段（如 execution）
			resolveTask: (task) => {
				if (!task.execution) {
					task.execution = new vscode.ShellExecution('echo resolved');
				}
				return task;
			},
		}),

		vscode.tasks.onDidStartTask((e) => console.log('开始：', e.execution.task.name)),
		vscode.tasks.onDidEndTaskProcess((e) => console.log('进程退出码：', e.exitCode))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('demo15.run', async () => {
			// 不传 filter：弹出"选择任务类型"；传 filter 直接查该类型
			const tasks = await vscode.tasks.fetchTasks({ type: 'demo15' });
			if (tasks.length > 0) {
				await vscode.tasks.executeTask(tasks[0]);
			}
		})
	);
}
```

## 激活时机

自 VS Code 1.76 起，**贡献了 `taskDefinitions` 的扩展会在用户请求其任务类型时自动激活**，
不再需要 `onTaskType:<type>`。只有需要更早介入时才手写激活事件。

## 效果验证

1. `F5` 启动扩展开发宿主；
2. 菜单「终端 → 运行任务」→ 选择 `demo15` → 观察任务面板输出；
3. 执行命令让任务失败（demo 里的 `fail` 任务），观察 `onDidEndTaskProcess` 的 `exitCode`；
4. 在 `tasks.json` 里手写一个 `type: demo15` 的任务，验证 `resolveTask` 被调用。

> 📷 待补充截图：`docs/images/task-provider-demo/run-task.png`

## 常见坑

- **任务列表里没有自己的任务**：`package.json` 的 `taskDefinitions` 与
  `registerTaskProvider(type, ...)` 的 `type` 不一致，或 `provideTasks` 返回空数组；
- **`fetchTasks()` 不带 filter 会弹选择框**：脚本化场景一定要传 `{ type: 'xxx' }`；
- **`executeTask` 会等任务结束**：长时间任务会一直挂起 `await`，
  想"后台跑"就别 `await`，改用 `onDidEndTask` 处理结果；
- **`Task.scope` 写错导致"找不到任务"**：多根工作区下要明确 `WorkspaceFolder`；
- **`ShellExecution` 的引号问题**：跨平台命令要用 `ShellQuotedString` 或改用 `ProcessExecution`；
- **`CustomExecution` 必须 resolve 一个 `Pseudoterminal`**：`close()` 时要 fire `onDidClose`，
  否则任务永远显示"运行中"；
- **`problemMatchers` 拼错不报错**：输出不会被解析成诊断，只能靠肉眼排查。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/task-provider-demo

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#tasks
https://code.visualstudio.com/api/extension-guides/task-provider
https://code.visualstudio.com/docs/editor/tasks
https://code.visualstudio.com/docs/editor/tasks-appendix
```
