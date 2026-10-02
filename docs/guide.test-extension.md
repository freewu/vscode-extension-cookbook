# Test Extension

> 扩展测试（Testing Extensions）用来验证扩展在**真实 VS Code 扩展宿主**中的行为：
> 命令是否注册、`vscode.*` API 调用是否正确、编辑器状态是否符合预期。
> 官方指南：https://code.visualstudio.com/api/working-with-extensions/testing-extension

## 工具链

| 组件                        | 作用                                             |
| --------------------------- | ------------------------------------------------ |
| `@vscode/test-cli`          | 官方 CLI，负责读配置、下载 VS Code、组织 Mocha   |
| `@vscode/test-electron`     | 下载并启动 Electron 版 VS Code（CI 常用）        |
| Mocha                       | 测试框架，提供 `suite` / `test` 全局函数         |
| `ms-vscode.extension-test-runner` | 在 Testing 视图里跑测试（可选）           |

> 注意：这不是「测试提供者（Test Provider）」。
> 如果你想**为用户的测试文件提供** Testing 视图支持，用的是 `vscode.tests` API（另一个话题）。

## 目录结构

```
test-extension-demo
├── .vscode-test.mjs               test-cli 配置
├── package.json                   测试脚本与依赖
├── src
│   ├── extension.ts               被测代码
│   └── test
│       └── extension.test.ts      测试用例
└── tsconfig.json                  输出到 out/，测试文件位于 out/test
```

## package.json 配置

```json
{
  "scripts": {
    "vscode:prepublish": "pnpm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    // 测试前先编译
    "pretest": "pnpm run compile",
    "test": "vscode-test"
  },
  "devDependencies": {
    "@types/vscode": "^1.120.0",
    "@types/node": "22.x",
    "@types/mocha": "^10.0.10",
    "typescript": "^5.9.3",
    "@vscode/test-cli": "^0.0.12",
    "@vscode/test-electron": "^2.5.2"
  }
}
```

> `pretest` 依赖 npm 的生命周期脚本；`pnpm` 需要在 `.npmrc` 里打开
> `enable-pre-post-scripts = true`（本仓库的 demo 都已配置）。

## .vscode-test.mjs

```javascript
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	// 必须指向**编译后**的 JS，而不是 TS 源码
	files: 'out/test/**/*.test.js',
});
```

常用配置项：

```javascript
export default defineConfig({
	files: 'out/test/**/*.test.js',
	version: 'stable',               // 或具体版本号，默认 stable
	workspaceFolder: './test-fixture', // 测试用的工作区目录
	mocha: { ui: 'tdd', timeout: 20000 },
	launchArgs: ['--disable-extensions'],
});
```

## 被测代码

```typescript
import * as vscode from 'vscode';

/** 纯函数：不依赖 VS Code API，可以在普通单元测试里直接断言 */
export function add(a: number, b: number): number {
	return a + b;
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('demo12.add', (a: number, b: number) => {
			const result = add(a, b);
			vscode.window.showInformationMessage(`${a} + ${b} = ${result}`);
			// 返回值会被 executeCommand 的 Promise 解析，方便测试断言
			return result;
		})
	);
}

export function deactivate() {}
```

## 测试用例

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import { add } from '../extension';

suite('demo12 扩展测试', () => {
	test('纯函数可以直接断言（不需要扩展宿主）', () => {
		assert.strictEqual(add(1, 2), 3);
		assert.strictEqual(add(-1, 1), 0);
	});

	test('命令已注册，且返回值可被 executeCommand 拿到', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('demo12.add'), 'demo12.add 未注册');

		const result = await vscode.commands.executeCommand<number>('demo12.add', 2, 40);
		assert.strictEqual(result, 42);
	});

	test('workspace.fs 可以读写临时文件', async () => {
		const folder = vscode.workspace.workspaceFolders?.[0];
		if (!folder) {
			return; // 无工作区时跳过，避免误报失败
		}
		const uri = vscode.Uri.joinPath(folder.uri, '.demo12-temp.txt');
		await vscode.workspace.fs.writeFile(uri, Buffer.from('hello', 'utf8'));
		const bytes = await vscode.workspace.fs.readFile(uri);
		assert.strictEqual(Buffer.from(bytes).toString('utf8'), 'hello');
		await vscode.workspace.fs.delete(uri);
	});
});
```

测试分层建议：

| 层次         | 依赖           | 示例                         |
| ------------ | -------------- | ---------------------------- |
| 纯单元测试   | 无             | `add(1, 2)`、解析函数        |
| 宿主内测试   | 扩展宿主       | 命令注册、`workspace` 状态   |
| 端到端       | 真实文件工作区 | 打开文件、执行重构、断言编辑 |

> 能用纯函数测的逻辑就别放进宿主测试，宿主测试启动一次要几秒钟。

## 运行测试

```bash
pnpm install
pnpm test          # = vscode-test
```

首次运行会下载对应版本的 VS Code，比较慢。

调试测试：

- VS Code 中打开 **Testing** 视图（活动栏烧瓶图标），前提是安装了 `ms-vscode.extension-test-runner`；
- 也可以在 `.vscode/launch.json` 里加一个 `"type": "extensionHost"` + `"--extensionTestsPath"` 的配置手动单步调试。

## CI

Linux 上 Electron 需要虚拟显示器：

```yaml
# GitHub Actions 片段
- run: xvfb-run -a pnpm test
  if: runner.os == 'Linux'
- run: pnpm test
  if: runner.os != 'Linux'
```

## 常见坑

- **找不到测试**：`.vscode-test.mjs` 里 `files` 指向了 `src/test/**` 而不是编译产物 `out/test/**`；
- **`suite is not defined`**：缺 `@types/mocha`，或 `mocha.ui` 配置与写法不匹配（`suite`/`test` 对应 `tdd`）；
- **`test` 脚本没触发编译**：`pretest` 被 pnpm 默认忽略，需在 `.npmrc` 打开 `enable-pre-post-scripts`；
- **测试通过但功能是坏的**：宿主测试默认不激活扩展命令之外的能力，记得用 `executeCommand` 走真实路径；
- **CI 挂起**：Linux 忘了 `xvfb-run`。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/test-extension-demo

## 资料
```markdown
https://code.visualstudio.com/api/working-with-extensions/testing-extension
https://github.com/microsoft/vscode-test-cli
https://github.com/microsoft/vscode-extension-samples/tree/main/helloworld-test-sample
https://mochajs.org/
```
