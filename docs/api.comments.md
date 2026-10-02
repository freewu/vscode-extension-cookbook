# comments 相关 API

> `vscode.comments` 让你把**代码评审 / 批注**搬进编辑器：在指定文件的指定区间挂一条
> 「评论线程」，用户可以直接在 gutter 和「评论」面板里查看、回复、解决。
> GitHub PR、GitLens、代码审计类扩展都用它。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#comments
> 官方示例：https://github.com/microsoft/vscode-extension-samples/tree/main/comment-sample

## 方法 Functions

| 成员                      | 签名                                                | 说明                                       |
| ------------------------- | --------------------------------------------------- | ------------------------------------------ |
| `createCommentController` | `(id: string, label: string) => CommentController`  | 创建评论控制器（会在「评论」视图出现分组） |

> 注意：`vscode.comments` 命名空间只导出一个方法，其余能力都在对象上。

## CommentController

| 成员                       | 说明                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| `id` / `label`             | 标识                                                                 |
| `options`                  | `CommentOptions`：`prompt`（输入框占位）、`placeHolder`（输入区提示） |
| `commentingRangeProvider`  | 决定**哪些行可以被评论**（没提供的行不出现 `+` 提示）                |
| `createCommentThread(uri \| range, comments)` | 创建一条评论线程                            |
| `dispose()`                | 注销控制器及其所有线程                                               |

## CommentThread / Comment

| `CommentThread` 成员      | 说明                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `uri` / `range`           | 挂载位置                                                   |
| `comments`                | 评论数组，**整体赋值才会刷新 UI**                          |
| `collapsibleState`        | `Expanded` / `Collapsed`                                   |
| `canReply`                | 是否允许用户回复（默认 `true`）                            |
| `contextValue`            | 配合 `comments/commentThread/context` 菜单的 `when`        |
| `label` / `state`         | 线程标题 / `CommentThreadState`（如"未解决/已解决"）       |
| `dispose()`               | 移除该线程                                                 |

| `Comment` 成员            | 说明                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `body`                    | `string \| MarkdownString`（`MarkdownString` 才能带链接）  |
| `mode`                    | `CommentMode.Preview` / `Editing`                          |
| `author`                  | `{ name: string; iconPath?: Uri \| {light, dark} }`        |
| `contextValue`            | 配合 `comments/comment/context` 菜单                       |
| `timestamp` / `label` / `savedBody` / `parent` | 附加展示信息                     |

