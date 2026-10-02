# commands 相关 API

> `vscode.commands` 负责**命令的注册与调用**，是扩展与 VS Code、扩展与扩展之间最常用的协作方式。
> 你写在 `contributes.commands` 里的每一项，最终都要靠 `registerCommand` 落地一个实现。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#commands
> 配套指南：[命令 Command](./guide.command.md)

## 方法 Functions

| 成员                         | 签名                                                                        | 说明                                                                   |
| ---------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `registerCommand`            | `(command: string, callback: (...args: any[]) => any, thisArg?) => Disposable` | 注册命令，返回值必须放进 `context.subscriptions`                       |
| `registerTextEditorCommand`  | `(command, callback: (editor, edit, ...args) => void, thisArg?) => Disposable` | 注册命令，回调会**自动带上** `TextEditor` 与 `TextEditorEdit` 两个前置参数 |
| `executeCommand`             | `<T>(command: string, ...rest: any[]) => Thenable<T>`                        | 调用任意命令（含 VS Code 内置命令），返回值就是被调命令的返回值        |
| `getCommands`                | `(filterInternal?: boolean) => Thenable<string[]>`                           | 列出当前已注册的命令 id                                                |

### registerCommand vs registerTextEditorCommand

```typescript
// 普通命令：参数由调用方决定
vscode.commands.registerCommand('demo.cmd.hello', (name?: string) => {
	return `hello ${name ?? 'world'}`;
});

// 编辑器命令：只有编辑器聚焦时才可执行，回调的前两个参数由 VS Code 注入
vscode.commands.registerTextEditorCommand('demo.cmd.upper', (editor, edit) => {
	const selection = editor.selection;
	const text = editor.document.getText(selection);
	// edit 是"一次性"编辑器：同一次 execute 中所有修改会合并成一步撤销
	edit.replace(selection, text.toUpperCase());
});
```

## 调用内置命令

命令面板（`Ctrl+Shift+P`）里能搜到的每一项背后都是一个命令，因此内置能力可以代码调用：

```typescript
await vscode.commands.executeCommand('workbench.action.files.save');
await vscode.commands.executeCommand('editor.action.formatDocument');
await vscode.commands.executeCommand('vscode.open', vscode.Uri.file('/tmp/a.txt'));
await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, '差异标题');
await vscode.commands.executeCommand('workbench.extensions.installExtension', 'ms-python.python');
```

`executeCommand` 无类型约束，参数写错只会在扩展宿主控制台报错。

## 返回值与异步

`executeCommand` 的泛型就是被调命令的返回值类型：

```typescript
const result = await vscode.commands.executeCommand<number>('demo.cmd.add', 1, 2); // 3
```

- 被调命令返回 `Promise` 时，`executeCommand` 会等待它；
- 被调命令抛错时，`executeCommand` 会 reject —— 跨扩展调用建议 try/catch。

## 效果验证

1. `F5` 启动扩展开发宿主；
2. 命令面板执行「Demo 命令」观察结果；
3. 打开一个文本文件，选中内容后执行「转大写」验证 `TextEditorEdit`。

> 📷 待补充截图：`docs/images/guide-command/command-palette.png`

## 常见坑

- **`command 'x' already exists`**：`registerCommand` 的返回值没进 `subscriptions`，
  重载窗口时旧命令没被注销；
- **命令面板搜不到**：只注册了 `registerCommand` 但没在 `package.json` 的
  `contributes.commands` 里声明（反过来说，声明了但没注册，点了会报「未找到命令」）；
- **命令名冲突**：务必用 `<extensionName>.<action>` 前缀，避免和其他扩展撞车；
- **从命令面板触发时没有参数**：界面入口只会调用 `executeCommand(id)`，
  需要参数得靠 `when` 条件 + 菜单里的 `"args"`，或自己再用 `executeCommand(id, arg)` 转发；
- **`TextEditorEdit` 不能跨 await 使用**：一旦离开当前 tick，edit 会失效；
- **`getCommands` 不包含内置命令的完整列表**：默认过滤掉了内部命令，
  传 `true` 才会包含（且不同版本行为略有差异）。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/hello-world

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#commands
https://code.visualstudio.com/api/references/contribution-points#contributes.commands
https://code.visualstudio.com/api/references/commands
```
