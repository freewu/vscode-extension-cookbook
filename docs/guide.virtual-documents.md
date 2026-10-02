# 虚拟文档 Virtual Documents

> 虚拟文档让扩展用**一个 Uri** 表示"并不存在于磁盘上的内容"，从而免费获得语法高亮、
> 搜索、Diff、转到定义等编辑器能力。内置的 `git:` scheme 就是同一套机制。
> 官方指南：https://code.visualstudio.com/api/extension-guides/virtual-documents

## 核心概念

| 概念                        | 说明                                                     |
| --------------------------- | -------------------------------------------------------- |
| scheme                      | Uri 的协议部分，自定义 scheme 必须唯一（如 `demo14`）    |
| `TextDocumentContentProvider` | 提供内容；**只读**，适合"生成式内容"                   |
| `onDidChange`               | 通知 VS Code 内容变了，需要重新调用 provider             |
| `FileSystemProvider`        | 需要读写、目录结构时用它（见文末）                        |

## 目录结构

```
virtual-documents-demo
├── package.json          只声明两个命令
└── src
    └── extension.ts      DemoContentProvider
```

## package.json 配置

```json
{
  "contributes": {
    "commands": [
      { "command": "demo14.open", "title": "Demo14 打开虚拟文档" },
      { "command": "demo14.refresh", "title": "Demo14 刷新虚拟文档" }
    ]
  }
}
```

> 纯内容提供者不需要额外贡献点，注册在 `activate` 里完成即可。

## extension.ts 实现

```typescript
import * as vscode from 'vscode';

/** 自定义 scheme：不能与 file / untitled 等内置 scheme 冲突 */
const SCHEME = 'demo14';
/** path 以 .md 结尾，VS Code 会自动按 markdown 处理 */
const DOC_URI = vscode.Uri.parse(`${SCHEME}://info/readme.md`);

export function activate(context: vscode.ExtensionContext) {
	const provider = new DemoContentProvider();

	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider));

	context.subscriptions.push(
		vscode.commands.registerCommand('demo14.open', async () => {
			// 必须先注册 provider，openTextDocument 才能解析这个 scheme
			const document = await vscode.workspace.openTextDocument(DOC_URI);
			await vscode.window.showTextDocument(document, { preview: false });
		})
	);

	context.subscriptions.push(vscode.commands.registerCommand('demo14.refresh', () => provider.refresh()));
}
```

### 内容提供者

```typescript
class DemoContentProvider implements vscode.TextDocumentContentProvider {
	private version = 0;

	private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	readonly onDidChange: vscode.Event<vscode.Uri> = this._onDidChange.event;

	/** 内容变化：fire 之后 VS Code 会重新调用 provideTextDocumentContent */
	refresh(): void {
		this.version += 1;
		this._onDidChange.fire(DOC_URI);
	}

	/** 可以返回字符串，也可以返回 Promise<string>；随取随生成，无需缓存 */
	provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): string {
		return `# 虚拟文档\n\n版本 ${this.version}，生成于 ${new Date().toLocaleString()}\n`;
	}
}
```

## Uri 设计建议

```typescript
// ✅ 用 authority/path/query 表达"同一个 scheme 下的不同资源"
vscode.Uri.parse('demo14://commit/3f2a1b/src/index.ts'); // 提交内容
vscode.Uri.from({ scheme: 'demo14', path: '/report.md', query: 'id=42' });

// ❌ 把整个路径塞进 authority，或让不同资源共用一个 Uri（会串内容）
vscode.Uri.parse('demo14://src/index.ts'); // authority = src，容易踩坑
```

- `path` 的扩展名决定语言模式（`.md` → markdown、`.json` → json），从而白拿高亮；
- 想让 Diff 正常工作，两个 Uri 的 `path` 最好一致，只用 `query` 区分版本。

## 只读性

虚拟文档默认不可编辑：

- `document.isDirty` 恒为 `false`，`Ctrl+S` 不会触发保存；
- `document.save()` 会拒绝；
- 用户尝试输入时 VS Code 会提示"该内容为只读"。

需要**可编辑**的虚拟文件系统（例如把远端目录挂到 `demo15://` 下）请用 `FileSystemProvider`：

```typescript
context.subscriptions.push(
	vscode.workspace.registerFileSystemProvider('demo15', new MyFileSystemProvider(), {
		isCaseSensitive: true,
		isReadonly: false,
	})
);
// 之后可以像本地文件一样使用
await vscode.workspace.fs.writeFile(vscode.Uri.parse('demo15:///notes.md'), Buffer.from('hi', 'utf8'));
```

## 效果验证

1. 用 VS Code 打开 `code/virtual-documents-demo`，按 `F5` 启动扩展开发宿主；
2. 命令面板执行 `Demo14 打开虚拟文档` → 标签页显示 `readme.md`（虚拟），
   内容带 Markdown 语法高亮，标题栏无保存按钮；
3. 再执行 `Demo14 刷新虚拟文档` → 「版本」递增、「生成时间」变化；
4. 尝试编辑 → VS Code 拒绝并提示只读。

> 📷 待补充截图：`docs/images/virtual-documents-demo/virtual-doc.png`

## 常见坑

- **打开文档报"无法打开"**：provider 还没注册就先 `openTextDocument`；
- **内容不刷新**：忘了 `onDidChange.fire(uri)`，或 fire 的 Uri 与打开的 Uri 不一致；
- **语言高亮不对**：`path` 没带扩展名；
- **想改内容却改不了**：`TextDocumentContentProvider` 天生只读，改用 `FileSystemProvider`；
- **provider 泄漏**：注册返回的 `Disposable` 没放进 `context.subscriptions`。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/virtual-documents-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/virtual-documents
https://code.visualstudio.com/api/references/vscode-api#TextDocumentContentProvider
https://code.visualstudio.com/api/references/vscode-api#FileSystemProvider
https://github.com/microsoft/vscode-extension-samples/tree/main/virtual-document-sample
```
