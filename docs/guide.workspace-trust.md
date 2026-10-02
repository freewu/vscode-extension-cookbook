# 工作区信任 Workspace Trust

> 工作区信任（Workspace Trust）让用户在打开**不受信任的代码仓库**时进入「限制模式（Restricted Mode）」，
> 扩展必须声明自己在受限模式下的能力，并在执行敏感操作前显式判断信任状态。
> 官方指南：https://code.visualstudio.com/api/extension-guides/workspace-trust

## 为什么需要

打开陌生仓库时，代码可能带有恶意的构建脚本或任务配置。VS Code 的做法是：

1. 默认以**限制模式**打开未授权的工作区；
2. 扩展通过 `capabilities.untrustedWorkspaces` 声明受限模式下的行为；
3. 敏感操作（执行脚本、下载、读写敏感配置）必须自己判断 `workspace.isTrusted`。

## package.json 配置

```json
{
  "capabilities": {
    "untrustedWorkspaces": {
      // true  = 全功能可用（不推荐用于会执行代码的扩展）
      // false = 受限模式下直接禁用整个扩展
      // "limited" = 禁用部分功能，需要自己判断 isTrusted
      "supported": "limited",
      // 展示给用户的说明
      "description": "受限模式下仅提供只读功能，执行脚本需要先信任工作区。",
      // 受限模式下禁止读写的配置项
      "restrictedConfigurations": ["demo7.secretToken"]
    }
  }
}
```

> `supported: "limited"` 时可以额外提供 `restrictedConfigurations`，
> 列在这里的配置项在受限模式下**不会从用户设置读取**（防止泄漏 token 等敏感值）。

## extension.ts 实现

```typescript
import * as vscode from 'vscode';

const CONFIG_SECTION = 'demo7';

export function activate(context: vscode.ExtensionContext) {
	// 1. 读取当前工作区的信任状态
	context.subscriptions.push(
		vscode.commands.registerCommand('demo7.showTrustStatus', async () => {
			const status = vscode.workspace.isTrusted ? '已信任（trusted）' : '受限模式（restricted）';
			await vscode.window.showInformationMessage(`工作区状态：${status}`);
		})
	);

	// 2. 敏感操作必须显式判断 isTrusted
	context.subscriptions.push(
		vscode.commands.registerCommand('demo7.runScript', async () => {
			if (!vscode.workspace.isTrusted) {
				await vscode.window.showWarningMessage(
					'执行脚本需要信任工作区。请点击窗口顶部的「限制模式」横幅，' +
					'或执行 “Workspaces: Manage Workspace Trust” 完成授权。'
				);
				return;
			}
			await vscode.window.showInformationMessage('正在执行脚本……（受信任代码路径）');
		})
	);

	// 3. 监听信任状态变化：用户点击“信任”后启用完整功能
	context.subscriptions.push(
		vscode.workspace.onDidGrantWorkspaceTrust(() => {
			console.log('[demo7] 工作区已被信任，启动完整功能');
		})
	);
}

export function deactivate() {}
```

### 相关 API

| API                                              | 说明                                             |
| ------------------------------------------------ | ------------------------------------------------ |
| `workspace.isTrusted`                            | 当前工作区是否已信任                             |
| `workspace.onDidGrantWorkspaceTrust`             | 工作区被信任时触发的事件                         |
| `workspace.workspaceFolders`                     | 受限模式下只读，仍可读取                         |
| `env.appHost`                                    | 结合它判断是否在桌面端/Web 端                     |

> 本项目使用的 `@types/vscode@1.120.0` 中**没有**“以编程方式请求信任”的 API（仅有 `isTrusted` 与 `onDidGrantWorkspaceTrust`）。
> 扩展只能提示用户，由用户在窗口顶部「限制模式」横幅或 `Workspaces: Manage Workspace Trust` 命令中完成授权。

## 验证

1. 用 VS Code 打开 `code/workspace-trust-demo` 之外的任意目录，按 `F5` 启动扩展开发宿主；
2. 命令面板执行 `Demo7 查看工作区信任状态` → 观察是「已信任」还是「受限模式」；
3. 点击顶部「限制模式」横幅 → 选择「信任」；
4. 再次执行 `Demo7 查看工作区信任状态`，状态变为「已信任」，输出面板可见 `onDidGrantWorkspaceTrust` 日志。

> 也可以命令面板执行 `Workspaces: Manage Workspace Trust` 手动切换状态。

> 📷 待补充截图：`docs/images/workspace-trust-demo/restricted-mode-banner.png`

## 最佳实践

- 只在真正需要时判断 `isTrusted`，不要一开始就整体禁用扩展；
- 受限模式下**仍然提供**只读能力（浏览、预览、语法分析），只在“执行/写入/联网”时拦一道；
- 敏感配置一律放进 `restrictedConfigurations`；
- 不要把 `isTrusted` 缓存在模块级变量里——信任状态可以在运行中变化，请使用事件。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/workspace-trust-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/workspace-trust
https://code.visualstudio.com/docs/editor/workspace-trust
https://code.visualstudio.com/api/references/vscode-api#workspace.isTrusted
```
