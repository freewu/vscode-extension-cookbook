import * as vscode from 'vscode';

/** 存放"已提交"的文件内容快照，key 为 Uri.path */
const SNAPSHOT_KEY = 'demo16.snapshots';
/** 用于展示"原始版本"的虚拟文档 scheme（配合 QuickDiff 显示边栏 diff） */
const ORIGINAL_SCHEME = 'demo16-original';
/** 单个文件的最大快照体积，避免把大文件塞进 workspaceState */
const MAX_SNAPSHOT_BYTES = 128 * 1024;

export async function activate(context: vscode.ExtensionContext) {
	const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri;

	// ---------- 1. 创建 Source Control ----------
	const scm = vscode.scm.createSourceControl('demo16', 'Demo16 版本控制', rootUri);
	scm.inputBox.placeholder = '输入提交信息（Ctrl+Enter 提交快照）';
	// 输入框里按下 Ctrl+Enter / 点击 ✓ 时执行的命令
	scm.acceptInputCommand = { command: 'demo16.commit', title: '提交快照' };

	// 资源组：源代码管理面板里的分组，可以建多个（如"已暂存""更改"）
	const changes = scm.createResourceGroup('changes', '已修改');
	changes.hideWhenEmpty = true;

	// ---------- 2. 快照存储 ----------
	let snapshots = new Map<string, string>(
		Object.entries(context.workspaceState.get<Record<string, string>>(SNAPSHOT_KEY, {}))
	);

	// ---------- 3. QuickDiff：让编辑器左侧的 diff 边栏可用 ----------
	scm.quickDiffProvider = new DemoQuickDiffProvider(() => snapshots);

	// 提供"原始版本"的内容（纯内存，不落盘）
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(ORIGINAL_SCHEME, {
			provideTextDocumentContent: (uri) => snapshots.get(uri.path) ?? '',
		})
	);

	// ---------- 4. 计算变更 ----------
	async function refresh(): Promise<void> {
		const files = await vscode.workspace.findFiles('**/*', '**/{node_modules,.git,out,dist}/**', 200);
		const states: vscode.SourceControlResourceState[] = [];

		for (const uri of files) {
			let current: string;
			try {
				const bytes = await vscode.workspace.fs.readFile(uri);
				if (bytes.byteLength > MAX_SNAPSHOT_BYTES) {
					continue;
				}
				current = Buffer.from(bytes).toString('utf8');
			} catch {
				continue;
			}

			const original = snapshots.get(uri.path);
			if (original === current) {
				continue; // 没有变化
			}

			states.push({
				resourceUri: uri,
				// 单击资源时执行的命令
				command: { command: 'demo16.open', title: '打开文件', arguments: [uri] },
				// 供 scm/resourceState/context 菜单的 when 条件使用
				contextValue: 'demo16.resource',
				decorations: {
					// ThemeIcon / Uri 都可以
					iconPath: new vscode.ThemeIcon(original === undefined ? 'add' : 'edit'),
					tooltip: original === undefined ? '未提交的新文件' : '与上次提交不同',
				},
			});
		}

		changes.resourceStates = states;
		// count 决定活动栏徽标上的数字；不设置则只显示点数
		scm.count = states.length;
	}

	// ---------- 5. 命令 ----------
	context.subscriptions.push(
		vscode.commands.registerCommand('demo16.commit', async () => {
			const message = scm.inputBox.value.trim();
			const files = await vscode.workspace.findFiles('**/*', '**/{node_modules,.git,out,dist}/**', 200);
			const next = new Map<string, string>();

			for (const uri of files) {
				try {
					const bytes = await vscode.workspace.fs.readFile(uri);
					if (bytes.byteLength > MAX_SNAPSHOT_BYTES) {
						continue;
					}
					next.set(uri.path, Buffer.from(bytes).toString('utf8'));
				} catch {
					// 忽略无法读取的文件
				}
			}

			snapshots = next;
			await context.workspaceState.update(SNAPSHOT_KEY, Object.fromEntries(snapshots));
			scm.inputBox.value = '';
			await refresh();
			void vscode.window.showInformationMessage(
				`已提交快照：${message || '(无提交信息)'}，共 ${snapshots.size} 个文件`
			);
		}),

		vscode.commands.registerCommand('demo16.open', async (uri?: vscode.Uri) => {
			if (!uri) {
				return;
			}
			await vscode.window.showTextDocument(uri, { preview: true });
		}),

		vscode.commands.registerCommand('demo16.revert', async (state?: vscode.SourceControlResourceState) => {
			const uri = state?.resourceUri;
			if (!uri) {
				return;
			}
			const original = snapshots.get(uri.path);
			if (original === undefined) {
				void vscode.window.showWarningMessage('该文件没有快照（上次提交时还不存在），无法撤销');
				return;
			}
			await vscode.workspace.fs.writeFile(uri, Buffer.from(original, 'utf8'));
			await refresh();
		}),

		vscode.commands.registerCommand('demo16.showDiff', async (state?: vscode.SourceControlResourceState) => {
			const uri = state?.resourceUri;
			if (uri) {
				await vscode.commands.executeCommand('vscode.diff', uri.with({ scheme: ORIGINAL_SCHEME }), uri, '上次提交 ↔ 当前');
			}
		})
	);

	// ---------- 6. 变化时刷新 ----------
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(() => void refresh()),
		vscode.workspace.onDidCreateFiles(() => void refresh()),
		vscode.workspace.onDidDeleteFiles(() => void refresh()),
		scm
	);

	await refresh();
}

class DemoQuickDiffProvider implements vscode.QuickDiffProvider {
	// 传入 getter 而不是 Map 本身，否则提交时替换了 snapshots 会拿到旧引用
	constructor(private readonly getSnapshots: () => Map<string, string>) {}

	/** 返回"原始版本"的 Uri，VS Code 会拿它和当前文档做 diff 并渲染到左侧边栏 */
	provideOriginalResource(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.Uri> {
		if (!uri.path || !this.getSnapshots().has(uri.path)) {
			return undefined;
		}
		return vscode.Uri.from({ scheme: ORIGINAL_SCHEME, path: uri.path });
	}
}

export function deactivate() {}
