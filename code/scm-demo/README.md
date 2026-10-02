# scm-demo

源代码管理 Source Control 示例，对应文档 [docs/guide.source-control.md](../../docs/guide.source-control.md)。

用 `scm.createSourceControl` 创建一个假版本控制提供者：

- `inputBox` + `acceptInputCommand` → 输入提交信息后"提交快照"；
- `createResourceGroup` + `SourceControlResourceState` → 列出与快照不同的文件；
- `quickDiffProvider` + `demo16-original:` 虚拟文档 → 编辑器左侧 diff 边栏；
- `scm/title`、`scm/resourceState/context` 菜单贡献。

## 调试

1. 用 VS Code 打开本目录，按 `F5` 启动扩展开发宿主；
2. 在扩展宿主里打开任意文件夹，活动栏点击 `Demo16 版本控制`；
3. 输入提交信息并回车 → 变更列表清空；再改任意文件并保存 → 重新出现变更。
