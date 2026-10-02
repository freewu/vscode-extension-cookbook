# 彩色主题 Color Theme

> 彩色主题（Color Theme）用来定义工作台 UI 配色与编辑器语法着色。
> 主题扩展是**纯配置扩展**：不需要 `main` / `extension.ts`，只贡献 `contributes.themes`，安装后由 VS Code 直接加载。
> 官方指南：https://code.visualstudio.com/api/extension-guides/color-theme

## 目录结构

```
color-theme-demo
├── package.json                     声明 contributes.themes
└── themes
    └── demo4-color-theme.json       主题文件（colors + tokenColors）
```

## package.json 配置

```json
{
  "categories": ["Themes"],
  "contributes": {
    "themes": [
      {
        // 主题在“颜色主题”列表中的显示名
        "label": "Demo4 Color Theme",
        // 主题底色：vs-dark | vs-light | hc-black | hc-light
        "uiTheme": "vs-dark",
        // 主题文件路径，相对扩展根目录
        "path": "./themes/demo4-color-theme.json"
      }
    ]
  }
}
```

> `uiTheme` 只影响 VS Code 对主题的**分类与兜底配色**，真正的颜色由主题文件决定。
> 一个扩展可以同时贡献多个主题（`contributes.themes` 是数组）。

## 主题文件

主题文件由三部分组成，全部可选：

| 字段                    | 作用                                        |
| ----------------------- | ------------------------------------------- |
| `colors`                | 工作台 UI 配色（活动栏、侧边栏、状态栏……）  |
| `tokenColors`           | TextMate 语法着色规则                       |
| `semanticTokenColors`   | 语义着色，需语言服务提供 semantic token     |

```json
{
  "$schema": "vscode://schemas/color-theme",
  "name": "Demo4 Color Theme",
  "type": "dark",
  "semanticHighlighting": true,
  "colors": {
    "editor.background": "#161b22",
    "editor.foreground": "#d4d4d4",
    "activityBar.background": "#1f2430",
    "sideBar.background": "#1a1f2b",
    "statusBar.background": "#0078d4",
    "titleBar.activeBackground": "#1f2430"
  },
  "tokenColors": [
    {
      "name": "注释",
      "scope": ["comment", "punctuation.definition.comment"],
      "settings": { "foreground": "#6b7280", "fontStyle": "italic" }
    },
    {
      "name": "关键字",
      "scope": ["keyword", "storage.type"],
      "settings": { "foreground": "#c586c0" }
    },
    {
      "name": "字符串",
      "scope": ["string", "string.quoted"],
      "settings": { "foreground": "#ce9178" }
    }
  ],
  "semanticTokenColors": {
    "variable.readonly": "#4fc1ff",
    "type": "#4ec9b0",
    "function": "#dcdcaa"
  }
}
```

### 工作台配色 colors

`colors` 的 key 是固定的（不能自造），完整列表见官方 Color Theme 参考：

```markdown
https://code.visualstudio.com/api/references/theme-color
```

常用 key：

| key                              | 作用                     |
| -------------------------------- | ------------------------ |
| `editor.background`              | 编辑器背景               |
| `editor.foreground`              | 编辑器默认前景           |
| `editor.lineHighlightBackground` | 当前行高亮               |
| `editor.selectionBackground`     | 选中区域                 |
| `editorCursor.foreground`        | 光标颜色                 |
| `activityBar.background`         | 活动栏背景               |
| `sideBar.background`             | 侧边栏背景               |
| `statusBar.background`           | 状态栏背景               |
| `titleBar.activeBackground`      | 标题栏背景               |

> key 支持 `#RRGGBB`、`#RRGGBBAA`（带透明度），不支持 `rgb()` 等函数写法。

### 语法着色 tokenColors

`scope` 是 TextMate scope 选择器，可以写多个（任一匹配即生效，越靠后优先级越高，`tokenColors` 数组靠后的规则也优先）。

用内置命令 `Developer: Inspect Editor Tokens and Scopes` 可以查看光标处文本的 scope，是调试主题最实用的手段。

### 语义着色 semanticTokenColors

语义着色由语言服务提供，不受 TextMate 正则限制，优先级高于 `tokenColors`。仅在 `semanticHighlighting: true`（或用户设置 `editor.semanticHighlighting.enabled`）时生效。

```json
{
  "semanticTokenColors": {
    "class": "#4ec9b0",
    "interface": "#4ec9b0",
    "parameter": "#9cdcfe",
    "property.readonly": "#4fc1ff"
  }
}
```

## 验证

1. 用 VS Code 打开 `code/color-theme-demo`；
2. 按 `F5` 启动扩展开发宿主；
3. `Ctrl+K Ctrl+T` 打开颜色主题列表，选择 `Demo4 Color Theme`；
4. 也可以用 `settings.json` 直接指定：

```json
{
  "workbench.colorTheme": "Demo4 Color Theme"
}
```

> 📷 待补充截图：`docs/images/color-theme-demo/select-theme.png`

## 重新加载主题

修改主题文件时**不需要**重启扩展宿主：主题是 JSON，VS Code 会自动热重载。若 `contributes.themes` 发生变化，才需要重启调试会话。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/color-theme-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/color-theme
https://code.visualstudio.com/api/references/theme-color
https://code.visualstudio.com/docs/getstarted/themes
https://github.com/microsoft/vscode-extension-samples/tree/main/theme-sample
```
