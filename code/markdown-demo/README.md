# markdown-demo

Markdown 扩展示例，对应文档 [docs/guide.markdown.md](../../docs/guide.markdown.md)。

演示通过 `contributes.markdown.markdownItPlugins` 拿到 markdown-it 实例，然后：

1. 新增行内语法 `==高亮==` → `<mark>`；
2. 用 core 规则给外链加 `target="_blank"`；
3. 通过 `contributes.markdown.previewStyles` 注入预览样式。

## 调试

1. 用 VS Code 打开本目录；
2. 按 `F5` 启动扩展开发宿主；
3. 新建一个 `.md` 文件，输入 `这是 ==高亮== 文本`，按 `Ctrl+Shift+V` 打开预览。

## 打包

```bash
vsce package
```
