# test-extension-demo

扩展测试 Test Extension 示例，对应文档 [docs/guide.test-extension.md](../../docs/guide.test-extension.md)。

使用官方推荐的 `@vscode/test-cli` + `@vscode/test-electron` + Mocha：

- `src/test/extension.test.ts` 是测试入口，编译后位于 `out/test/**/*.test.js`；
- `.vscode-test.mjs` 指定测试文件 glob；
- 测试运行在真实的扩展宿主中，因此可以调用 `vscode.*` API。

## 运行测试

```bash
pnpm install
pnpm test
```

`pnpm test` 会自动先执行 `pretest`（编译），再启动 `vscode-test`。

## 调试测试

VS Code 中打开「测试」视图（Testing），或使用扩展 `ms-vscode.extension-test-runner`。
