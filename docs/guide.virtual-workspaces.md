# 虚拟工作区 Virtual Workspaces

> 虚拟工作区（Virtual Workspaces）指**没有本地文件系统**的工作区：GitHub 仓库、远程仓库浏览、
> 内存文件系统（memfs）、设置同步等场景下，`workspaceFolders[].uri.scheme` 不是 `file`。
> 扩展必须声明自己在虚拟工作区下的能力，并且用 `vscode.workspace.fs` 代替 Node.js 的 `fs`。
> 官方指南：https://code.visualstudio.com/api/extension-guides/virtual-workspaces

## 核心约束

| 能力                     | 虚拟工作区           | 正确做法                                  |
| ------------------------ | -------------------- | ----------------------------------------- |
| 读写文件                 | 只能走 `workspace.fs` | 不要 `import fs from 'fs'`                |
| 同步文件 API             | ❌ 不可用             | 全部改为 `async` / `await`                |
| 进程 / 子进程            | ❌ 不可用             | 用扩展宿主内 API 替代                     |
| 终端 / 任务              | 视 provider 而定      | 用 `capabilities` 声明                   |
| 工作区路径拼接           | ✅ 可用               | `vscode.Uri.joinPath(folder.uri, name)`   |

> 判断是否虚拟工作区：`workspaceFolders.some(f => f.uri.scheme !== 'file')`。

## package.json 配置

```json
{
  "capabilities": {
    "virtualWorkspaces": {
      // true  = 完全支持（很少见，意味着不依赖任何本地文件系统特性）
      // false = 虚拟工作区下禁用整个扩展
      // "limited" = 部分支持，需要自己判断并降级
      "supported": "limited",
      "description": "支持虚拟工作区，但仅使用 vscode.workspace.fs 访问文件，不使用 Node.js 的 fs 模块。"
    }
  }
}
```

## extension.ts 实现

```typescript
import * as vscode from 'vscode';

const NOTES_FILE = 'demo8-notes.txt';

export function activate(context: vscode.ExtensionContext) {
	// 1. 通过 scheme 判断是否运行在虚拟工作区
	context.subscriptions.push(
		vscode.commands.registerCommand('demo8.showWorkspaceInfo', async () => {
			const folders = vscode.workspace.workspaceFolders;
			if (!folders || folders.length === 0) {
				await vscode.window.showInformationMessage('当前没有打开任何工作区文件夹。');
				return;
			}
			const info = folders.map((f) => `${f.name} (scheme: ${f.uri.scheme})`).join('\n');
			// file 表示本地磁盘；vscode-vfs / github / memfs 等即为虚拟工作区
			const isVirtual = folders.some((f) => f.uri.scheme !== 'file');
			await vscode.window.showInformationMessage(
				`${info}\n是否虚拟工作区：${isVirtual ? '是' : '否'}`
			);
		})
	);

	// 2. 统一使用 vscode.workspace.fs，本地与虚拟工作区都能工作
	context.subscriptions.push(
		vscode.commands.registerCommand('demo8.writeNotes', async () => {
			const folder = vscode.workspace.workspaceFolders?.[0];
			if (!folder) {
				await vscode.window.showWarningMessage('请先打开一个文件夹。');
				return;
			}

			const uri = vscode.Uri.joinPath(folder.uri, NOTES_FILE);

			// 写入：文本必须转成 Uint8Array
			const content = `写入时间：${new Date().toLocaleString()}\n`;
			await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));

			// 读取：返回 Uint8Array
			const bytes = await vscode.workspace.fs.readFile(uri);
			const text = Buffer.from(bytes).toString('utf8');

			await vscode.window.showInformationMessage(`已写入 ${NOTES_FILE}\n${text.trim()}`);
		})
	);
}
```

### workspace.fs 与 node fs 对照

| Node.js `fs`                     | `vscode.workspace.fs`                              |
| -------------------------------- | -------------------------------------------------- |
| `fs.readFileSync(p, 'utf8')`     | `await workspace.fs.readFile(uri)` → `Uint8Array`  |
| `fs.writeFileSync(p, s)`         | `await workspace.fs.writeFile(uri, Uint8Array)`    |
| `fs.existsSync(p)`               | `await workspace.fs.stat(uri)`（失败即不存在）     |
| `fs.readdirSync(p)`              | `await workspace.fs.readDirectory(uri)`            |
| `fs.mkdirSync(p, {recursive:true})` | `await workspace.fs.createDirectory(uri)`        |
| `fs.renameSync(a, b)`            | `await workspace.fs.rename(a, b, { overwrite })`   |
| `fs.rmSync(p)`                   | `await workspace.fs.delete(uri, { recursive })`    |

编码转换使用 `workspace.decode` / `workspace.encode`，或 Node 的 `Buffer`（Web 扩展用 `TextEncoder`）。

```typescript
// 更稳妥的文本读写
const text = await vscode.workspace.decode(await vscode.workspace.fs.readFile(uri));
await vscode.workspace.fs.writeFile(uri, await vscode.workspace.encode('新内容'));
```

## 验证

1. 用 VS Code 打开 `code/virtual-workspaces-demo`，按 `F5` 启动扩展开发宿主；
2. 命令面板执行 `Demo8 查看工作区信息` → 本地工作区显示 `scheme: file`；
3. 在扩展开发宿主里安装 GitHub Repositories 扩展，打开一个远程仓库
   （或直接在该工作区按 `F1` → `GitHub Repositories: Open Repository...`）；
4. 再次执行 `Demo8 查看工作区信息` → `scheme` 变为 `vscode-vfs`，`是否虚拟工作区：是`；
5. 执行 `Demo8 写入并读取笔记（workspace.fs）` → 仍能正常读写。

> 📷 待补充截图：`docs/images/virtual-workspaces-demo/scheme-info.png`

## workspaceContains 等激活事件

虚拟工作区下 `workspaceContains:` 会因为遍历文件而变慢甚至不可用，
优先使用 `onFileSystem:` / `onCommand:` / `onLanguage:` 等激活事件。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/virtual-workspaces-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/virtual-workspaces
https://code.visualstudio.com/api/extension-capabilities/common-capabilities#data-storage
https://code.visualstudio.com/api/references/vscode-api#FileSystem
```
