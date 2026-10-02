# virtual-documents-demo

虚拟文档 Virtual Documents 示例，对应文档 [docs/guide.virtual-documents.md](../../docs/guide.virtual-documents.md)。

用 `workspace.registerTextDocumentContentProvider` 注册 `demo14://` scheme，
内容由扩展在内存中生成，并通过 `onDidChange` 触发刷新。

## 调试

1. 用 VS Code 打开本目录，按 `F5` 启动扩展开发宿主；
2. 命令面板执行 `Demo14 打开虚拟文档`；
3. 再执行 `Demo14 刷新虚拟文档` → 文档里的「版本」递增。
