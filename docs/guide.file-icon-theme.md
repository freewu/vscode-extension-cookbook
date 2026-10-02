# 文件图标主题 File Icon Theme

> 文件图标主题（File Icon Theme）用来替换资源管理器中的文件/文件夹图标。
> 与彩色主题一样属于**纯配置扩展**：不需要 `main` / `extension.ts`，只贡献 `contributes.iconThemes`。
> 官方指南：https://code.visualstudio.com/api/extension-guides/file-icon-theme

## 目录结构

```
file-icon-theme-demo
├── package.json                     声明 contributes.iconThemes
└── icons
    ├── demo5-icon-theme.json        图标主题文件
    ├── default_file.svg             默认文件图标
    ├── default_folder.svg           默认文件夹（收起）
    ├── default_folder_opened.svg    默认文件夹（展开）
    ├── folder_src.svg               src 文件夹专用图标
    ├── typescript.svg
    ├── json.svg
    └── markdown.svg
```

## package.json 配置

```json
{
  "categories": ["Themes"],
  "contributes": {
    "iconThemes": [
      {
        "id": "demo5-file-icon-theme",
        "label": "Demo5 File Icon Theme",
        "path": "./icons/demo5-icon-theme.json"
      }
    ]
  }
}
```

> `id` 是图标主题的唯一标识，用户设置 `workbench.iconTheme` 时使用的就是它。

## 图标主题文件

```json
{
  "$schema": "vscode://schemas/icon-theme",
  "iconDefinitions": {
    "_file": { "iconPath": "./default_file.svg" },
    "_folder": { "iconPath": "./default_folder.svg" },
    "_folder_open": { "iconPath": "./default_folder_opened.svg" },
    "_ts": { "iconPath": "./typescript.svg" }
  },
  "fileNames": { "package.json": "_json" },
  "fileExtensions": { "ts": "_ts", "json": "_json", "md": "_md" },
  "languageIds": { "typescript": "_ts" },
  "folderNames": { "src": "_src_folder" },
  "file": "_file",
  "folder": "_folder",
  "folderExpanded": "_folder_open",
  "hidesExplorerArrows": false
}
```

### 匹配规则的优先级

从上到下依次匹配，命中即返回：

| 字段                | 匹配对象                        | 示例                        |
| ------------------- | ------------------------------- | --------------------------- |
| `fileNames`         | 文件名（精确）                  | `"package.json": "_json"`   |
| `fileExtensions`    | 扩展名（不含点）                | `"ts": "_ts"`               |
| `languageIds`       | 语言 ID                         | `"typescript": "_ts"`       |
| `file`              | 兜底文件图标（**必需**）        | `"_file"`                   |

> 同一字段内如果多个 key 都能匹配（如 `tsconfig.json` 同时命中 `fileNames` 与 `fileExtensions`），
> 以官方文档给出的顺序为准；实践中建议用 `fileNames` 精确指定。

文件夹相关字段：

| 字段                | 作用                                              |
| ------------------- | ------------------------------------------------- |
| `folderNames`       | 按文件夹名匹配                                    |
| `folderNamesExpanded` | 文件夹展开时的图标（不写则复用 `folderNames`）  |
| `folder`            | 兜底文件夹图标（**必需**）                        |
| `folderExpanded`    | 兜底文件夹展开图标                                |
| `hidesExplorerArrows` | 为 `true` 时隐藏展开箭头（图标本身表达展开状态）|

> 📷 待补充截图：`docs/images/file-icon-theme-demo/explorer.png`

## 图标文件要求

- 格式：推荐 `.svg`（也支持 `.png`）；
- 尺寸：建议单色 32×32 或 16×16，SVG 可自适应；
- 颜色：文件图标主题**支持彩色**，与活动栏图标（必须单色）不同；
- 路径：`iconPath` 相对主题 JSON 文件所在目录。

## 验证

1. 用 VS Code 打开 `code/file-icon-theme-demo`；
2. 按 `F5` 启动扩展开发宿主；
3. 打开任意含 `.ts` / `.json` / `.md` 的工程，观察资源管理器图标；
4. 或通过 `settings.json` 指定：

```json
{
  "workbench.iconTheme": "demo5-file-icon-theme"
}
```

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/file-icon-theme-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/file-icon-theme
https://github.com/microsoft/vscode-extension-samples/tree/main/icon-theme-sample
https://code.visualstudio.com/api/references/icon-theme
```
