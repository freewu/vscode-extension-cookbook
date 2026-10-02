# magic-tools

> Magic Tools for VSCode —— 实战项目：把 Tree View / Webview / 命令 / 配置 / 任务 组装成一个真正能用的扩展。
> 对应文档 [docs/demo.magic-tools.md](../../docs/demo.magic-tools.md)。

## 它是什么

活动栏多出一个「Magic Tools」视图，里面按分类列出 14 个日常小工具：

| 分类 | 工具 |
| --- | --- |
| 文本工具 | 大小写/命名风格转换、整理空白行、行排序去重、字数统计 |
| 编码 / 解码 | Base64 编解码、URL 编解码、HTML 实体转义 |
| 生成器 | UUID v4、当前时间、时间戳 ⇄ 时间、文本哈希 |
| 项目工具 | 工作区代码统计、运行 npm script |

点击工具栏条目 → 需要输入就用**编辑器选中文本**（没选中则弹输入框）→ 结果渲染在右侧的
Webview 面板里，可以一键复制、重新运行。

## 工程结构

```
magic-tools/
├── package.json            # 视图 / 命令 / 菜单 / 快捷键 / 配置 全部在这里声明
├── src/
│   ├── extension.ts        # activate：注册视图、命令、配置监听、任务监听
│   ├── tools.ts            # 工具注册表 + 纯函数实现（14 个工具）
│   ├── toolTreeProvider.ts # TreeDataProvider
│   └── resultPanel.ts      # 单例 Webview 结果面板（CSP + nonce + postMessage）
├── media/                  # webview 前端资源
│   ├── main.js
│   └── style.css
├── resources/icon.svg      # 活动栏图标（单色 SVG）
└── samples/                # 试手用的样例文本
```

## 调试

1. 用 VS Code 打开本目录，按 `F5` 启动扩展开发宿主；
2. 在宿主里打开 `samples/` 目录，打开 `sample.md` 并选中 `helloWorld`；
3. 活动栏点「Magic Tools」→ 点「大小写 / 命名风格转换」→ 选 `snake_case`；
4. 右侧面板出现结果，点「复制」写入剪贴板；
5. 试 `proj.scripts`（需工作区根有 package.json）→ 选中脚本会真的启动一个 Task；
6. 修改设置 `magicTools.enabledKinds` → 工具列表实时变化，输出面板有日志。

## 打包

```bash
npx @vscode/vsce package
```

`.vscodeignore` 已排除 `src/**`、`**/*.ts`、`**/*.map`、`samples/**`，`media/` 与
`resources/` 会被打进包里。
