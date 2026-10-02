import * as vscode from 'vscode';
import { ResultPanel } from './resultPanel';
import { ToolTreeProvider } from './toolTreeProvider';
import { KIND_LABELS, ToolContext, ToolDefinition, ToolResult, enabledTools, findTool } from './tools';

let output: vscode.LogOutputChannel;
/** `context.extensionUri` 的缓存：结果面板要用它把 media/ 解析成 webview 可访问的 URI */
let extensionUri: vscode.Uri;

/** 上一次运行现场：`重新运行` 按钮要靠它复现同样的输入与模式 */
let lastRun: { tool: ToolDefinition; input: string; option: string | undefined } | undefined;
/** 上一次结果：供 `magicTools.copyResult` 命令使用 */
let lastResult: { tool: ToolDefinition; result: ToolResult } | undefined;

export function activate(context: vscode.ExtensionContext): void {
	extensionUri = context.extensionUri;
	output = vscode.window.createOutputChannel('Magic Tools', { log: true });
	output.info(`Magic Tools 已激活，共注册 ${enabledTools().length} 个工具`);

	// 1) 树视图：id 必须与 package.json 的 views 贡献点一致
	const treeProvider = new ToolTreeProvider();
	context.subscriptions.push(
		output,
		treeProvider,
		vscode.window.registerTreeDataProvider('magicTools.tools', treeProvider)
	);

	// 2) 状态栏入口：单击 = 命令面板选工具
	const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusItem.text = '$(beaker) Magic Tools';
	statusItem.tooltip = new vscode.MarkdownString('单击选择工具\n\n快捷键 `Ctrl+Alt+M`');
	statusItem.command = 'magicTools.pickTool';
	statusItem.show();
	context.subscriptions.push(statusItem);

	// 3) 命令
	context.subscriptions.push(
		vscode.commands.registerCommand('magicTools.pickTool', async () => {
			const picked = await pickTool();
			if (picked) {
				await runTool(picked.id);
			}
		}),
		// Tree Item 的 command.arguments 会作为第一个参数传进来
		vscode.commands.registerCommand('magicTools.runTool', (toolId?: string) => runTool(toolId)),
		vscode.commands.registerCommand('magicTools.refresh', () => {
			treeProvider.refresh();
			output.info(`工具列表已刷新（当前启用 ${enabledTools().length} 个）`);
		}),
		vscode.commands.registerCommand('magicTools.copyResult', async () => {
			if (!lastResult) {
				void vscode.window.showInformationMessage('还没有运行过任何工具');
				return;
			}
			await vscode.env.clipboard.writeText(lastResult.result.text);
			void vscode.window.showInformationMessage(`已复制「${lastResult.tool.label}」的结果`);
		})
	);

	// 4) 配置变化：直接重建整棵树，省掉手动 diff
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('magicTools')) {
				treeProvider.refresh();
				output.info('配置变化，工具列表已刷新');
			}
		})
	);

	// 5) 与任务系统联动：任务跑完时记一笔（proj.scripts 会用到）
	context.subscriptions.push(
		vscode.tasks.onDidEndTaskProcess((event) => {
			output.info(
				`任务结束：${event.execution.task.name}（exit=${event.exitCode ?? 'unknown'}）`
			);
		})
	);
}

export function deactivate(): void {
	// 全部资源都在 context.subscriptions 里，无需手动清理
}

/** 用 QuickPick 选工具；按分类显示，方便在几十个工具里定位 */
async function pickTool(): Promise<ToolDefinition | undefined> {
	const tools = enabledTools();
	const items: Array<vscode.QuickPickItem & { tool?: ToolDefinition }> = [];
	let currentKind = '';
	for (const tool of tools) {
		if (tool.kind !== currentKind) {
			currentKind = tool.kind;
			items.push({ label: KIND_LABELS[tool.kind], kind: vscode.QuickPickItemKind.Separator });
		}
		items.push({
			label: `$(beaker) ${tool.label}`,
			description: tool.id,
			detail: tool.description,
			tool,
		});
	}
	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: '选择要运行的工具',
		matchOnDescription: true,
		matchOnDetail: true,
	});
	return picked?.tool;
}

async function runTool(toolId?: string): Promise<void> {
	const tool = toolId ? findTool(toolId) : undefined;
	if (!tool) {
		void vscode.window.showWarningMessage(`找不到工具：${toolId ?? '(未指定)'}`);
		return;
	}

	// 需要模式的工具先问模式
	let option: string | undefined;
	if (tool.options?.length) {
		const picked = await vscode.window.showQuickPick([...tool.options], {
			placeHolder: `${tool.label}：选择模式`,
			ignoreFocusOut: true,
		});
		if (!picked) {
			return;
		}
		option = picked.value;
	}

	// 需要输入的工具：优先用编辑器选中文本，没有就弹输入框
	const input = await resolveInput(tool);
	if (input === undefined) {
		return;
	}

	await execute(tool, input, option);
}

async function resolveInput(tool: ToolDefinition): Promise<string | undefined> {
	if (!tool.needsInput) {
		return '';
	}
	const editor = vscode.window.activeTextEditor;
	const selected = editor ? editor.document.getText(editor.selection) : '';
	if (selected.trim() !== '') {
		output.info(`使用编辑器选中文本（${selected.length} 字符）作为输入`);
		return selected;
	}
	const text = await vscode.window.showInputBox({
		prompt: `${tool.label}：请输入要处理的内容`,
		placeHolder: tool.inputPlaceholder ?? '也可以先在编辑器里选中文本，再运行工具',
		ignoreFocusOut: true,
	});
	return text; // undefined 表示用户取消
}

async function execute(tool: ToolDefinition, input: string, option: string | undefined): Promise<void> {
	lastRun = { tool, input, option };
	const controller = new AbortController();
	const context: ToolContext = {
		input,
		option,
		workspaceFolder: vscode.workspace.workspaceFolders?.[0],
		signal: controller.signal,
		pick: async (items, placeHolder) => {
			const picked = await vscode.window.showQuickPick([...items], { placeHolder, ignoreFocusOut: true });
			return picked?.value;
		},
		log: (message) => output.info(message),
	};

	const panel = ResultPanel.show(
		// 用 extensionUri 解析 media/ 目录，保证打包后路径依然正确
		extensionUri,
		async (rerunTool) => {
			const saved = lastRun;
			if (saved) {
				await execute(rerunTool, saved.input, saved.option);
			}
		}
	);

	try {
		const started = Date.now();
		// 项目级工具可能读很多文件，给个进度提示
		const result =
			tool.kind === 'project'
				? await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: `Magic Tools：正在运行 ${tool.label}`,
							cancellable: true,
						},
						(_progress, token) => {
							token.onCancellationRequested(() => controller.abort());
							return Promise.resolve(tool.run(context));
						}
					)
				: await tool.run(context);

		lastResult = { tool, result };
		panel.update(tool, result);
		output.info(`工具 ${tool.id} 完成，用时 ${Date.now() - started} ms，输出 ${result.text.length} 字符`);

		if (vscode.workspace.getConfiguration('magicTools').get<boolean>('autoCopyResult', false)) {
			await vscode.env.clipboard.writeText(result.text);
			output.info('autoCopyResult = true，结果已写入剪贴板');
		}
	} catch (error) {
		panel.updateError(tool, error);
		output.error(`工具 ${tool.id} 失败：${error instanceof Error ? error.message : String(error)}`);
	}
}

