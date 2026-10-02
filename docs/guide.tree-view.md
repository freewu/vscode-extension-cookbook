# 树视图 Tree View

> 树视图（Tree View）是侧边栏/面板里以层级结构展示数据的能力，例如资源管理器、大纲、断点列表都是树视图。
> 官方指南：https://code.visualstudio.com/api/extension-guides/tree-view

## 两个概念别混淆

| 概念                     | 位置                            | 作用                                   |
| ------------------------ | ------------------------------- | -------------------------------------- |
| 视图容器 View Container  | `contributes.viewsContainers`   | 活动栏/面板上的一个**图标入口**        |
| 视图 View                | `contributes.views`             | 容器里的一个**可折叠面板**             |
| 数据源 TreeDataProvider  | `extension.ts` → `createTreeView` | 提供树的节点数据                       |

> 一个容器可以放多个视图；同一个容器也能被多个扩展共享（不推荐）。
> 容器相关细节见 [用户体验指南](./demo.ui-guidelines.md)。

## 目录结构

```
tree-view-demo
├── package.json            声明 viewsContainers / views / menus / commands
├── resources
│   └── icon.svg            容器图标（24x24 单色 SVG）
└── src
    └── extension.ts        TreeDataProvider 实现
```

## package.json 配置

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "demo9",
          "title": "Demo9 Tree View",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "demo9": [
        {
          "id": "demo9.fileExplorer",
          "name": "文件树",
          "icon": "resources/icon.svg",
          // 可选：when 控制整个视图是否显示
          "contextualTitle": "Demo9 文件树"
        }
      ]
    },
    "commands": [
      { "command": "demo9.refresh", "title": "Demo9 刷新文件树", "icon": "$(refresh)" },
      { "command": "demo9.openFile", "title": "Demo9 打开文件" }
    ],
    "menus": {
      // 视图标题栏按钮：when 用 view == <视图 id>
      "view/title": [
        {
          "command": "demo9.refresh",
          "when": "view == demo9.fileExplorer",
          "group": "navigation"
        }
      ],
      // 节点右键菜单：when 用 viewItem == <contextValue>
      "view/item/context": [
        {
          "command": "demo9.openFile",
          "when": "view == demo9.fileExplorer && viewItem == file",
          "group": "inline"
        }
      ]
    }
  }
}
```

> `icon` 支持 codicon 语法：`"$(refresh)"`、`"$(open-preview)"` 等，查看 https://code.visualstudio.com/api/references/icons-in-labels

## extension.ts 实现

### 1. 注册视图

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const provider = new FileTreeProvider();

	// createTreeView 比 registerTreeDataProvider 多出 reveal()/title actions 等能力
	const treeView = vscode.window.createTreeView('demo9.fileExplorer', {
		treeDataProvider: provider,
		showCollapseAll: true, // 右上角"折叠全部"
		canSelectMany: true,   // Ctrl 多选
	});
	context.subscriptions.push(treeView);
}
```

等价的简化写法（能力更少）：

```typescript
vscode.window.registerTreeDataProvider('demo9.fileExplorer', provider);
```

### 2. 实现 TreeDataProvider

`TreeDataProvider` 只有两个必须实现的方法，**刷新靠 `onDidChangeTreeData` 事件**，不要手动重建视图。

