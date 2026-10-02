# 自定义数据 Custom Data

> 自定义数据（Custom Data）是**不需要写一行代码**就能扩展 VS Code 内置 HTML / CSS 语言能力的机制：
> 补全、悬停信息、值提示都来自一份 JSON 描述文件。
> 官方指南：https://code.visualstudio.com/api/extension-guides/custom-data-extension

## 与「语法扩展」的区别

| 目标                               | 手段                                       |
| ---------------------------------- | ------------------------------------------ |
| 让内置 HTML/CSS 认识**我的标签**   | `contributes.html.customData` / `css.customData` |
| 让 VS Code 支持一门**新语言**      | TextMate 语法 + `contributes.languages`    |
| 提供**语义级**智能                 | Language Server + LSP                      |

> Custom Data 只影响**补全与悬停**，不改变语法高亮，也不做语义校验。
> 例如 Web Component、设计系统组件库、CSS 自定义属性（design token）非常适合。

## 目录结构

```
custom-data-demo
├── package.json            声明两个贡献点（无 main）
├── data
│   ├── html.html-data.json HTML 自定义数据
│   └── css.css-data.json   CSS 自定义数据
└── samples
    ├── demo.html           用于体验补全
    └── demo.css
```

> 文件后缀很关键：`.html-data.json` / `.css-data.json`，VS Code 会据此套用对应的
> JSON Schema，编辑时自带补全与校验。

## package.json 配置

```json
{
  "contributes": {
    "html": {
      "customData": ["./data/html.html-data.json"]
    },
    "css": {
      "customData": ["./data/css.css-data.json"]
    }
  }
}
```

> 这是**纯声明式**扩展：没有 `main`、没有 `activationEvents`，也不需要 `activate`。

## HTML 自定义数据格式

```json
{
  "version": 1.1,
  "tags": [
    {
      "name": "demo-card",
      "description": "Demo 卡片容器",
      "attributes": [
        { "name": "title", "description": "卡片标题" },
        {
          "name": "elevation",
          "description": "阴影等级",
          "values": [
            { "name": "0", "description": "无阴影" },
            { "name": "1", "description": "轻微阴影" }
          ]
        },
        { "name": "theme", "description": "主题", "valueSet": "demo-theme" }
      ]
    }
  ],
  "globalAttributes": [{ "name": "data-demo", "description": "标记该节点由 Demo 组件渲染" }],
  "valueSets": [
    {
      "name": "demo-theme",
      "values": [
        { "name": "light", "description": "浅色" },
        { "name": "dark", "description": "深色" }
      ]
    }
  ]
}
```

结构说明：

| 字段               | 作用                                                       |
| ------------------ | ---------------------------------------------------------- |
| `version`          | 必填，当前用 `1.1`                                          |
| `tags`             | 自定义标签；`attributes` 描述属性，`values` 直接内联候选值  |
| `globalAttributes` | 任意标签都能用的属性（如 `data-*`）                         |
| `valueSets`        | 可复用的候选值集合，用 `valueSet` 引用（多个属性共享枚举）  |

## CSS 自定义数据格式

```json
{
  "version": 1.1,
  "properties": [
    {
      "name": "--demo-card-radius",
      "description": "Demo 卡片圆角",
      "values": [{ "name": "4px" }, { "name": "8px" }, { "name": "16px" }]
    }
  ],
  "atDirectives": [{ "name": "@demo-layer", "description": "Demo 分层指令" }],
  "pseudoClasses": [{ "name": ":demo-active", "description": "Demo 激活态" }],
  "pseudoElements": [{ "name": "::demo-arrow", "description": "Demo 箭头装饰" }]
}
```

| 字段             | 作用                       |
| ---------------- | -------------------------- |
| `properties`     | 属性名（含 `--自定义属性`）|
| `atDirectives`   | `@` 指令                   |
| `pseudoClasses`  | `:伪类`                    |
| `pseudoElements` | `::伪元素`                 |

> 每个实体还支持 `browsers`、`references`、`restrictions`（如 `restrictions: ["color"]`
> 让值提示只出现颜色）等可选字段。

## CSS 额外支持 SCSS / Less

同一份 CSS 自定义数据可以被预处理语言复用：

```json
{
  "contributes": {
    "css": { "customData": ["./data/css.css-data.json"] },
    "scss": { "customData": ["./data/css.css-data.json"] },
    "less": { "customData": ["./data/css.css-data.json"] }
  }
}
```

## 用户也可以不加扩展就用

这两个设置项与贡献点等价，方便让用户自己挂一份数据：

```jsonc
// settings.json
{
  "html.customData": ["./node_modules/my-ui/html.html-data.json"],
  "css.customData": ["./node_modules/my-ui/css.css-data.json"]
}
```

> 常见做法：把 `<pkg>.html-data.json` 随组件库一起发布到 npm，
> 再提供一个只做贡献点的轻量扩展，或直接让用户配 `settings.json`。

## 效果验证

1. 用 VS Code 打开 `code/custom-data-demo`，按 `F5` 启动扩展开发宿主；
2. 在扩展宿主中打开 `samples/demo.html`；
3. 输入 `<demo-` → 提示 `demo-card` / `demo-badge`；
4. 在 `<demo-card ` 后按 `Ctrl+Space` → 提示 `title` / `elevation` / `theme`；
5. 输入 `elevation="` → 提示 `0` / `1` / `2`；
6. 打开 `samples/demo.css`，输入 `--demo-`、`@demo-`、`:demo-` 观察补全。

> 📷 待补充截图：`docs/images/custom-data-demo/completion.png`

## 常见坑

- **补全没出现**：贡献点路径写错（相对扩展根目录），或 JSON 里 `version` 缺失导致整份数据被丢弃；
- **改了数据但没生效**：Custom Data 在语言服务启动时加载，需要 `Developer: Reload Window`；
- **schema 校验报错**：文件后缀不是 `.html-data.json` / `.css-data.json`，编辑器用了错误 schema；
- **只想改高亮却用了 Custom Data**：它不影响语法高亮，高亮要靠 TextMate 语法；
- **想校验组件用法**：Custom Data 不做语义校验，需要 Language Server。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/custom-data-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/custom-data-extension
https://github.com/microsoft/vscode-custom-data
https://github.com/microsoft/vscode-html-languageservice/blob/main/docs/customData.md
https://github.com/microsoft/vscode-css-languageservice/blob/main/docs/customData.md
https://github.com/microsoft/vscode-extension-samples/tree/main/custom-data-sample
```
