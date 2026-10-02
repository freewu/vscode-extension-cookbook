# 产品图标主题 Product Icon Theme

> 产品图标主题（Product Icon Theme）替换的是 VS Code **内置 UI 图标**（如资源管理器的文件夹、大纲里的符号图标、断点图标等），
> 这些图标来自 VS Code 自带的 codicon 字体，产品图标主题允许用自定义字体整体替换。
> 官方指南：https://code.visualstudio.com/api/extension-guides/product-icon-theme

## 与文件图标主题的区别

| 对比项     | 文件图标主题 File Icon Theme        | 产品图标主题 Product Icon Theme            |
| ---------- | ----------------------------------- | ------------------------------------------ |
| 替换对象   | 资源管理器里的文件/文件夹图标        | VS Code 内置 UI 图标（codicon）             |
| 图标来源   | 任意 `.svg` / `.png` 图片            | **必须是图标字体**（`.woff` / `.ttf`）      |
| 贡献点     | `contributes.iconThemes`            | `contributes.productIconThemes`             |
| 用户设置   | `workbench.iconTheme`               | `workbench.productIconTheme`                |
| 定义方式   | `iconPath`                          | `fontCharacter`（字体私有区码位）           |

## 目录结构

```
product-icon-theme-demo
├── package.json                          声明 contributes.productIconThemes
├── fonts
│   └── demo6.woff                        图标字体（需自行生成，见 README）
└── resources
    └── demo6-product-icon-theme.json     字体声明 + 图标定义
```

## package.json 配置

```json
{
  "categories": ["Themes"],
  "contributes": {
    "productIconThemes": [
      {
        "id": "demo6-product-icon-theme",
        "label": "Demo6 Product Icon Theme",
        "path": "./resources/demo6-product-icon-theme.json"
      }
    ]
  }
}
```

## 主题文件

```json
{
  "$schema": "vscode://schemas/product-icon-theme",
  "fonts": [
    {
      "id": "demo6",
      "src": [
        { "path": "./../fonts/demo6.woff", "format": "woff" }
      ],
      "weight": "normal",
      "style": "normal"
    }
  ],
  "iconDefinitions": {
    "folder":          { "fontCharacter": "\\ea01", "fontId": "demo6" },
    "folder-opened":   { "fontCharacter": "\\ea02", "fontId": "demo6" },
    "file":            { "fontCharacter": "\\ea03", "fontId": "demo6" },
    "symbol-method":   { "fontCharacter": "\\ea04", "fontId": "demo6" },
    "symbol-class":    { "fontCharacter": "\\ea05", "fontId": "demo6" },
    "debug-breakpoint":{ "fontCharacter": "\\ea08", "fontId": "demo6" }
  }
}
```

### iconDefinitions 的 key 不能自造

产品图标主题只替换 VS Code **约定好的一组图标 ID**（`folder`、`file`、`symbol-method`、`debug-breakpoint`……），
未定义的 ID 会继续使用内置 codicon 兜底。

完整 ID 列表（Icon Listing）：
```markdown
https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
```

### fontCharacter 与字体

- 字体可以是 `.woff` / `.ttf` / `.woff2`，通过 `fonts[].src[].format` 指定；
- `fontCharacter` 使用字体**私有使用区（PUA）**码位：`\e000` ~ `\f8ff`；
- JSON 中要写成转义形式 `"\\ea01"`；
- 多个字体时用 `fontId` 区分，不写则用第一个。

## 生成图标字体

仓库不提交字体二进制文件，生成方式二选一（详见 `code/product-icon-theme-demo/README.md`）：

1. **拷贝官方示例字体**（本地调试最快）
   ```markdown
   https://github.com/microsoft/vscode-extension-samples/tree/main/product-icon-theme-sample
   ```
   把示例里的 `.woff` 放到 `fonts/demo6.woff`，并按实际码位修正 `fontCharacter`。

2. **自行生成**：把 SVG 图标上传到 https://icomoon.io 或 https://fontello.com ，
   导出字体后把每个图标的码位填入 `iconDefinitions`。

## 验证

1. 补齐 `fonts/demo6.woff`；
2. 用 VS Code 打开 `code/product-icon-theme-demo`，按 `F5`；
3. `Ctrl+Shift+P` → `Preferences: Product Icon Theme` → 选择 `Demo6 Product Icon Theme`；
4. 或者：

```json
{
  "workbench.productIconTheme": "demo6-product-icon-theme"
}
```

> 📷 待补充截图：`docs/images/product-icon-theme-demo/select-product-icon-theme.png`

## 常见坑

- `.woff` 被 `.vscodeignore` 排除 → 安装后图标全部消失（打包前确认字体在 vsix 内）；
- `fontCharacter` 与字体实际码位不一致 → 显示成方块/问号；
- 只定义了部分 ID → 其余图标仍是内置样式，属于预期行为。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/product-icon-theme-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/product-icon-theme
https://code.visualstudio.com/api/references/icons-in-labels
https://github.com/microsoft/vscode-extension-samples/tree/main/product-icon-theme-sample
```