```typescript
interface FileNode {
	uri: vscode.Uri;
	type: vscode.FileType;
}

class FileTreeProvider implements vscode.TreeDataProvider<FileNode> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<FileNode | undefined | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	/** 触发一次全量刷新 */
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	/** 把数据模型映射成 TreeItem */
	getTreeItem(element: FileNode): vscode.TreeItem {
		const isDirectory = element.type === vscode.FileType.Directory;
		const label = element.uri.path.split('/').pop() ?? element.uri.path;

		const item = new vscode.TreeItem(
			label,
			isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
		);
		// resourceUri：自动套用文件图标主题 + Git 装饰
		item.resourceUri = element.uri;
		// contextValue：决定 view/item/context 菜单的 when 条件
		item.contextValue = isDirectory ? 'folder' : 'file';
		item.iconPath = isDirectory ? vscode.ThemeIcon.Folder : vscode.ThemeIcon.File;
		if (!isDirectory) {
			item.command = { command: 'demo9.openFile', title: '打开文件', arguments: [element] };
		}
		return item;
	}

	/** 懒加载子节点：element 为 undefined 时返回根节点 */
	async getChildren(element?: FileNode): Promise<FileNode[]> {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders?.length) {
			return [];
		}
		if (!element) {
			return folders.map((folder) => ({ uri: folder.uri, type: vscode.FileType.Directory }));
		}
		if (element.type !== vscode.FileType.Directory) {
			return [];
		}
		const entries = await vscode.workspace.fs.readDirectory(element.uri);
		return entries
			.map(([name, type]) => ({ uri: vscode.Uri.joinPath(element.uri, name), type }))
			.sort((a, b) => a.uri.path.localeCompare(b.uri.path));
	}
}
```

### 3. 刷新与交互

```typescript
export function activate(context: vscode.ExtensionContext) {
	const provider = new FileTreeProvider();

	// 标题栏刷新按钮
	context.subscriptions.push(vscode.commands.registerCommand('demo9.refresh', () => provider.refresh()));

	// 点击节点打开文件
	context.subscriptions.push(
		vscode.commands.registerCommand('demo9.openFile', async (node?: FileNode) => {
			if (!node) {
				return;
			}
			const document = await vscode.workspace.openTextDocument(node.uri);
			await vscode.window.showTextDocument(document, { preview: true });
		})
	);

	// 文件变化时自动刷新
	const watcher = vscode.workspace.createFileSystemWatcher('**/*');
	context.subscriptions.push(
		watcher,
		watcher.onDidCreate(() => provider.refresh()),
		watcher.onDidDelete(() => provider.refresh())
	);
}
```

### 定位到某个节点

`createTreeView` 的返回值支持 `reveal()`，可用于「搜索结果 → 定位树节点」：

```typescript
await treeView.reveal(
	{ uri: someUri, type: vscode.FileType.File },
	{ select: true, focus: true, expand: 2 }
);
```

> 需要在 `package.json` 中为视图设置固定的 `id`，节点需要能被 `getParent()` 还原路径，
> 否则 `reveal()` 无法展开父级。

## 效果验证

1. 用 VS Code 打开 `code/tree-view-demo`，按 `F5` 启动扩展开发宿主；
2. 在扩展开发宿主中打开任意文件夹；
3. 活动栏点击 `Demo9 Tree View` → 看到工作区文件树；
4. 点击标题栏刷新按钮 → 树重新加载；
5. 悬停文件节点 → 出现行内「打开文件」按钮，点击后打开对应文件。

> 📷 待补充截图：`docs/images/tree-view-demo/tree-view.png`

## 常见坑

- **刷新不生效**：忘了 `fire()`，或直接改了数组却以为会自动更新（VS Code 不会监听你的数据模型）；
- **节点无法展开**：`TreeItemCollapsibleState.None` 却期望有子节点；
- **右键菜单不出现**：`contextValue` 没设置，或 `when` 里 `viewItem` 值写错；
- **图标不显示**：容器图标必须是**单色 SVG**（24×24），彩色图标会被渲染成黑色；
- **性能**：`getChildren` 一定要懒加载，不要在根节点一次性构建整棵树；
  节点数量大时给 `TreeItem.id` 赋值可减少不必要的重绘。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/tree-view-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/tree-view
https://code.visualstudio.com/api/references/vscode-api#TreeDataProvider
https://code.visualstudio.com/api/references/vscode-api#TreeItem
https://github.com/microsoft/vscode-extension-samples/tree/main/tree-view-sample
```
