import * as vscode from 'vscode';

/** 与 contributes.taskDefinitions 中声明的属性一一对应 */
interface DemoTaskDefinition extends vscode.TaskDefinition {
	command: string;
	args?: string[];
	fail?: boolean;
}

export function activate(context: vscode.ExtensionContext) {
	// 注册任务提供者：之后"终端 → 运行任务"里就会出现 demo15 的任务
	context.subscriptions.push(vscode.tasks.registerTaskProvider('demo15', new DemoTaskProvider()));

	// 从"已注册的任务"里挑一个来运行
	context.subscriptions.push(
		vscode.commands.registerCommand('demo15.pickTask', async () => {
			const tasks = await vscode.tasks.fetchTasks({ type: 'demo15' });
			if (tasks.length === 0) {
				void vscode.window.showWarningMessage('没有找到 demo15 任务');
				return;
			}
			const picked = await vscode.window.showQuickPick(
				tasks.map((task) => ({ label: task.name, description: task.source, task })),
				{ placeHolder: '选择要运行的任务' }
			);
			if (picked) {
				await vscode.tasks.executeTask(picked.task);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('demo15.showTasks', async () => {
			const tasks = await vscode.tasks.fetchTasks({ type: 'demo15' });
			void vscode.window.showInformationMessage(
				`共 ${tasks.length} 个任务：${tasks.map((task) => task.name).join('、')}`
			);
		})
	);

	// 监听任务生命周期
	context.subscriptions.push(
		vscode.tasks.onDidStartTask((event) => {
			console.log('[demo15] 任务开始：', event.execution.task.name);
		}),
		vscode.tasks.onDidEndTaskProcess((event) => {
			console.log('[demo15] 任务结束：', event.execution.task.name, '退出码 =', event.exitCode);
		})
	);
}

class DemoTaskProvider implements vscode.TaskProvider {
	/**
	 * 提供"代码式"任务：不需要用户写 tasks.json。
	 * 只有这里返回的任务才会被 fetchTasks 查到。
	 */
	provideTasks(): vscode.ProviderResult<vscode.Task[]> {
		return [
			this.createShellTask('hello'),
			this.createProcessTask('node-version'),
			this.createCustomTask('custom-terminal'),
			this.createFailingTask('failing'),
		];
	}

	/**
	 * 解析来自 tasks.json 的任务。
	 *
	 * tasks.json 里用户只写了 `{ "type": "demo15", "command": "hello" }`，
	 * 没有 execution / name 等信息，必须在这里补全。返回 undefined 表示无法解析。
	 */
	resolveTask(task: vscode.Task): vscode.ProviderResult<vscode.Task> {
		const definition = task.definition as DemoTaskDefinition;
		if (!definition?.command) {
			return undefined;
		}

		const resolved = new vscode.Task(
			definition,
			task.scope ?? vscode.TaskScope.Workspace,
			task.name,
			task.source,
			// 来自 tasks.json 的任务可以覆盖 fail 字段
			definition.fail
				? new vscode.ShellExecution('node', ['-e', 'process.exit(1)'])
				: new vscode.ShellExecution('echo', [`resolved: ${definition.command} ${(definition.args ?? []).join(' ')}`])
		);
		return resolved;
	}

	/** 1. ShellExecution：在集成终端里执行命令行 */
	private createShellTask(name: string): vscode.Task {
		const definition: DemoTaskDefinition = { type: 'demo15', command: name };
		const task = new vscode.Task(
			definition,
			vscode.TaskScope.Workspace,
			name,
			'demo15',
			// 用 (命令, 参数数组) 的形式，参数会自动做转义
			new vscode.ShellExecution('echo', ['hello from demo15'])
		);
		task.group = vscode.TaskGroup.Build;
		task.presentationOptions = {
			reveal: vscode.TaskRevealKind.Always,
			panel: vscode.TaskPanelKind.Shared,
			clear: true,
		};
		return task;
	}

	/** 2. ProcessExecution：不经过 shell，直接启动进程 */
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

	/**
	 * 3. CustomExecution：完全由扩展驱动输出（不做真实 IO），
	 *    回调返回一个 Pseudoterminal，用于往终端里写内容。
	 */
	private createCustomTask(name: string): vscode.Task {
		const definition: DemoTaskDefinition = { type: 'demo15', command: name };
		const execution = new vscode.CustomExecution(
			async (): Promise<vscode.Pseudoterminal> => new DemoPseudoterminal()
		);
		return new vscode.Task(definition, vscode.TaskScope.Workspace, name, 'demo15', execution);
	}

	/** 4. 故意失败的任务，用来观察 onDidEndTaskProcess 的 exitCode */
	private createFailingTask(name: string): vscode.Task {
		const definition: DemoTaskDefinition = { type: 'demo15', command: name, fail: true };
		const task = new vscode.Task(
			definition,
			vscode.TaskScope.Workspace,
			name,
			'demo15',
			new vscode.ShellExecution('node', ['-e', 'process.exit(1)'])
		);
		// 告诉 VS Code 这个任务失败不是扩展的锅，避免弹"任务失败"的干扰提示
		task.problemMatchers = [];
		return task;
	}
}

class DemoPseudoterminal implements vscode.Pseudoterminal {
	private readonly writeEmitter = new vscode.EventEmitter<string>();
	private readonly closeEmitter = new vscode.EventEmitter<number>();

	readonly onDidWrite: vscode.Event<string> = this.writeEmitter.event;
	readonly onDidClose: vscode.Event<number> = this.closeEmitter.event;

	open(): void {
		// 注意：终端里的换行必须是 \r\n
		this.writeEmitter.fire('CustomExecution 正在运行……\r\n');
		this.writeEmitter.fire('这行输出完全由扩展生成，没有启动任何进程。\r\n');
		this.closeEmitter.fire(0);
	}

	close(): void {
		// 终端被用户关闭时清理资源
	}
}

export function deactivate() {}
