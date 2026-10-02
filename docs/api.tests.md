# tests 相关 API

> `vscode.tests` 是**测试提供者（Testing API）**的入口：把你的测试框架结果"接进"
> VS Code 内置的「测试」视图，从而获得树形展示、单条重跑、调试、覆盖率等 UI 能力。
>
> ⚠️ 别和**测试自己的扩展**搞混：后者用 `@vscode/test-cli` / `@vscode/test-electron`
> 在扩展宿主里跑 Mocha，见 [扩展测试 Test Extension](./guide.test-extension.md)。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#tests
> 官方指南：https://code.visualstudio.com/api/extension-guides/testing

## 方法 Functions

| 成员                   | 签名                                                     | 说明                                     |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------- |
| `createTestController` | `(id: string, label: string) => TestController`          | 创建一个测试控制器，会出现在「测试」视图 |

## TestController

| 成员                          | 说明                                                                 |
| ----------------------------- | -------------------------------------------------------------------- |
| `id` / `label`                | 标识（`id` 建议加扩展名前缀，用于 when 子句）                        |
| `items`                       | 根 `TestItemCollection`，往里 `add` 你的测试树                       |
| `createTestItem(id, label, uri?)` | 创建测试项；有 `uri` 时点击能跳到对应文件                        |
| `createRunProfile(label, kind, runHandler, isDefault?, tag?, supportsContinuousRun?)` | 注册一种运行方式；`kind` 为 `Run` / `Debug` / `Coverage` |
| `createTestRun(request, name?, persist?)` | 手动创建一次运行（`runHandler` 内部通常用它）             |
| `resolveHandler`              | 惰性加载子节点的钩子（配 `TestItem.canResolveChildren = true`）      |
| `refreshHandler`              | 用户点「刷新」时调用                                                 |
| `invalidateTestResults(items?)` | 清空旧的测试结果，触发视图重新计算统计                             |
| `dispose()`                   | 注销该控制器（视图里的节点随之消失）                                 |

## TestItem / TestItemCollection

| `TestItem` 成员        | 说明                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `id` / `label`         | 唯一 id 与显示名                                            |
| `uri` / `range`        | 源码位置（**有 uri 才能点击跳转、才能显示 gutter 状态**）   |
| `children`             | 子项集合（`add` / `replace` / `delete` / `get` / `forEach`）|
| `canResolveChildren`   | 为 `true` 时展开才调用 `resolveHandler`（大树必备）         |
| `busy`                 | 显示转圈                                                    |
| `tags`                 | `TestTag`，受影响测试可标记 `TestTag.affected`              |
| `error` / `description` / `sortText` | 附加展示信息                                   |

## TestRun

```typescript
const run = controller.createTestRun(request);
run.enqueued(item);            // 排队中
run.started(item);             // 开始
run.passed(item, 12);          // 通过（耗时 ms）
run.failed(item, new vscode.TestMessage('断言失败'), 8);
run.skipped(item);
run.appendOutput('日志行\r\n', undefined, item);  // 输出到"测试输出"面板
run.addCoverage(fileCoverage);                    // 覆盖率
run.end();                                        // 必须调用，否则一直"运行中"
```

`request: TestRunRequest` 里带 `include` / `exclude`（用户可能只点了某个节点的运行按钮），
`runHandler` 应当据此裁剪要跑的范围；`request.continuous` 表示这是"持续运行"模式。

## 最小完整示例

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const controller = vscode.tests.createTestController('demoTests', 'Demo 测试');
	context.subscriptions.push(controller);

	// 1) 构建测试树
	const suite = controller.createTestItem('suite', '示例套件');
	suite.canResolveChildren = true; // 展开时才生成子项
	controller.items.add(suite);

	controller.resolveHandler = async (item) => {
		if (item !== suite) {
			return; // item 为 undefined 时表示"初始化整棵树"
		}
		suite.children.add(controller.createTestItem('case-1', '用例 1'));
		suite.children.add(controller.createTestItem('case-2', '用例 2'));
	};

	// 2) 注册运行方式
	controller.createRunProfile('运行', vscode.TestRunProfileKind.Run, async (request, token) => {
		const run = controller.createTestRun(request);
		const queue = request.include ?? collect(suite);

		for (const test of queue) {
			run.started(test);
			await new Promise((r) => setTimeout(r, 200));
			if (token.isCancellationRequested) {
				run.skipped(test);
				continue;
			}
			if (test.label.endsWith('2')) {
				run.failed(test, new vscode.TestMessage('模拟失败'));
			} else {
				run.passed(test);
			}
		}
		run.end();
	}, true);
}

function collect(item: vscode.TestItem): vscode.TestItem[] {
	const all: vscode.TestItem[] = [];
	item.children.forEach((child) => all.push(...(child.children.size ? collect(child) : [child])));
	return all;
}
```

## 贡献点

```jsonc
{
  "contributes": {
    "commands": [
      { "command": "demoTests.runAll", "title": "Demo 运行全部测试" }
    ],
    "menus": {
      // 测试视图标题 / 测试项的右键菜单
      "testing/item/context": [{ "command": "demoTests.reveal", "group": "inline" }]
    }
  }
}
```

需要跳到源码时，记得给 `TestItem` 设 `uri`（可选 `range`），
并用 `commands.executeCommand('vscode.open', uri, { selection: range })` 打开。

## 效果验证

1. `F5` 启动扩展开发宿主；
2. 活动栏出现「测试」图标，展开 `Demo 测试 → 示例套件`；
3. 点「运行」→ 用例 1 通过、用例 2 失败（红色，点击显示 `TestMessage`）；
4. 点「调试」→ 进入测试调试会话；
5. 点「刷新」→ 触发 `refreshHandler`。

> 📷 待补充截图：`docs/images/api-tests/testing-view.png`

## 常见坑

- **测视图里节点一直转圈**：`TestRun.end()` 没调用，或某条用例既没 `passed` 也没 `failed`；
- **点「运行」跑的是全部用例**：忽略了 `request.include`；
- **大树卡顿**：一次性 `add` 上万个节点；应设 `canResolveChildren = true` 惰性加载；
- **用例点不开源码**：`TestItem.uri` 未设置；
- **控制器不 dispose**：扩展停用后视图残留，注意 `context.subscriptions.push(controller)`；
- **调试运行方式需要 `Debug` 的 profile**：只注册 `Run` 时「调试测试」按钮不可用；
- **`TestTag` 的 `affected` 语义**：只跑被影响的测试需要配合 `runProfile.tag`。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/test-extension-demo

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#tests
https://code.visualstudio.com/api/extension-guides/testing
https://code.visualstudio.com/api/references/vscode-api#TestController
https://github.com/microsoft/vscode-extension-samples/tree/main/testing-sample
```
