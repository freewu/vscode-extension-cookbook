# extensions 相关 API

> `vscode.extensions` 用来**枚举、查询、按需激活**其它扩展，并读取它们的元数据（`packageJSON`）。
> 典型场景：依赖另一个扩展提供的 API、插件式架构、写"扩展管理器"类工具。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#extensions

## 全局变量 Variables

| 成员          | 类型                          | 说明                                                                 |
| ------------- | ----------------------------- | -------------------------------------------------------------------- |
| `all`         | `readonly Extension<any>[]`   | **已安装**的全部扩展（含内置扩展）；读它**不会**触发激活             |
| `onDidChange` | `Event<void>`                 | 扩展被安装/卸载/启用/禁用时触发，之后应重新读取 `all`                |

## 方法 Functions

| 成员                    | 签名                                        | 说明                                            |
| ----------------------- | ------------------------------------------- | ----------------------------------------------- |
| `getExtension`          | `<T>(id: string) => Extension<T> \| undefined` | 按 `publisher.name` 取扩展；不存在返回 `undefined` |

## Extension 对象

| 成员             | 类型                        | 说明                                                                 |
| ---------------- | --------------------------- | -------------------------------------------------------------------- |
| `id`             | `string`                    | `publisher.name`，如 `ms-python.python`                              |
| `extensionPath`  | `string`                    | 扩展根目录的**绝对路径**（打包后是只读的，别往这里写文件）           |
| `isActive`       | `boolean`                   | 是否已激活；用它可以避免重复 `activate()`                            |
| `packageJSON`    | `any`                       | 该扩展 `package.json` 的内容（`contributes`、`version` 等）          |
| `extensionKind`  | `ExtensionKind`             | `UI`（本地）还是 `Workspace`（远程）运行                             |
| `exports`        | `T`                         | 激活后由 `activate()` 返回的"导出 API"                              |
| `activate()`     | `Thenable<T>`               | **按需激活**该扩展并返回其 exports；已激活则直接返回缓存值           |

## 示例：枚举 + 按需激活

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('demoExt.list', async () => {
			// 只有 id / 元数据，不激活
			const all = vscode.extensions.all;

			const picked = await vscode.window.showQuickPick(
				all.map((e) => ({
					label: e.id,
					description: e.packageJSON.version,
					detail: e.isActive ? '已激活' : '未激活',
					extension: e,
				})),
				{ placeHolder: `共 ${all.length} 个扩展` }
			);
			if (!picked) {
				return;
			}

			// 显式激活，并拿到它导出的 API
			const exported = await picked.extension.activate();
			void vscode.window.showInformationMessage(
				`${picked.extension.id} 已激活；导出：${Object.keys(exported ?? {}).join('、') || '(无)'}`
			);
		}),

		vscode.extensions.onDidChange(() => {
			console.log('扩展列表变化，当前共', vscode.extensions.all.length, '个');
		})
	);
}
```

## 依赖另一个扩展的 API

```typescript
const ext = vscode.extensions.getExtension<MyApi>('some.publisher.someExt');
if (!ext) {
	void vscode.window.showErrorMessage('请先安装 SomeExt');
	return;
}
const api: MyApi = ext.isActive ? ext.exports : await ext.activate();
api.doSomething();
```

跨扩展调用建议：

- 用 `extensionDependencies`（强依赖，会一起安装）或 `extensionPack`（推荐组合）声明关系；
- 让被依赖方导出一个**带版本号的 API 对象**（如 `{ version: 1, ... }`），便于兼容处理；
- 调用方对 `exports` 做运行时判空，不要假设对方已升级。

## 效果验证

1. `F5` 启动扩展开发宿主；
2. 执行「DemoExt 列出所有扩展并激活选中的」，选一个未激活的扩展看是否变为「已激活」；
3. 观察调试控制台里打印的 `packageJSON`。

> 📷 待补充截图：`docs/images/api-extensions/list.png`

## 常见坑

- **`getExtension` 要写全 id**：只有 `name` 找不到；开发模式下 publisher 常是
  `undefined_publisher`（本 demo 因此用 `packageJSON.name` 兜底匹配自己）；
- **不要滥用 `extensions.all` 并逐个激活**：会把启动时间拖垮，激活应当是"按需"的；
- **`extensionPath` 只读**：安装目录在 Windows/macOS 上可能没有写权限，
  要存数据用 `context.globalStorageUri` / `workspaceState` / `secrets`；
- **`isActive` 不代表"能用"**：扩展可能激活失败（抛错），此时 `exports` 是 `undefined`；
- **`onDidChange` 触发很频繁**：内部要重新读 `all` 并刷新缓存，别在里面做重活；
- **内置扩展也在 `all` 里**：如需过滤可以用 `extension.packageJSON.isBuiltin` 等字段。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/api-extensions-demo

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#extensions
https://code.visualstudio.com/api/references/vscode-api#Extension
https://code.visualstudio.com/api/references/extension-manifest
https://code.visualstudio.com/api/working-with-extensions/publishing-extension
```
