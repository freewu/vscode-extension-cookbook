# api-languages-demo

`vscode.languages` 命名空间示例，对应文档 [docs/api.languages.md](../../docs/api.languages.md)。

对 `plaintext` 语言提供一整套语言特性：

- `registerHoverProvider` → 鼠标悬停在 `TODO` 上显示带命令链接的卡片；
- `registerCompletionItemProvider` → 输入 `.` 时提示 `console.log` 代码片段；
- `createDiagnosticCollection` → 把 `FIXME` 标成警告，显示在「问题」面板；
- `createLanguageStatusItem` → 状态栏语言区域的 `DemoLang` 状态项；
- `onDidChangeDiagnostics` / `getLanguages` / `getDiagnostics`。

## 调试

1. 用 VS Code 打开本目录，按 `F5` 启动扩展开发宿主；
2. 在扩展宿主里新建一个 `.txt` 文件（语言为 Plain Text）；
3. 输入 `TODO` 并悬停；输入 `FIXME` 看「问题」面板；输入 `.` 看补全；
4. 命令面板执行「DemoLang 统计 VS Code 支持的语言数量」。
