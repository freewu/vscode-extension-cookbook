# l10n 相关 API

> `vscode.l10n` 用来做**运行时本地化（localization）**：把扩展里的用户可见文案交给
> VS Code 的语言包机制。它和 `package.nls.*.json`（清单本地化）配合，覆盖
> **命令标题、配置描述**与**代码里拼出来的提示**两类文本。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#l10n
> 官方指南：https://code.visualstudio.com/api/extension-guides/localization（含 `@vscode/l10n-dev` 工具链）

## 全局变量 Variables

| 成员     | 类型                                  | 说明                                                       |
| -------- | ------------------------------------- | ---------------------------------------------------------- |
| `bundle` | `{ [key: string]: string } \| undefined` | 当前生效的语言包内容；没有本地化时为 `undefined`        |
| `uri`    | `Uri \| undefined`                    | 当前生效的语言包文件位置；同上                           |

## 方法 Functions

`t` 有三种重载：

| 形式                                       | 示例                                            |
| ------------------------------------------ | ----------------------------------------------- |
| 位置占位符                                  | `l10n.t('Hello {0}!', name)`                    |
| 具名占位符（`Record`）                      | `l10n.t('Found {count} items', { count: 3 })`    |
| 带 `comment` 的对象形式                     | `l10n.t({ message: 'Hi {0}', args: [name], comment: ['{0} is a name'] })` |

`comment` 会写进生成的 bundle，帮助译者理解上下文（尤其在占位符含义不明确时）。

## 目录结构与配置

```
api-l10n-demo
├── package.json                  "l10n": "./l10n"
├── package.nls.json              清单文案的英文原文（%key% 的默认值）
├── package.nls.zh-cn.json        清单文案的中文翻译
├── l10n
│   └── bundle.l10n.zh-cn.json    运行时文案的翻译
└── src/extension.ts
```

```jsonc
// package.json
{
  "l10n": "./l10n",
  "contributes": {
    "commands": [
      // %key% 会去 package.nls.json / package.nls.<locale>.json 里查表
      { "command": "demoL10n.hello", "title": "%demoL10n.hello.title%" }
    ]
  }
}
```

```json
// package.nls.json（英文基准）
{ "demoL10n.hello.title": "DemoL10n Say hello" }
```

```json
// package.nls.zh-cn.json（中文）
{ "demoL10n.hello.title": "DemoL10n 打个招呼" }
```

```json
// l10n/bundle.l10n.zh-cn.json（运行时文案，key 就是源码里的原文）
{
  "Please enter your name": "请输入你的名字",
  "Hello {0}, welcome to the demo!": "你好 {0}，欢迎使用本示例！",
  "Found {count} installed extensions": "共发现 {count} 个已安装扩展"
}
```

## 代码写法

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('demoL10n.hello', async () => {
			const name = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Please enter your name'),
			});
			if (!name) {
				return;
			}
			void vscode.window.showInformationMessage(vscode.l10n.t('Hello {0}, welcome to the demo!', name));
		}),

		vscode.commands.registerCommand('demoL10n.survey', () => {
			// 具名占位符
			const message = vscode.l10n.t('Found {count} installed extensions', {
				count: vscode.extensions.all.length,
			});
			// 带 comment：给译者上下文
			const hint = vscode.l10n.t({
				message: 'Translation bundle: {state}',
				args: { state: vscode.l10n.bundle ? 'loaded' : 'not loaded' },
				comment: ['{state} is either "loaded" or "not loaded"'],
			});
			void vscode.window.showInformationMessage(`${message}｜${hint}`);
		})
	);

	console.log('bundle =', vscode.l10n.bundle, 'uri =', vscode.l10n.uri?.toString());
}
```

## 生成译文骨架

官方提供 `@vscode/l10n-dev` 做静态扫描：

```bash
# 扫描源码里的 l10n.t(...) 生成 bundle.l10n.json
npx @vscode/l10n-dev export --outDir ./l10n ./src

# 用已有 bundle + 翻译结果生成 package.nls.*.json
npx @vscode/l10n-dev generate-nls --outDir ./l10n ./package.json ./l10n/bundle.l10n.json
```

需要本地化 `package.json` 时，可以在 `package.json` 里写 `"l10n"` 并运行
`vscode-nls-dev` 的 `create-nls`/`generate-nls`（旧工具链）或直接用上面的新工具。

## 效果验证

1. `F5` 启动扩展开发宿主（这时界面语言是英文）→ 命令标题为 `DemoL10n Say hello`；
2. 关闭宿主，把 VS Code 显示语言切成「中文(简体)」后重新启动宿主；
3. 命令标题变成「DemoL10n 打个招呼」，提示与输入框文案也都变成中文；
4. 调试控制台里 `l10n.bundle` 不再为 `undefined`。

> 📷 待补充截图：`docs/images/api-l10n/zh-cn-command.png`

## 常见坑

- **`l10n.t` 返回原文**：`package.json` 里漏了 `"l10n": "./l10n"`，或界面语言与
  `bundle.l10n.<locale>.json` 的 locale 不匹配（`zh-cn` 不等于 `zh-CN` 的写法差异要注意大小写规范）；
- **`bundle.l10n.json`（无 locale）**：那是英文基准，放在 `l10n/` 下即可，别指望它是译文；
- **运行时文案改了就失效**：bundle 的 key 是**源码里的原文**，改了源码里的英文就得同步改所有译文 key；
- **在 `deactivate` 里用 `l10n.t`**：卸载阶段 bundle 可能已经不可用；
- **`package.nls.json` 的 key 必须以 `%...%` 在清单里被引用**，否则不会生效；
- **Web 扩展**：l10n 也依赖 `l10n` 目录被打包进 vsix，检查 `.vscodeignore` 没有误排除。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/api-l10n-demo

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#l10n
https://code.visualstudio.com/api/extension-guides/localization
https://github.com/microsoft/vscode-l10n
https://github.com/microsoft/vscode-extension-samples/tree/main/l10n-sample
```
