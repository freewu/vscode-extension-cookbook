# task-provider-demo

任务提供者 Task Provider 示例，对应文档 [docs/guide.task-provider.md](../../docs/guide.task-provider.md)。

用 `tasks.registerTaskProvider('demo15', ...)` 提供 4 个任务，分别演示
`ShellExecution` / `ProcessExecution` / `CustomExecution`（Pseudoterminal）以及 `resolveTask`。

## 调试

1. 用 VS Code 打开本目录，按 `F5` 启动扩展开发宿主；
2. 命令面板执行 `Terminal: Run Task`，选择 `demo15` 下的任务；
3. 或执行 `Demo15 选择并运行任务`。
