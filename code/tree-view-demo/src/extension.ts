import * as vscode from 'vscode';

/** 树节点数据模型：只要能被 getTreeItem / getChildren 消费即可，结构完全自定义 */
interface FileNode {
	uri: vscode.Uri;
	type: vscode.FileType;
}

export function activate(context: vscode.ExtensionContext) {
	const provider = new FileTreeProvider();

	// createTreeView 比 registerTreeDataProvider 多出 reveal()、title actions、可见性等能力
	const treeView = vscode.window.createTreeView('demo9.fileExplorer', {
		treeDataProvider: provider,
		// 右上角显示"折叠全部"按钮
		showCollapseAll: true,
		// 允许按住 Ctrl 多选
		canSelectMany: true,
	});
	context.subscriptions.push(treeView);

	// 标题栏的刷新按钮
	context.subscriptions.push(vscode.commands.registerCommand('demo9.refresh', () => provider.refresh()));

	// 点击文件时打开（TreeItem.command 与 view/item/context 菜单都会用到）
	context.subscriptions.push(
		vscode.commands.registerCommand('demo9.openFile', async (node?: FileNode) => {
			if (!node) {
				return;
			}
			const document = await vscode.workspace.openTextDocument(node.uri);
			await vscode.window.showTextDocument(document, { preview: true });
		})
	);

	// 选中项变化时同步到状态栏，演示 treeView.selection
	context.subscriptions.push(
		treeView.onDidChangeSelection((event) => {
			const first = event.selection[0];
			if (first) {
				console.log('[demo9] 选中：', first.uri.toString());
			}
		})
	);

	// 文件系统变化时自动刷新
	const watcher = vscode.workspace.createFileSystemWatcher('**/*');
	context.subscriptions.push(
		watcher,
		watcher.onDidCreate(() => provider.refresh()),
		watcher.onDidDelete(() => provider.refresh())
	);
}

class FileTreeProvider implements vscode.TreeDataProvider<FileNode> {
	// 数据变化时通过 EventEmitter 通知 VS Code 重新拉取，是刷新树视图的唯一正确方式
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<FileNode | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<FileNode | undefined | void> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: FileNode): vscode.TreeItem {
		const isDirectory = element.type === vscode.FileType.Directory;
		const label = element.uri.path.split('/').pop() ?? element.uri.path;

		const item = new vscode.TreeItem(
			label,
			isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
		);

		// 指定 resourceUri 后，VS Code 会自动套用文件图标主题与 Git 装饰
		item.resourceUri = element.uri;
		// contextValue 决定 view/item/context 菜单的 when 条件（viewItem == file）
		item.contextValue = isDirectory ? 'folder' : 'file';
		item.tooltip = element.uri.fsPath;
		item.id = element.uri.toString();

		if (!isDirectory) {
			// 点击节点时执行命令
			item.command = {
				command: 'demo9.openFile',
				title: '打开文件',
				arguments: [element],
			};
			// 用 ThemeIcon 演示图标（folder 用 VS Code 内置图标）
			item.iconPath = vscode.ThemeIcon.File;
		} else {
			item.iconPath = vscode.ThemeIcon.Folder;
			item.description = vscode.workspace.asRelativePath(element.uri, false);
		}

		return item;
	}

	async getChildren(element?: FileNode): Promise<FileNode[]> {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders || folders.length === 0) {
			return [];
		}

		// 根节点：工作区文件夹
		if (!element) {
			return folders.map((folder) => ({ uri: folder.uri, type: vscode.FileType.Directory }));
		}

		if (element.type !== vscode.FileType.Directory) {
			return [];
		}

		try {
			// 用 workspace.fs 而不是 node 的 fs，虚拟工作区下同样可用
			const entries = await vscode.workspace.fs.readDirectory(element.uri);
			return entries
				.map(([name, type]) => ({ uri: vscode.Uri.joinPath(element.uri, name), type }))
				.sort((a, b) => {
					const aDirectory = a.type === vscode.FileType.Directory ? 0 : 1;
					const bDirectory = b.type === vscode.FileType.Directory ? 0 : 1;
					return aDirectory - bDirectory || a.uri.path.localeCompare(b.uri.path);
				});
		} catch {
			// 无权限 / 虚拟文件系统不支持时静默返回空
			return [];
		}
	}
}

export function deactivate() {}
