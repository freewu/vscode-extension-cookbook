# languages 相关 API

> `vscode.languages` 提供**语言特性（Language Features）**：补全、悬停、跳转、诊断、
> 语义高亮、格式化等。它是"不写 Language Server 也能给编辑器加智能"的入口。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#languages
> 相关指南：[语言扩展总览](https://code.visualstudio.com/api/language-extensions/overview)

## 全局变量 Variables

| 成员                       | 类型                                        | 说明                             |
| -------------------------- | ------------------------------------------- | -------------------------------- |
| `onDidChangeDiagnostics`   | `Event<DiagnosticChangeEvent>`              | 任意文件的诊断发生变化           |

## 方法 Functions

### 查询与匹配

| 成员                                          | 说明                                                        |
| --------------------------------------------- | ----------------------------------------------------------- |
| `getLanguages()`                              | 返回所有已注册的语言 id                                      |
| `match(selector, document)`                    | 判断 `DocumentSelector` 是否匹配某个文档（自己写 provider 时很有用） |
| `getDiagnostics()` / `getDiagnostics(uri)`    | 读取诊断（全部 / 单个文件）                                  |
| `setTextDocumentLanguage(document, languageId)` | 切换文档语言（返回切换后的新 `TextDocument`）              |
| `createDiagnosticCollection(name?)`           | 创建诊断集合，用 `set(uri, diagnostics)` 发布                |
| `createLanguageStatusItem(id, selector)`      | 在状态栏语言区域显示状态项                                   |

### 注册类 Provider（共 30+ 个）

按能力分类，命名规律都是 `registerXxxProvider(selector, provider, ...triggerCharacters)`：

| 分类         | 成员                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 补全         | `registerCompletionItemProvider`、`registerInlineCompletionItemProvider`                                                  |
| 悬浮/提示    | `registerHoverProvider`、`registerSignatureHelpProvider`、`registerInlayHintsProvider`                                     |
| 跳转         | `registerDefinitionProvider`、`registerDeclarationProvider`、`registerImplementationProvider`、`registerTypeDefinitionProvider`、`registerReferenceProvider` |
| 层级         | `registerCallHierarchyProvider`、`registerTypeHierarchyProvider`                                                            |
| 符号/高亮    | `registerDocumentSymbolProvider`、`registerWorkspaceSymbolProvider`、`registerDocumentHighlightProvider`、`registerDocumentSemanticTokensProvider`、`registerDocumentRangeSemanticTokensProvider` |
| 编辑操作     | `registerCodeActionsProvider`、`registerCodeLensProvider`、`registerRenameProvider`、`registerFormattingEditProvider`、`registerDocumentRangeFormattingEditProvider`、`registerOnTypeFormattingEditProvider`、`registerDocumentPasteEditProvider`、`registerDocumentDropEditProvider` |
| 其他         | `registerColorProvider`、`registerFoldingRangeProvider`、`registerSelectionRangeProvider`、`registerLinkedEditingRangeProvider`、`registerEvaluatableExpressionProvider`、`registerInlineValuesProvider`、`registerDocumentLinkProvider`、`setLanguageConfiguration` |

> `DocumentSelector` 可以只写 `{ language: 'plaintext' }`，也可以加
> `scheme`、`pattern`（glob）来限制作用范围。

## 示例：悬停 + 补全 + 诊断

```typescript
import * as vscode from 'vscode';

const SELECTOR: vscode.DocumentSelector = { language: 'plaintext' };

export function activate(context: vscode.ExtensionContext) {
	// 1) 悬停
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(SELECTOR, {
			provideHover(document, position) {
				const range = document.getWordRangeAtPosition(position, /TODO/);
				if (!range) {
					return undefined;
				}
				return new vscode.Hover(new vscode.MarkdownString('**TODO**'), range);
			},
		})
	);

	// 2) 补全（第三个参数是触发字符）
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			SELECTOR,
			{
				provideCompletionItems() {
					const item = new vscode.CompletionItem('console.log', vscode.CompletionItemKind.Snippet);
					item.insertText = new vscode.SnippetString('console.log(${1:value});');
					return [item];
				},
			},
			'.'
		)
	);

	// 3) 诊断
	const diagnostics = vscode.languages.createDiagnosticCollection('demoLang');
	context.subscriptions.push(diagnostics, vscode.workspace.onDidChangeTextDocument((e) => {
		if (e.document.languageId !== 'plaintext') {
			return;
		}
		const found: vscode.Diagnostic[] = [];
		for (const match of e.document.getText().matchAll(/FIXME/g)) {
			const range = new vscode.Range(
				e.document.positionAt(match.index),
				e.document.positionAt(match.index + match[0].length)
			);
			// severity: Error / Warning / Information / Hint
			found.push(new vscode.Diagnostic(range, '发现 FIXME', vscode.DiagnosticSeverity.Warning));
		}
		diagnostics.set(e.document.uri, found);
	}));
}
```

## 触发方式：自动激活

注册 Provider 的调用会被 VS Code **静态分析**，根据 selector 里的语言自动生成
`onLanguage:<languageId>` 激活事件，因此 `package.json` 里可以写 `"activationEvents": []`。

> 前提是 selector 是**字面量**。如果写成变量拼接（动态构造），自动激活会失效，
> 必须在 `activationEvents` 里手写 `onLanguage:xxx`。

## 效果验证

1. `F5` 启动扩展开发宿主，打开 `code/api-languages-demo`；
2. 新建一个 `plaintext` 文档（如 `.txt`），输入 `FIXME` → 「问题」面板出现警告；
3. 输入 `TODO` 并把鼠标悬停上去 → 出现带命令链接的悬浮卡片；
4. 输入 `.` → 出现 `console.log` 代码片段；
5. 执行命令「DemoLang 统计 VS Code 支持的语言数量」。

> 📷 待补充截图：`docs/images/api-languages/hover-and-diagnostics.png`

## 常见坑

- **Provider 一定要 dispose**：`registerXxxProvider` 返回 `Disposable`，忘记注册
  会导致重载扩展后出现重复建议、重复诊断；
- **`provideDiagnostics` 不存在**：诊断是"推"模式，必须自己维护 `DiagnosticCollection`；
- **诊断不会自动过期**：应监听 `onDidChangeTextDocument` 更新，并在
  `onDidCloseTextDocument` 时 `delete(uri)`；
- **性能**：Provider 会被高频调用（每次按键、每次鼠标移动），
  补全/悬停要尽量轻量，必要时加缓存或延时；
- **语义高亮要注册两个 provider**：`registerDocumentSemanticTokensProvider` 还会需要
  legend（token 类型/修饰符），且必须和 package.json 里声明的语言一致；
- **`registerCompletionItemProvider` 的触发字符不要滥用**：会增加每次输入的调用量；
- **`createLanguageStatusItem` 的 id 要加扩展名前缀**，避免冲突。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/api-languages-demo

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#languages
https://code.visualstudio.com/api/language-extensions/programmatic-language-features
https://code.visualstudio.com/api/language-extensions/language-server-extension-guide
https://github.com/microsoft/vscode-extension-samples
```
