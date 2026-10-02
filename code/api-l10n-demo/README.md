# api-l10n-demo

`vscode.l10n` 命名空间示例，对应文档 [docs/api.l10n.md](../../docs/api.l10n.md)。

- `package.nls.json` / `package.nls.zh-cn.json` → 清单文案本地化（`%key%`）；
- `l10n/bundle.l10n.zh-cn.json` → 运行时文案本地化；
- `l10n.t(...)` 的三种重载：位置占位符 `{0}`、具名占位符 `{count}`、带 `comment` 的对象形式；
- 读取 `l10n.bundle` / `l10n.uri` 判断当前是否加载了语言包。

## 调试

1. 用 VS Code 打开本目录，按 `F5` 启动扩展开发宿主（界面语言为英文时）→ 命令标题是英文；
2. 关闭宿主，用命令面板执行 `Configure Display Language` 切换到「中文(简体)」；
3. 重新按 `F5` → 命令标题、提示、输入框都变成中文；
4. 调试控制台查看 `l10n.bundle` 与 `l10n.uri`。
