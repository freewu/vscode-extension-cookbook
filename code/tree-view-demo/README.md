# tree-view-demo

树视图 Tree View 示例，对应文档 [docs/guide.tree-view.md](../../docs/guide.tree-view.md)。

在活动栏新增一个「Demo9 Tree View」容器，用 `TreeDataProvider` + `workspace.fs` 递归列出工作区文件，
并演示刷新按钮、图标、`contextValue` 右键菜单、选中项事件。

## 调试

1. 用 VS Code 打开本目录；
2. 按 `F5` 启动扩展开发宿主；
3. 需要打开一个文件夹（工作区），左侧活动栏点击 Demo9 图标。

## 打包

```bash
vsce package
```
