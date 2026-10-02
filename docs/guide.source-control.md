# 源代码管理 Source Control

> 扩展可以往 VS Code 的源代码管理面板里注册**自己的版本控制提供者**（Git、SVN、Mercurial……
> 以及任何"文件有历史版本"的场景）。相关 API 在 `vscode.scm` 命名空间下。
> 官方指南：https://code.visualstudio.com/api/extension-guides/scm-provider

## 能力清单

| 能力                 | API                                              | 效果                             |
| -------------------- | ------------------------------------------------ | -------------------------------- |
| 创建提供者           | `scm.createSourceControl(id, label, rootUri)`    | 活动栏出现一个 SCM 条目          |
| 提交输入框           | `sourceControl.inputBox` + `acceptInputCommand`  | 输入信息按回车/Ctrl+Enter 触发提交 |
| 资源分组             | `sourceControl.createResourceGroup(id, label)`   | 面板里的"已暂存/更改"分组        |
| 资源状态             | `resourceStates: SourceControlResourceState[]`   | 文件列表 + 图标 + 徽标数字       |
| 内联 Diff（左侧边栏）| `sourceControl.quickDiffProvider`                | 编辑器里的绿/红/蓝 gutter 标记   |
| 状态栏按钮           | `sourceControl.statusBarCommands`                | 状态栏上的快捷入口               |

## 目录结构

```
scm-demo
├── package.json          命令 + scm/title、scm/resourceState/context 菜单
└── src
    └── extension.ts      SourceControl + QuickDiffProvider
```

## package.json 配置

```json
{
  "contributes": {
    "commands": [
      { "command": "demo16.commit", "title": "Demo16 提交快照", "icon": "$(check)" },
      { "command": "demo16.revert", "title": "Demo16 撤销到上次提交", "icon": "$(discard)" }
    ],
    "menus": {
      "scm/title": [
        { "command": "demo16.commit", "when": "scmProvider == demo16", "group": "navigation" }
      ],
      "scm/resourceState/context": [
        {
          "command": "demo16.revert",
          "when": "scmProvider == demo16 && scmResourceState == demo16.resource",
          "group": "inline"
        }
      ]
    }
  }
}
```

when 条件要点：

- `scmProvider` 匹配 `createSourceControl` 的**第一个参数 id**；
- `scmResourceState` 匹配 `SourceControlResourceState.contextValue`；
- 分组用 `scmResourceGroup` 匹配 `resourceGroup.id`。

## 创建提供者

```typescript
import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
	const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri;

	const scm = vscode.scm.createSourceControl('demo16', 'Demo16 版本控制', rootUri);
	scm.inputBox.placeholder = '输入提交信息（Ctrl+Enter 提交快照）';
	// 输入框里按 Ctrl+Enter / 点 ✓ 时执行的命令
	scm.acceptInputCommand = { command: 'demo16.commit', title: '提交快照' };

	const changes = scm.createResourceGroup('changes', '已修改');
	// 空分组默认隐藏，避免出现一堆空标题
	changes.hideWhenEmpty = true;

	context.subscriptions.push(scm);
}
```

### 刷新资源列表

```typescript
async function refresh(): Promise<void> {
	const files = await vscode.workspace.findFiles('**/*', '**/{node_modules,.git,out}/**', 200);
	const states: vscode.SourceControlResourceState[] = [];

	for (const uri of files) {
		const current = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
		const original = snapshots.get(uri.path);
		if (original === current) {
			continue;
		}
		states.push({
			resourceUri: uri,
			// 单击资源时执行的命令
			command: { command: 'demo16.open', title: '打开文件', arguments: [uri] },
			// 供 scm/resourceState/context 的 when 使用
			contextValue: 'demo16.resource',
			decorations: {
				iconPath: new vscode.ThemeIcon(original === undefined ? 'add' : 'edit'),
				tooltip: original === undefined ? '未提交的新文件' : '与上次提交不同',
			},
		});
	}

	changes.resourceStates = states;
	// count 决定活动栏徽标里的数字；不设置则只显示一个圆点
	scm.count = states.length;
}
```

> **没有** `onDidChangeResourceStates` 这类事件：`resourceStates` 是个普通可写属性，
> 你什么时候改它就什么时候刷新 UI。

## QuickDiff：编辑器左侧的差异标记

`QuickDiffProvider` 只要返回"原始版本"的 Uri，VS Code 就会自己算 diff：

```typescript
class DemoQuickDiffProvider implements vscode.QuickDiffProvider {
	// 传 getter 而不是 Map 本身，否则提交后替换了快照会拿到旧引用
	constructor(private readonly getSnapshots: () => Map<string, string>) {}

	provideOriginalResource(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.Uri> {
		if (!uri.path || !this.getSnapshots().has(uri.path)) {
			return undefined; // 没有历史版本 → 不显示 gutter 标记
		}
		return vscode.Uri.from({ scheme: ORIGINAL_SCHEME, path: uri.path });
	}
}
```

再把原始内容通过虚拟文档（见 [虚拟文档](./guide.virtual-documents.md)）暴露出来：

```typescript
scm.quickDiffProvider = new DemoQuickDiffProvider(() => snapshots);

context.subscriptions.push(
	vscode.workspace.registerTextDocumentContentProvider(ORIGINAL_SCHEME, {
		provideTextDocumentContent: (uri) => snapshots.get(uri.path) ?? '',
	})
);
```

主动打开完整 Diff：

```typescript
await vscode.commands.executeCommand('vscode.diff', originalUri, currentUri, '上次提交 ↔ 当前');
```

## 效果验证

1. 用 VS Code 打开 `code/scm-demo`，按 `F5` 启动扩展开发宿主；
2. 在扩展宿主中打开任意文件夹；
3. 活动栏出现 `Demo16 版本控制`，列出了"已修改"分组（首次使用即所有文件都是新文件）；
4. 输入提交信息并回车 → 分组清空、通知提示提交了多少文件；
5. 修改任意文件并保存 → 该文件重新出现在列表里，编辑器左侧出现 diff 标记；
6. 右键资源 → `Demo16 撤销到上次提交` / `Demo16 与上次提交对比`。

> 📷 待补充截图：`docs/images/scm-demo/scm-panel.png`

## 常见坑

- **面板里没有我的提供者**：`createSourceControl` 的 id 与菜单里的 `scmProvider` 不一致，
  或 `activate` 里没注册（`scm` 也要 push 进 `context.subscriptions`）；
- **右键菜单不出现**：`contextValue` 没设置，或 when 写成了 `scmResourceState == ...` 之外的形式；
- **点击资源没反应**：`command` 的 `arguments` 传错，通常要传 `resourceUri` 而不是资源对象；
- **Diff 没有基线**：`provideOriginalResource` 返回了 `undefined`，或虚拟文档 provider 没注册；
- **徽标数字不对**：忘了设 `scm.count`；
- **状态不同步**：文件在 VS Code 外部被修改时不会自动刷新，需要自己加 `FileSystemWatcher`。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/scm-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/scm-provider
https://code.visualstudio.com/api/references/vscode-api#scm
https://code.visualstudio.com/api/references/contribution-points#contributes.menus
https://github.com/microsoft/vscode-extension-samples/tree/main/source-control-sample
```
