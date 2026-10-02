# custom-data-demo

自定义数据 Custom Data 示例，对应文档 [docs/guide.custom-data.md](../../docs/guide.custom-data.md)。

**纯声明式扩展，没有任何代码**（没有 `main`），仅通过两个贡献点扩展 VS Code 内置的 HTML / CSS 语言能力：

```json
"contributes": {
  "html": { "customData": ["./data/html.html-data.json"] },
  "css": { "customData": ["./data/css.css-data.json"] }
}
```

## 调试

1. 用 VS Code 打开本目录，按 `F5` 启动扩展开发宿主；
2. 在扩展宿主里打开 `samples/demo.html`，输入 `<demo-` 观察补全；
3. 打开 `samples/demo.css`，输入 `--demo-`、`@demo-`、`:demo-` 观察补全。
