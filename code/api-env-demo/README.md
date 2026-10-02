# api-env-demo

`vscode.env` 命名空间示例，对应文档 [docs/api.env.md](../../docs/api.env.md)。

- 读取 `appName` / `appHost` / `uiKind` / `remoteName` / `shell` / `machineId` / `logLevel` 等；
- `clipboard.readText` / `writeText`；
- `asExternalUri` + `openExternal`（远程/Web 环境下打开外部链接的正确姿势）；
- `createTelemetryLogger` + `isTelemetryEnabled`（自动尊重用户的遥测设置）；
- `onDidChangeTelemetryEnabled` / `onDidChangeShell` / `onDidChangeLogLevel`。

## 调试

1. 用 VS Code 打开本目录，按 `F5` 启动扩展开发宿主；
2. 命令面板执行「DemoEnv 打印运行环境信息」，看「输出 → DemoEnv」；
3. 再试「DemoEnv 读写剪贴板」「DemoEnv 打开外部链接」「DemoEnv 发送一条遥测」；
4. 修改 `telemetry.telemetryLevel` 设置，观察遥测开关变化日志。
