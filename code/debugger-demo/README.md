# debugger-demo

调试器扩展 Debugger Extension 示例，对应文档
[docs/guide.debugger-extension.md](../../docs/guide.debugger-extension.md)。

用 `DebugAdapterInlineImplementation` 在扩展宿主内实现一个最小 DAP 适配器（`mock/demo.js` 不会被真的执行）：

- 处理 `initialize` / `launch` / `setBreakpoints` / `configurationDone` 握手；
- 命中"断点"后会话进入 stopped 状态，可查看调用栈与变量；
- 支持继续/单步，然后发送 `exited` + `terminated` 结束会话；
- 附带 `DebugAdapterTracker` 打印全部 DAP 消息。

## 调试

1. 用 VS Code 打开本目录，按 `F5` 启动扩展开发宿主；
2. 在扩展宿主里按 `F5` → 选择 `Demo17: Mock 调试`；
3. 查看「运行和调试」视图的调用栈、变量；在 `mock/demo.js` 里打断点再试一次。
