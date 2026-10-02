# Markdown Extension

> Markdown 扩展可以扩展 VS Code 内置的 Markdown 预览：新增语法、注入样式/脚本、改写渲染结果。
> 内置预览基于 [markdown-it](https://github.com/markdown-it/markdown-it)，
> 扩展通过 `contributes.markdown.markdownItPlugins` 拿到实例并挂载插件。
> 官方指南：https://code.visualstudio.com/api/extension-guides/markdown-extension

## 能扩展什么

| 能力                | 贡献点                                  | 说明                                 |
| ------------------- | --------------------------------------- | ------------------------------------ |
| markdown-it 插件    | `contributes.markdown.markdownItPlugins`| 新增/改写语法                        |
| 预览样式            | `contributes.markdown.previewStyles`    | 注入 CSS                             |
| 预览脚本            | `contributes.markdown.previewScripts`   | 注入 JS（运行在预览 iframe 内）      |
| 语法高亮            | `contributes.languages` + TextMate 语法  | Markdown 代码块高亮                  |
| 渲染成 HTML         | 内置命令 `markdown.api.render`          | 在扩展/任务里把 md 转成 html         |

## 目录结构

```
markdown-demo
├── package.json          声明 contributes.markdown
├── media
│   └── markdown.css      预览样式
└── src
    └── extension.ts      extendMarkdownIt
```

## package.json 配置

```json
{
  "activationEvents": ["onLanguage:markdown"],
  "contributes": {
    "markdown": {
      // 声明需要拿到 markdown-it 实例
      "markdownItPlugins": true,
      // 预览样式，路径相对扩展根目录
      "previewStyles": ["./media/markdown.css"]
    }
  }
}
```

> ⚠️ `markdownItPlugins` 不会自动生成激活事件，必须像上面这样用 `onLanguage:markdown`
> （或 `onCommand:`）显式激活，否则插件不会被加载。

## extension.ts 实现

`activate` 必须**同步返回**一个带 `extendMarkdownIt` 的对象：

```typescript
import * as vscode from 'vscode';

export function activate(_context: vscode.ExtensionContext) {
	return {
		// md 是 markdown-it 实例；这里用 any 避免引入 markdown-it 依赖
		extendMarkdownIt(md: any) {
			// ……注册规则
			return md;
		},
	};
}
```

### 1. 新增行内语法：==高亮== → `<mark>`

markdown-it 的规则用 ruler 注册，`before` / `after` 决定与内置规则的相对顺序。

```typescript
md.inline.ruler.before('emphasis', 'demo11_mark', (state: any, silent: boolean) => {
	const start: number = state.pos;
	// 必须以 == 开头
	if (state.src.charCodeAt(start) !== 0x3d || state.src.charCodeAt(start + 1) !== 0x3d) {
		return false;
	}
	const end = state.src.indexOf('==', start + 2);
	if (end === -1) {
		return false;
	}
	if (!silent) {
		// 不写自定义 renderer，靠 token.tag 走默认渲染 → <mark>...</mark>
		state.push('mark_open', 'mark', 1);
		const text = state.push('text', '', 0);
		text.content = state.src.slice(start + 2, end);
		state.push('mark_close', 'mark', -1);
	}
	state.pos = end + 2;
	return true;
});
```

规则约定：

- `silent === true` 时只做**合法性判断**，不能修改 `state`（markdown-it 会先用它试探）；
- 匹配失败返回 `false`，成功必须推进 `state.pos`，否则会死循环；
- `state.push(type, tag, nesting)` 的 `nesting`：`1` 开标签、`0` 自闭合、`-1` 闭标签。

### 2. 改写已有 token：外链加 `target="_blank"`

```typescript
md.core.ruler.push('demo11_external_links', (state: any) => {
	for (const token of state.tokens) {
		if (token.type !== 'inline' || !token.children) {
			continue;
		}
		for (const child of token.children) {
			if (child.type !== 'link_open') {
				continue;
			}
			const href: string = child.attrGet('href') ?? '';
			if (/^https?:/i.test(href)) {
				child.attrSet('target', '_blank');
				child.attrSet('rel', 'noopener noreferrer');
			}
		}
	}
	return true;
});
```

> `core` 规则在行内解析完成之后执行，适合遍历/修改 `state.tokens` 整棵树。

### 3. 调整 markdown-it 选项

```typescript
md.set({
	breaks: true, // 单个换行也渲染成 <br>
});
```

### 4. 使用外部 markdown-it 插件

需要把插件作为运行时依赖（不是 devDependency）：

```bash
pnpm add markdown-it-footnote
```

```typescript
import footnote from 'markdown-it-footnote';

export function activate() {
	return {
		extendMarkdownIt(md: any) {
			// 先 set 再 use，保持一致
			md.set({ linkify: true });
			md.use(footnote);
			return md;
		},
	};
}
```

> 插件的 `package.json` 不能放进 `devDependencies`，否则打包后运行时报模块找不到。

## 预览样式

```css
/* media/markdown.css —— 通过 contributes.markdown.previewStyles 注入 */
mark {
	background-color: var(--vscode-editor-findMatchHighlightBackground, #fff3a3);
	color: inherit;
	padding: 0 2px;
	border-radius: 2px;
}
```

## 把 Markdown 渲染成 HTML

内置命令 `markdown.api.render` 接受 Markdown 文本，返回 HTML 字符串：

```typescript
const html = await vscode.commands.executeCommand<string>(
	'markdown.api.render',
	'# 标题\n\n==高亮== 文本'
);
```

## 效果验证

1. 用 VS Code 打开 `code/markdown-demo`，按 `F5` 启动扩展开发宿主；
2. 新建 `test.md`，输入：

```markdown
这是 ==高亮== 文本

[外链](https://code.visualstudio.com/)
```

3. `Ctrl+Shift+V` 打开预览：
   - `==高亮==` 渲染成黄色 `<mark>`；
   - 外链点击后在新标签页打开（`target="_blank"`）。

> 预览更新不及时？执行 `Developer: Reload Window`，因为 `extendMarkdownIt` 只在激活时执行一次。

> 📷 待补充截图：`docs/images/markdown-demo/preview.png`

## 常见坑

- 扩展不生效 → `markdownItPlugins` 没写，或激活事件不是 `onLanguage:markdown`；
- `activate` 写成了 `async` → 必须同步返回 `{ extendMarkdownIt }`；
- 预览里 HTML 被过滤 → 预览的 `markdown-it` 默认允许 HTML，但如果注入 `<script>` 会被 CSP 拦掉；
- 规则导致卡死 → 匹配成功后忘了推进 `state.pos`；
- 打包后插件失效 → markdown-it 插件进了 `devDependencies`。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/markdown-demo

## 资料
```markdown
https://code.visualstudio.com/api/extension-guides/markdown-extension
https://code.visualstudio.com/api/references/contribution-points#contributes.markdown
https://github.com/markdown-it/markdown-it
https://github.com/microsoft/vscode-extension-samples/tree/main/markdown-language-features
```
