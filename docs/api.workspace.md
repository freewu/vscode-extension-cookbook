# workspace 相关 API

> `vscode.workspace` 是**工作区与文档**的入口：文件读写、配置、监听、虚拟文件系统、
> 文档内容提供者都在这里。它是所有命名空间里成员最多、也最容易踩坑的一个。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#workspace
> 相关指南：[虚拟工作区](./guide.virtual-workspaces.md)、[工作区信任](./guide.workspace-trust.md)、
> [虚拟文档](./guide.virtual-documents.md)、[设置 Settings](./demo.settings.md)

## 全局变量 Variables

| 成员                       | 类型                                | 说明                                                        |
| -------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| `fs`                       | `FileSystem`                        | 支持远程/虚拟文件系统的读写 API（**推荐**替代 `node:fs`）   |
| `workspaceFolders`         | `readonly WorkspaceFolder[] \| undefined` | 当前打开的所有工作区文件夹；无工作区时是 `undefined`  |
| `name`                     | `string \| undefined`               | 工作区名字（多根工作区下由 `.code-workspace` 决定）         |
| `workspaceFile`            | `Uri \| undefined`                  | 多根工作区的 `.code-workspace` 文件；单文件夹时为 `undefined` |
| `rootPath`                 | `string \| undefined`               | ⚠️ 已废弃，用 `workspaceFolders[0].uri`                      |
| `textDocuments`            | `readonly TextDocument[]`           | 所有已打开的文本文件                                        |
| `notebookDocuments`        | `readonly NotebookDocument[]`       | 所有已打开的 Notebook                                        |
| `isTrusted`                | `boolean`                           | 工作区是否已被信任（受限模式下为 `false`）                   |

## 事件 Events

| 成员                              | 说明                                       |
| --------------------------------- | ------------------------------------------ |
| `onDidChangeWorkspaceFolders`     | 工作区文件夹增删                           |
| `onDidOpenTextDocument`           | 文档打开                                   |
| `onDidCloseTextDocument`          | 文档关闭                                   |
| `onDidChangeTextDocument`         | 文档内容变化（未保存前也触发）             |
| `onWillSaveTextDocument`          | 保存前，可返回要追加的编辑                 |
| `onDidSaveTextDocument`           | 保存后（磁盘上的文本已更新）               |
| `onDidChangeConfiguration`        | 配置变化                                   |
| `onWillCreateFiles` / `onDidCreateFiles` | 文件创建前/后（前两个可取消或改写）  |
| `onWillDeleteFiles` / `onDidDeleteFiles` | 文件删除前/后                        |
| `onWillRenameFiles` / `onDidRenameFiles` | 文件重命名前/后                      |
| `onDidGrantWorkspaceTrust`        | 工作区被授予信任                           |
| `onDidOpenNotebookDocument` 等    | Notebook 的打开/关闭/变化                  |

## 方法 Functions

### 文件与文档

| 成员                                    | 说明                                                     |
| --------------------------------------- | -------------------------------------------------------- |
| `openTextDocument(uri \| fileName \| options)` | 打开文档并返回 `TextDocument`（**不会**在 UI 中显示） |
| `findFiles(include, exclude?, maxResults?, token?)` | 按 glob 查找文件，返回 `Uri[]`                 |
| `createFileSystemWatcher(glob)`         | 监听文件增删改（配合 `onDid*Files` 自动生效）            |
| `applyEdit(edit: WorkspaceEdit)`        | 应用一批跨文件编辑（等价于 `TextEditor.edit` 的全局版）  |
| `save(uri)` / `saveAs(uri)` / `saveAll(includeUntitled?)` | 保存文档                                 |
| `asRelativePath(pathOrUri, includeWorkspaceFolder?)` | 转成相对路径                              |
| `getWorkspaceFolder(uri)`               | 查询某个 `Uri` 属于哪个工作区文件夹                      |
| `updateWorkspaceFolders(start, deleteCount, ...folders)` | 增删工作区文件夹（可能被拒，返回 `false`） |

### 配置

```typescript
const config = vscode.workspace.getConfiguration('demo');
const size = config.get<number>('fontSize', 14);   // 第二个参数是默认值
const target = vscode.ConfigurationTarget.Workspace; // Global / Workspace / WorkspaceFolder
await config.update('fontSize', 18, target);
```

### 注册点

| 成员                                                     | 说明                                              |
| -------------------------------------------------------- | ------------------------------------------------- |
| `registerTextDocumentContentProvider(scheme, provider)`  | 用虚拟文档提供内容（详见虚拟文档指南）            |
| `registerFileSystemProvider(scheme, provider, options?)` | 实现一套完整的虚拟文件系统                        |
| `registerNotebookSerializer(type, serializer)`           | Notebook 序列化                                   |
| `registerTaskProvider`                                   | ⚠️ 已废弃，请用 `tasks.registerTaskProvider`      |

### 文本编解码（与编辑器设置一致）

```typescript
const bytes = await vscode.workspace.encode('中文内容');   // Thenable<Uint8Array>
const text = await vscode.workspace.decode(bytes);          // Thenable<string>
```

二者会按当前设置与 BOM 自动决定编码；`decode` 遇到二进制内容会抛错。

## 效果验证

1. `F5` 启动扩展开发宿主；
2. 打开 `code/settings-demo` 之类的工程，执行 demo 命令观察配置读写；
3. 观察「输出」面板中 `createFileSystemWatcher` 的回调日志。

> 📷 待补充截图：`docs/images/api-workspace/file-watcher.png`

## 常见坑

- **`workspaceFolders` 可能是 `undefined`**：用户可能只打开了一个空窗口，任何取 `[0]` 的代码都要先判空；
- **`onDidChangeTextDocument` 触发非常频繁**：需要防抖，否则会拖慢编辑器；
- **`openTextDocument` 不等于显示文档**：要显示还得 `window.showTextDocument(doc)`；
- **`getConfiguration` 要及时刷新**：直接 `await config.update(...)` 后，
  已经取到的 `config` 对象要重新 `getConfiguration` 才会看到新值；
- **`workspace.fs` 与 `node:fs` 不通用**：前者是异步的 `Uint8Array` 接口，
  但它是唯一支持远程/虚拟文件系统的途径；
- **`onWillSaveTextDocument` 里不要直接改文档**：要返回 `TextEdit[]` 或 `WorkspaceEdit`；
- **`updateWorkspaceFolders` 返回 `false`**：单文件（无工作区）打开时无法增删工作区文件夹；
- **受限模式（Workspace Trust）**：未受信任时很多能力被禁用，用 `workspace.isTrusted` 判断。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/virtual-workspaces-demo
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/virtual-documents-demo

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#workspace
https://code.visualstudio.com/api/references/vscode-api#FileSystem
https://code.visualstudio.com/api/extension-guides/virtual-workspaces
https://code.visualstudio.com/api/extension-guides/virtual-documents
https://code.visualstudio.com/api/extension-capabilities/common-capabilities
```