## 完整流程示例

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const controller = vscode.comments.createCommentController('demoComments', 'Demo 评论');
	context.subscriptions.push(controller);

	controller.options = { prompt: '写点什么…', placeHolder: '输入评论后按 Enter' };

	// 只允许在非空行上评论
	controller.commentingRangeProvider = {
		provideCommentingRanges: (document) => {
			const ranges: vscode.Range[] = [];
			for (let line = 0; line < document.lineCount; line++) {
				const text = document.lineAt(line).text;
				if (text.trim().length > 0) {
					ranges.push(new vscode.Range(line, 0, line, 0));
				}
			}
			return ranges;
		},
	};

	// 新建线程：命令里传入或自己构造
	context.subscriptions.push(
		vscode.commands.registerCommand('demoComments.create', (uri?: vscode.Uri) => {
			const target = uri ?? vscode.window.activeTextEditor?.document.uri;
			if (!target) {
				return;
			}
			controller.createCommentThread(target, new vscode.Range(0, 0, 0, 0), [
				{
					body: new vscode.MarkdownString('这是 **Demo** 创建的第一条评论'),
					mode: vscode.CommentMode.Preview,
					author: { name: 'Demo 机器人' },
				},
			]);
		})
	);

	// 回复：comments/commentThread/context 菜单会把 CommentReply 传进来
	context.subscriptions.push(
		vscode.commands.registerCommand('demoComments.reply', async (reply: vscode.CommentReply) => {
			const thread = reply.thread;
			// 直接把 reply.body 追加到线程里（真实场景应发到后端再回写）
			thread.comments = [
				...thread.comments,
				{
					body: new vscode.MarkdownString(reply.body),
					mode: vscode.CommentMode.Preview,
					author: { name: 'Demo 机器人' },
				},
			];
			thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
		}),

		// 删除一条评论：comments/comment/context 菜单把 CommentThread 传进来
		vscode.commands.registerCommand('demoComments.delete', (thread: vscode.CommentThread) => {
			thread.dispose();
		}),

		// 编辑评论（把 mode 切成 Editing，用户改完再切回 Preview）
		vscode.commands.registerCommand('demoComments.edit', (thread: vscode.CommentThread) => {
			const first = thread.comments[0];
			if (!first) {
				return;
			}
			first.savedBody = first.body;
			first.mode = vscode.CommentMode.Editing;
		})
	);

	// 说明：Comments API **没有** onDidChange* 事件，
	// 线程的增删改都由你自己的数据源驱动（后端拉取 → 重建 Thread）。
	// 需要响应 UI 上的操作时，靠上面这些菜单命令与 CommentReply 即可。
}
```

## package.json 贡献点

```jsonc
{
  "contributes": {
    "commands": [
      { "command": "demoComments.create", "title": "Demo 新建评论" },
      { "command": "demoComments.reply", "title": "回复" },
      { "command": "demoComments.delete", "title": "删除评论" }
    ],
    "menus": {
      // 线程内输入框旁的提交按钮 → 参数是 CommentReply
      "comments/commentThread/context": [
        { "command": "demoComments.reply", "group": "inline", "when": "commentController == 'demoComments'" }
      ],
      // 单条评论的右键菜单 → 参数是 CommentThread
      "comments/comment/context": [
        { "command": "demoComments.delete", "when": "commentController == 'demoComments'" }
      ],
      // 线程标题区的按钮 → 参数是 CommentThread
      "comments/commentThread/title": [
        { "command": "demoComments.delete", "group": "inline" }
      ]
    }
  }
}
```

| 菜单 id                          | 命令收到的参数     |
| -------------------------------- | ------------------ |
| `comments/commentThread/context` | `CommentReply`     |
| `comments/commentThread/title`   | `CommentThread`    |
| `comments/comment/context`       | `CommentThread`    |
| `comments/comment/title`         | `CommentThread`    |
| `comments/commentEditor/context` | `CommentReply`     |

可用 when 键：`commentController`（= `createCommentController` 的 id）、
`commentThread`、`comment` 的 `contextValue`。

## 效果验证

1. `F5` 启动扩展开发宿主，打开任意文本文件；
2. 行号左侧出现可评论的 `+`（由 `commentingRangeProvider` 决定）；
3. 执行 demo 命令创建线程 → gutter 出现评论气泡；
4. 在输入框回复 → 线程里追加一条；
5. 打开「评论」视图（活动栏）→ 看到同一个线程的分组列表。

> 📷 待补充截图：`docs/images/api-comments/comment-thread.png`

## 常见坑

- **`+` 号不出现**：没设置 `commentingRangeProvider`（默认没有可评论范围）；
- **回复不生效**：只在 `commands` 里声明了命令，没在 `menus` 里挂到
  `comments/commentThread/context`，或者 `thread.canReply === false`；
- **改了 `thread.comments[0].body` 界面不刷新**：`comments` 要**整体重新赋值**；
- **编辑态回不到预览**：记得监听并把 `mode` 改回 `CommentMode.Preview`
  （真实实现还会在此处调用后端）；
- **`MarkdownString` 想渲染命令链接**：要 `isTrusted = true`，否则链接被禁用；
- **线程 dispose 后仍引用**：外部缓存要同步清理，否则内存泄漏；
- **控制器不 dispose**：`context.subscriptions.push(controller)`。

## 项目代码
> 本仓库暂无独立 demo，可参考官方 comment-sample：
> https://github.com/microsoft/vscode-extension-samples/tree/main/comment-sample

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#comments
https://code.visualstudio.com/api/references/vscode-api#CommentController
https://code.visualstudio.com/api/references/vscode-api#CommentThread
https://github.com/microsoft/vscode-extension-samples/tree/main/comment-sample
```
