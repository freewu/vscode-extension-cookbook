# 自定义编辑器 Custom Editors

> 自定义编辑器让扩展接管某类文件的**编辑体验**，例如可视化编辑 JSON、表单式配置、图形化画布。
> 官方指南：https://code.visualstudio.com/api/extension-guides/custom-editors

## 三种自定义编辑器

| 类型                          | 适用场景                     | 谁负责保存/撤销      |
| ----------------------------- | ---------------------------- | -------------------- |
| `CustomTextEditorProvider`    | 文件本身就是文本（JSON/XML） | VS Code（推荐）      |
| `CustomEditorProvider`（二进制） | 图片、二进制、自定义格式  | 扩展自己             |
| `CustomReadonlyEditorProvider`  | 只读预览（如报表）         | 不需要               |

> 能用 `CustomTextEditorProvider` 就别用 `CustomEditorProvider`：保存、脏标记、撤销/重做、
> 文件监视、热退出恢复全部免费获得。

## 目录结构

```
custom-editors-demo
├── package.json          contributes.customEditors + 示例文件命令
├── media
│   ├── cat.css           编辑器样式（使用主题变量）
│   └── cat.js            编辑器前端逻辑
└── src
    └── extension.ts      CatEditorProvider
```

## package.json 配置

```json
{
  "contributes": {
    "customEditors": [
      {
        "viewType": "demo13.catEditor",
        "displayName": "Demo13 猫咪编辑器",
        // 匹配哪些文件交给这个编辑器
        "selector": [{ "filenamePattern": "*.cat" }],
        // default：双击直接用自定义编辑器打开；option：只出现在"打开方式…"里
        "priority": "default"
      }
    ],
    "commands": [{ "command": "demo13.createSample", "title": "Demo13 创建示例 .cat 文件" }]
  }
}
```

> `readonly` 场景把 `priority` 设为 `option`，避免抢走用户的默认打开方式。

## 注册与实现

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider('demo13.catEditor', new CatEditorProvider(context), {
			webviewOptions: { retainContextWhenHidden: true },
			supportsMultipleEditorsPerDocument: false,
		})
	);
}

class CatEditorProvider implements vscode.CustomTextEditorProvider {
	constructor(private readonly context: vscode.ExtensionContext) {}

	async resolveCustomTextEditor(
		document: vscode.TextDocument,
		panel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
		};
		panel.webview.html = this.getHtml(panel.webview);
		// ……双向同步
	}
}
```

### 文档 → 编辑器

```typescript
const syncToWebview = () => {
	void panel.webview.postMessage({ type: 'update', text: document.getText() });
};
syncToWebview();

// 文档变化时同步（包含 VS Code 自己的撤销/重做）
const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
	if (event.document.uri.toString() === document.uri.toString()) {
		syncToWebview();
	}
});
panel.onDidDispose(() => changeSubscription.dispose());
```

### 编辑器 → 文档（关键）

**必须**用 `WorkspaceEdit` 修改 `TextDocument`，不要直接写文件：

```typescript
panel.webview.onDidReceiveMessage(async (message: { type: string; text?: string }) => {
	if (message.type !== 'edit' || message.text === undefined) {
		return;
	}
	const edit = new vscode.WorkspaceEdit();
	// 全量替换整篇文档
	const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
	edit.replace(document.uri, fullRange, message.text);
	await vscode.workspace.applyEdit(edit);
});
```

> 直接 `fs.writeFile` 的后果：标签页没有脏标记、`Ctrl+Z` 无效、文件监视触发自我循环。
> 细粒度修改可以用 `edit.replace(uri, range, text)` 只改变化的区间。

### 打开指定编辑器

```typescript
await vscode.commands.executeCommand('vscode.openWith', uri, 'demo13.catEditor');
```

> 需要「并排显示不同编辑方式」时：在编辑器标题栏右键 → `Reopen Editor With…`。

## 二进制格式（CustomEditorProvider）要点

如果文件不是文本，需要自己实现这些方法，缺一不可：

| 方法                   | 作用                         |
| ---------------------- | ---------------------------- |
| `resolveCustomEditor`  | 渲染面板                     |
| `saveCustomDocument`   | `Ctrl+S` 时写回              |
| `revertCustomDocument` | 放弃修改                     |
| `backupCustomDocument` | 热退出（Hot Exit）时临时备份 |
| `saveCustomDocumentAs` | 另存为                       |

## 效果验证

1. 用 VS Code 打开 `code/custom-editors-demo`，按 `F5` 启动扩展开发宿主；
2. 命令面板执行 `Demo13 创建示例 .cat 文件`；
3. 编辑器用自定义界面打开，改动后点「应用」→ 标签页出现 `●` 脏标记；
4. `Ctrl+Z` 能撤销、`Ctrl+S` 能保存；
5. 「放弃修改」按钮重新拉取文档内容。

> 📷 待补充截图：`docs/images/custom-editors-demo/cat-editor.png`

## 常见坑

- **打开时仍是文本编辑器**：`selector` 没匹配上，或 `viewType` 与注册的不一致；
- **保存后内容丢失**：直接用 `fs` 写文件，绕过了 `TextDocument`；
- **撤销失效**：同上，或每次 `applyEdit` 都在替换全文却没走文档模型；
- **面板重建后数据没了**：没开 `retainContextWhenHidden`，也没做状态恢复；
- **同一文件多个面板互相打架**：`supportsMultipleEditorsPerDocument` 需要返回唯一 id
  并在文档变化时同步所有面板。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/custom-editors-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/custom-editors
https://code.visualstudio.com/api/extension-guides/webview
https://github.com/microsoft/vscode-extension-samples/tree/main/custom-editor-sample
```
