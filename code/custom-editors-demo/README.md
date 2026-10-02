# custom-editors-demo

自定义编辑器 Custom Editor 示例，对应文档 [docs/guide.custom-editors.md](../../docs/guide.custom-editors.md)。

用 `CustomTextEditorProvider` 为 `*.cat` 文件提供 JSON 表单/文本框编辑能力，并演示
`WorkspaceEdit` 回写（保留脏标记、撤销、保存）。

## 调试

1. 用 VS Code 打开本目录，按 `F5` 启动扩展开发宿主；
2. 命令面板执行 `Demo13 创建示例 .cat 文件`；
3. 编辑内容 → 点「应用」→ 标签页出现脏标记 → `Ctrl+S` 保存、`Ctrl+Z` 撤销。
