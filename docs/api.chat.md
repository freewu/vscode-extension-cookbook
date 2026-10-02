# chat 相关 API

> `vscode.chat` 让扩展以**聊天参与者（Chat Participant）**的身份接入 VS Code 的 Chat 视图：
> 用户可以 `@你的名字 问题…` 直接调用你的能力，你则以流式 Markdown 回复。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#chat
> 官方指南：https://code.visualstudio.com/api/extension-guides/chat
> 相关：大模型调用见 [lm 相关 API](./api.lm.md)

## 方法 Functions

| 成员                    | 签名                                                          | 说明                                           |
| ----------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `createChatParticipant` | `(id: string, handler: ChatRequestHandler) => ChatParticipant` | 注册参与者；`id` 形如 `publisher.name`，与贡献点一致 |

## ChatParticipant

| 成员                      | 说明                                                         |
| ------------------------- | ------------------------------------------------------------ |
| `id`                      | `publisher.name`，用户输入 `@name` 时匹配                     |
| `iconPath`                | 头像（可选）                                                  |
| `requestHandler`          | 可读写：运行期替换处理器（例如按用户设置切换实现）             |
| `followupProvider`        | 提供"后续建议"按钮                                            |
| `onDidReceiveFeedback`    | 用户点赞/点踩事件                                             |
| `dispose()`               | 注销参与者                                                    |

## 处理器签名

```typescript
type ChatRequestHandler = (
	request: vscode.ChatRequest,        // prompt / command / references / location
	context: vscode.ChatContext,        // history（本次会话历史）
	response: vscode.ChatResponseStream,// 流式输出
	token: vscode.CancellationToken
) => void | Thenable<void>;
```

### ChatResponseStream 常用方法

| 方法                                            | 说明                                                       |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `markdown(text)`                                | 追加 Markdown（最常用）                                    |
| `progress(text)`                                | 显示"进行中"的进度条                                        |
| `anchor(uri, title)`                            | 插入可点击的文件引用                                        |
| `reference(uri, range?)` / `reference2(...)`    | 插入引用（会显示成 chip）                                   |
| `button({ command, title })`                    | 插入命令按钮                                                |
| `filetree(uri)`                                 | 插入文件树片段                                              |
| `codeblockUri(uri)` / `textEdit(workspaceEdit)` | 直接给编辑器中的代码块 / 建议编辑（**会走"应用"确认流程**） |
| `push(part)`                                    | 追加任意 `ChatResponsePart`                                 |

## 贡献点

```jsonc
{
  "contributes": {
    "chatParticipants": [
      {
        "id": "demo.chat",
        "name": "demo",
        "fullName": "Demo 助手",
        "description": "演示用的聊天参与者",
        "isSticky": true,
        "commands": [
          { "name": "explain", "description": "解释选中的代码" },
          { "name": "count", "description": "统计工作区文件" }
        ]
      }
    ]
  }
}
```

> 自 VS Code 1.90 起，贡献了 `chatParticipants` 的扩展**不需要**手写
> `onChatParticipant:...` 激活事件，会自动激活。

## 完整示例

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const participant = vscode.chat.createChatParticipant('demo.chat', async (request, context, response, token) => {
		// 1) 子命令分发
		if (request.command === 'count') {
			response.progress('正在统计文件…');
			const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 1000);
			if (token.isCancellationRequested) {
				return;
			}
			response.markdown(`工作区里至少有 **${files.length}** 个文件。\n\n`);
			response.button({ command: 'workbench.action.findInFiles', title: '打开搜索' });
			return;
		}

		// 2) 普通提问：先给出用户输入的回显
		response.markdown(`你问的是：${request.prompt}\n\n`);

		// 3) 若用户用 #file 之类引用了内容，references 里能拿到
		for (const ref of request.references) {
			const value = ref.value;
			if (value instanceof vscode.Uri) {
				response.anchor(value, vscode.workspace.asRelativePath(value));
			}
		}

		// 4) 流式或一次性输出（这里演示简单的"分段"）
		response.markdown('\n\n');
		response.push(new vscode.MarkdownString('_由 demo.chat 提供_'));
	});

	// 后续建议按钮
	participant.followupProvider = {
		provideFollowups: () => [
			{ prompt: '再详细一点', label: '展开说明' },
			{ prompt: '给我一个例子', label: '举个例子' },
			{ command: 'count', label: '统计文件数量' },
		],
	};

	// 用户反馈
	participant.onDidReceiveFeedback((feedback) => {
		console.log('用户反馈：', vscode.ChatResultFeedbackKind[feedback.kind], feedback.result.metadata);
	});

	participant.iconPath = new vscode.ThemeIcon('beaker');
	context.subscriptions.push(participant);
}

export function deactivate() {}
```

## 和语言模型配合

聊天参与者本身**不提供模型**。要让回复由大模型生成，需要走
[lm 相关 API](./api.lm.md)：

```typescript
const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
const model = models[0];
if (!model) {
	response.markdown('没有可用的语言模型，请先登录 Copilot。');
	return;
}
const messages = [vscode.LanguageModelChatMessage.User(request.prompt)];
const chatResponse = await model.sendRequest(messages, {}, token);
for await (const fragment of chatResponse.text) {
	response.markdown(fragment);
}
```

## 效果验证

1. `F5` 启动扩展开发宿主，打开 Chat 视图；
2. 输入 `@demo 你好` → 看到回显与后续建议按钮；
3. 输入 `@demo /count` → 出现进度提示与文件数量；
4. 点赞/点踩 → 调试控制台打印反馈类型。

> 📷 待补充截图：`docs/images/api-chat/participant.png`

## 常见坑

- **`@demo` 找不到**：`createChatParticipant` 的 `id` 与 `chatParticipants.id` 不一致，
  或 `name` 与用户输入的名字不同；
- **回复什么都不显示**：处理器里忘了往 `response` 写内容（返回 `undefined` 不会产生任何输出）；
- **忽略 `token`**：长任务必须检查 `token.isCancellationRequested`，否则用户点"停止"无效；
- **`request.references` 的 `value` 可能是多种类型**：`Uri` / `Location` / `string`，
  需要自己判类型；
- **`ChatResultFeedbackKind` 需要下标**：它是枚举，直接打印对象即可；
- **Chat API 仍在新版本演进**：`reference` 有 `reference2` 的替代、部分能力需要
  `enabledApiProposals`，升级 VS Code 时留意 release notes；
- **不要在处理器里做重活阻塞**：先 `progress` 再 `await`，让用户看到反馈。

## 项目代码
> 本仓库暂无独立 demo，可参考官方 chat 系列示例：
> https://github.com/microsoft/vscode-extension-samples/tree/main/chat-sample

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#chat
https://code.visualstudio.com/api/extension-guides/chat
https://code.visualstudio.com/api/references/contribution-points#contributes.chatParticipants
https://code.visualstudio.com/api/extension-guides/language-model
```
