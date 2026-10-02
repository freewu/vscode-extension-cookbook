# webview-demo

Webview 示例，对应文档 [docs/guide.webview.md](../../docs/guide.webview.md)。

演示：`createWebviewPanel`、`enableScripts`、`localResourceRoots`、`asWebviewUri`、CSP + nonce、
`postMessage` 双向通信、`getState` / `setState` 状态持久化。

## 调试

1. 用 VS Code 打开本目录；
2. 按 `F5` 启动扩展开发宿主；
3. 命令面板执行 `Demo10 打开 Webview 面板`。

## 打包

```bash
vsce package
```
