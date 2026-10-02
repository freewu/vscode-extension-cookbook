# api-authentication-demo

`vscode.authentication` 命名空间示例，对应文档 [docs/api.authentication.md](../../docs/api.authentication.md)。

实现一个"假"的认证提供者，演示完整的会话生命周期：

- `registerAuthenticationProvider('demoAuth', ...)` → 注册提供者，出现在「账户」菜单；
- `getSession(providerId, scopes, { createIfNone: true })` → 触发授权弹窗并创建会话；
- `getAccounts` / `getSession(..., { silent: true })` → 静默读取登录态；
- `removeSession` + fire `onDidChangeSessions` → 退出登录并刷新 UI；
- 会话持久化到 `context.secrets`（加密存储）。

## 调试

1. 用 VS Code 打开本目录，按 `F5` 启动扩展开发宿主；
2. 命令面板执行「DemoAuth 登录（创建会话）」→ 同意授权；
3. 左下角「账户」菜单可以看到 `Demo 认证 / Demo 用户`；
4. 执行「DemoAuth 显示已有账号」「DemoAuth 退出登录」。
