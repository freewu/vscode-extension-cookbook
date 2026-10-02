# scm 相关 API

> `vscode.scm` 让扩展在**源代码管理（Source Control）视图**里注册自己的提供者，
> 得到变更列表、输入框、行内 gutter 差异、以及 `scm/*` 菜单的接入能力。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#scm
> 配套指南：[源代码管理 Source Control](./guide.source-control.md)

## 全局变量 Variables

| 成员       | 类型                     | 说明                                                                 |
| ---------- | ------------------------ | -------------------------------------------------------------------- |
| `inputBox` | `SourceControlInputBox`  | 「源代码管理」视图标题区的全局输入框（不绑定任何提供者时可单独使用） |

## 方法 Functions

| 成员                   | 签名                                                      | 说明                                     |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------- |
| `createSourceControl`  | `(id: string, label: string, rootUri?: Uri) => SourceControl` | 注册一个 SCM 提供者，返回 `SourceControl` |

## SourceControl 对象

| 成员                        | 类型 / 签名                                     | 说明                                                         |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| `id` / `label` / `rootUri`  |                                                 | 标识信息；`id` 对应 when 子句 `scmProvider`                   |
| `inputBox`                  | `SourceControlInputBox`                         | 该提供者的提交信息输入框（`value` / `placeholder` / `visible`） |
| `acceptInputCommand`        | `Command`                                       | 用户按 `Ctrl+Enter` 或点「提交」时执行的命令                  |
| `statusBarCommands`         | `Command[]`                                     | 显示在 SCM 视图标题的按钮                                     |
| `createResourceGroup(id, label)` | `=> SourceControlResourceGroup`            | 创建一组资源（如「更改」「暂存」）                           |
| `quickDiffProvider`         | `QuickDiffProvider`                             | 提供原始内容，编辑器 gutter 才会显示差异                      |
| `commitTemplate`            | `string`                                        | 输入框里的提交模板                                           |
| `count`                     | `number \| undefined`                           | 显示在活动栏图标上的角标                                     |
| `dispose()`                 |                                                 | 注销该提供者                                                 |

## SourceControlResourceGroup / ResourceState

```typescript
const group = scm.createResourceGroup('changes', '更改');
group.hideWhenEmpty = true;             // 空组不显示
group.resourceStates = [
	{
		resourceUri: vscode.Uri.file('/tmp/a.txt'),
		contextValue: 'modified',           // 对应 when 子句 scmResourceState
		command: { command: 'demo16.open', title: '打开', arguments: [uri] },
		decorations: {
			strikeThrough: false,
			faded: false,
			tooltip: '已修改',
			iconPath: new vscode.ThemeIcon('edit'),
		},
		// 可选：多资源操作（如"重命名 + 删除"打包成一次变更）
		multiFileEdits: [],
	},
];
```

| `SourceControlResourceDecorations` 字段 | 说明                                   |
| --------------------------------------- | -------------------------------------- |
| `strikeThrough` / `faded`               | 删除标志 / 淡化显示                    |
| `tooltip`                               | 悬停文本                               |
| `iconPath`                              | `string \| Uri \| ThemeIcon`           |
| `light` / `dark`                        | 分别针对浅色/深色主题的图标            |

## QuickDiffProvider

```typescript
{
	provideOriginalResource(uri: vscode.Uri): vscode.ProviderResult<vscode.Uri> {
		// 返回"原始版本"的 Uri：scheme 是自己注册的虚拟文档，
		// VS Code 会把当前文件与它比较，gutter 就出现了差异色块。
		return vscode.Uri.parse(`demo16-original:${uri.path}`);
	},
}
```

配套需要 `workspace.registerTextDocumentContentProvider('demo16-original', provider)`。

## 贡献点

```jsonc
{
  "contributes": {
    "commands": [
      { "command": "demo16.commit", "title": "Demo16 提交" }
    ],
    "menus": {
      // SCM 视图标题
      "scm/title": [{ "command": "demo16.commit", "group": "navigation" }],
      // 变更条目的右键菜单
      "scm/resourceState/context": [
        { "command": "demo16.revert", "when": "scmResourceState == 'modified'", "group": "inline" }
      ]
    }
  }
}
```

| 菜单 id                    | 出现位置                     |
| -------------------------- | ---------------------------- |
| `scm/title`                | SCM 视图标题                 |
| `scm/sourceControl`        | 某个提供者的标题区（角标）   |
| `scm/resourceGroup/context`| 资源组的右键菜单             |
| `scm/resourceState/context`| 单个变更条目的右键菜单       |
| `scm/resourceFolder/context` | 变更里的文件夹（树形展开时）|

可用 when 键：`scmProvider`（= `createSourceControl` 的 id）、`scmResourceGroup`（组 id）、
`scmResourceState`（`contextValue`）。

> 注意：`scmResourceState` 在官方的 when-clause 参考页上并未列出，
> 但 `SourceControlResourceState.contextValue` 的 API 注释明确写着它会出现在该键里。

## 效果验证

1. `F5` 启动扩展开发宿主，打开 `code/scm-demo`；
2. 活动栏出现 `Demo16` 提供者，`src/extension.ts` 显示为「已修改」；
3. 点击文件名 → 编辑器 gutter 出现差异（由 `QuickDiffProvider` 提供）；
4. 在输入框写提交信息后 `Ctrl+Enter` → 变更列表清空，角标消失；
5. 右键条目执行「回滚」→ 文件内容恢复。

> 📷 待补充截图：`docs/images/scm-demo/source-control-view.png`

## 常见坑

- **变更列表不刷新**：`resourceStates` 是普通属性，改完要整体重新赋值（新数组）；
- **gutter 不出差异**：忘了 `quickDiffProvider`，或 `provideOriginalResource`
  返回的 scheme 没有对应的 `TextDocumentContentProvider`；
- **`acceptInputCommand` 不触发**：命令没注册，或 `inputBox.value` 为空时 VS Code 不提交；
- **提交后输入框没清空**：需要自己 `scm.inputBox.value = ''`；
- **活动栏图标不显示**：`package.json` 里缺少对应的 `viewsContainers`/`views` 贡献，
  或 `scm.count` 没更新；
- **`scm/title` 与 `scm/sourceControl` 混用**：前者是视图级，后者是提供者级，
  `when: scmProvider == 'xxx'` 才能限定到自己的提供者；
- **`dispose()` 要调用**：动态注册的 SCM 提供者不 dispose 会在视图里残留。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/scm-demo

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#scm
https://code.visualstudio.com/api/references/vscode-api#SourceControl
https://code.visualstudio.com/api/extension-guides/scm-provider
https://code.visualstudio.com/api/references/when-clause-contexts
```
