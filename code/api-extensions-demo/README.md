# api-extensions-demo

`vscode.extensions` 命名空间示例，对应文档 [docs/api.extensions.md](../../docs/api.extensions.md)。

- `extensions.all` → 列出所有已安装扩展（**不会**触发激活）；
- `getExtension(id)` → 按 `publisher.name` 取扩展；
- `Extension.activate()` → 按需激活并读取它导出的 API；
- `extensions.onDidChange` → 监听扩展列表变化；
- 读取 `packageJSON` / `extensionPath` / `isActive` / `extensionKind`。

## 调试

1. 用 VS Code 打开本目录，按 `F5` 启动扩展开发宿主；
2. 命令面板执行「DemoExt 列出所有扩展并激活选中的」；
3. 选一个未激活的扩展，观察提示里的导出 API，以及调试控制台。
