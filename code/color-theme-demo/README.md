# color-theme-demo

Color Theme（彩色主题）示例，对应文档 [docs/guide.color-theme.md](../../docs/guide.color-theme.md)。

主题扩展是**纯配置扩展**：不需要 `main` / `extension.ts`，只贡献 `contributes.themes`，VS Code 在激活时直接读取主题文件。

## 调试

1. 用 VS Code 打开本目录；
2. 按 `F5` 启动扩展开发宿主；
3. `Ctrl+K Ctrl+T` 选择 `Demo4 Color Theme`。

## 打包

```bash
vsce package
```
