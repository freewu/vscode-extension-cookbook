# lm 相关 API

> `vscode.lm` 是**语言模型（Language Model）**入口：选择可用的模型、发起流式对话、
> 注册「工具（Tool）」让模型可以回调你的代码、接入 MCP Server、或自己当模型提供方。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#lm
> 官方指南：https://code.visualstudio.com/api/extension-guides/language-model
> 相关：[chat 相关 API](./api.chat.md)、[工具指南](https://code.visualstudio.com/api/extension-guides/tools)

## 全局变量 Variables

| 成员                  | 类型                                | 说明                                                     |
| --------------------- | ----------------------------------- | -------------------------------------------------------- |
| `tools`               | `readonly LanguageModelToolInformation[]` | 当前所有已注册且对模型可见的工具（含其它扩展的）  |
| `onDidChangeChatModels` | `Event<void>`                     | 可用模型列表变化（用户登录/登出 Copilot、安装新模型…）   |

## 方法 Functions

| 成员                                  | 签名                                                              | 说明                                     |
| ------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| `selectChatModels`                    | `(selector?: LanguageModelChatSelector) => Thenable<LanguageModelChat[]>` | 按条件挑选模型；**首次会弹用户授权** |
| `registerTool`                        | `<T>(name: string, tool: LanguageModelTool<T>) => Disposable`     | 注册工具（`name` 要与贡献点一致）        |
| `invokeTool`                          | `(name, options, token?) => Thenable<LanguageModelToolResult>`    | 代码里主动调用某个工具                   |
| `registerMcpServerDefinitionProvider` | `(id: string, provider: McpServerDefinitionProvider) => Disposable` | 动态提供 MCP Server 定义              |
| `registerLanguageModelChatProvider`   | `(vendor: string, provider: LanguageModelChatProvider) => Disposable` | 自己实现一个模型提供方（进阶）       |

### selectChatModels 的选择器

```typescript
{ vendor?: string; family?: string; version?: string; id?: string }
```

```typescript
// 优先 Copilot，其次任意模型
const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
const model = models[0] ?? (await vscode.lm.selectChatModels())[0];
if (!model) {
	void vscode.window.showWarningMessage('没有可用的语言模型');
	return;
}
```

## LanguageModelChat

| 成员                          | 说明                                                     |
| ----------------------------- | -------------------------------------------------------- |
| `id` / `name` / `vendor` / `family` / `version` | 标识信息                            |
| `maxInputTokens`              | 单次请求的输入上限，**超了会抛错**                       |
| `countTokens(text \| message)`| 估算 token 数                                            |
| `sendRequest(messages, options?, token?)` | 发起请求，返回 `LanguageModelChatResponse`    |

```typescript
const messages = [
	vscode.LanguageModelChatMessage.User('用一句话解释什么是扩展宿主'),
];

const response = await model.sendRequest(messages, {}, token);

// 方式一：增量文本
for await (const fragment of response.text) {
	process.stdout.write(fragment);
}

// 方式二：结构化片段（可能是文本、工具调用、数据）
for await (const part of response.stream) {
	if (part instanceof vscode.LanguageModelTextPart) {
		console.log(part.value);
	} else if (part instanceof vscode.LanguageModelToolCallPart) {
		console.log('模型想调用工具', part.name, part.input);
	}
}
```

消息构造：

```typescript
vscode.LanguageModelChatMessage.User('你好');
vscode.LanguageModelChatMessage.User([new vscode.LanguageModelTextPart('你好')]);
vscode.LanguageModelChatMessage.Assistant('我是助手');
vscode.LanguageModelChatMessage.User([
	new vscode.LanguageModelToolResultPart(callId, [new vscode.LanguageModelTextPart('工具结果')]),
]);
```

## 注册一个工具（Tool）

```typescript
interface DemoInput {
	path: string;
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.lm.registerTool<DemoInput>('demo_readFileSummary', {
			// 让模型知道这个工具"该怎么用"（也会进 # 引用列表）
			prepareInvocation: async (options, token) => ({
				invocationMessage: `读取 ${options.input.path} 的摘要`,
			}),

			invoke: async (options, token) => {
				const uri = vscode.Uri.joinPath(
					vscode.workspace.workspaceFolders![0].uri,
					options.input.path
				);
				const bytes = await vscode.workspace.fs.readFile(uri);
				const text = new TextDecoder().decode(bytes);
				// 返回值会作为工具结果回给模型
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart(`${options.input.path}：${text.slice(0, 200)}…`),
				]);
			},
		})
	);
}
```

```jsonc
// package.json：不贡献就没有工具列表，模型也不会调用
{
  "contributes": {
    "languageModelTools": [
      {
        "name": "demo_readFileSummary",
        "displayName": "读取文件摘要",
        "toolReferenceName": "readFileSummary",
        "canBeReferencedInPrompt": true,
        "userDescription": "读取工作区文件并返回前 200 个字符",
        "modelDescription": "Read a workspace file and return the first 200 characters as a summary.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "相对于工作区根目录的路径" }
          },
          "required": ["path"]
        },
        "tags": ["demo"]
      }
    ]
  }
}
```

> 贡献了 `languageModelTools` 的扩展会在需要时**自动激活**。
> 各字段的完整取值以官方
> [languageModelTools 贡献点文档](https://code.visualstudio.com/api/references/contribution-points#contributes.languageModelTools) 为准。

### 主动调用工具

```typescript
const result = await vscode.lm.invokeTool(
	'demo_readFileSummary',
	{ input: { path: 'README.md' }, toolInvocationToken: undefined },
	token
);
```

## 接入 MCP Server

```typescript
context.subscriptions.push(
	vscode.lm.registerMcpServerDefinitionProvider('demo.mcp', {
		onDidChangeMcpServerDefinitions: new vscode.EventEmitter<void>().event,
		provideMcpServerDefinitions: async () => [
			// vscode.McpStdioServerDefinition / McpHttpServerDefinition 等
		],
		resolveMcpServerDefinition: async (server) => server,
	})
);
```

## 效果验证

1. `F5` 启动扩展开发宿主，打开 Chat 视图（需先登录 Copilot）；
2. 输入 `#readFileSummary` 看工具是否出现在引用建议里；
3. 让模型执行该工具 → 观察 `invoke` 被调用并返回结果；
4. 在代码里 `selectChatModels()` 后 `sendRequest` 观察流式输出。

> 📷 待补充截图：`docs/images/api-lm/tool-invocation.png`

## 常见坑

- **`selectChatModels` 抛错 / 返回空**：用户没登录 Copilot，或拒绝了模型访问授权；
  必须处理"没有模型"的分支；
- **请求超过 `maxInputTokens`**：先用 `countTokens` 估算并裁剪历史；
- **`LanguageModelChatMessage` 的 `content` 只接受特定 Part 类型**：
  `sendRequest` 时用 `TextPart`/`ToolResultPart`/`DataPart`，
  Assistant 消息里才能出现 `ToolCallPart`；
- **工具没被调用**：`registerTool` 的 name 与 `languageModelTools[].name` 不一致，
  或 `inputSchema` 与代码里的泛型不匹配；
- **用户数据要合规**：把内容发给模型前必须征得用户同意（VS Code 的授权弹窗只覆盖"访问模型"，
  不代表你可以随意上传代码）；
- **不要硬编码模型名**：用选择器 + 兜底，模型家族会随产品迭代变化；
- **`reportProgress`/`invocationMessage` 是可选的**，但长耗时工具应给出反馈，否则用户以为卡死。

## 项目代码
> 本仓库暂无独立 demo，可参考官方 lm 系列示例：
> https://github.com/microsoft/vscode-extension-samples/tree/main/lm-api-sample

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#lm
https://code.visualstudio.com/api/extension-guides/language-model
https://code.visualstudio.com/api/extension-guides/tools
https://code.visualstudio.com/api/references/contribution-points#contributes.languageModelTools
https://code.visualstudio.com/api/extension-guides/mcp
```
