# product-icon-theme-demo

Product Icon Theme（产品图标主题）示例，对应文档 [docs/guide.product-icon-theme.md](../../docs/guide.product-icon-theme.md)。

## 关于字体文件

产品图标主题**必须提供一个图标字体**（`.woff` / `.ttf`），图标通过 `fontCharacter` 私有区码位（`\e000`-`\f8ff`）引用。

仓库不包含字体二进制文件。生成方式二选一：

1. 从官方示例拷贝现成字体（推荐用于本地调试）
   > https://github.com/microsoft/vscode-extension-samples/tree/main/product-icon-theme-sample
   把其中的 `.woff` 放到本目录 `fonts/demo6.woff`，并按实际码位修正 `resources/demo6-product-icon-theme.json` 中的 `fontCharacter`；
2. 用在线工具生成：把 SVG 图标上传到 https://icomoon.io 或 https://fontello.com ，导出字体后填入码位。

## 目录结构

```
product-icon-theme-demo
├── fonts
│   └── demo6.woff                      图标字体（需自行生成/拷贝）
├── package.json                        贡献 contributes.productIconThemes
└── resources
    └── demo6-product-icon-theme.json   字体声明 + 图标定义
```

## 调试

1. 补齐 `fonts/demo6.woff`；
2. 用 VS Code 打开本目录，按 `F5`；
3. `Ctrl+Shift+P` → `Preferences: Product Icon Theme` → 选择 `Demo6 Product Icon Theme`。

## 打包

```bash
vsce package
```

> 注意：`.woff` 不能被 `.vscodeignore` 排除，否则安装后图标不显示。
