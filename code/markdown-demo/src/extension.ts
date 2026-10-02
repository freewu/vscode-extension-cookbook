import * as vscode from 'vscode';

/**
 * 扩展 Markdown 预览的 markdown-it 实例。
 *
 * 注意：
 * 1. 该函数在**激活阶段同步返回**，不能是 async；
 * 2. package.json 中必须声明 `contributes.markdown.markdownItPlugins: true`；
 * 3. 必须用 `onLanguage:markdown` 之类的事件激活扩展（默认的 onCommand 不会触发）。
 */
export function activate(_context: vscode.ExtensionContext) {
	return {
		// md 是 markdown-it 实例；这里用 any 避免引入 markdown-it 依赖
		extendMarkdownIt(md: any) {
			// ---------------------------------------------------------------
			// 1. 新增行内语法：==高亮== 渲染为 <mark>
			//    用 ruler.before 插到 emphasis 规则之前
			// ---------------------------------------------------------------
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
					// 不写自定义 renderer 规则，靠 token.tag 走默认渲染 → <mark>...</mark>
					state.push('mark_open', 'mark', 1);
					const text = state.push('text', '', 0);
					text.content = state.src.slice(start + 2, end);
					state.push('mark_close', 'mark', -1);
				}
				state.pos = end + 2;
				return true;
			});

			// ---------------------------------------------------------------
			// 2. 修改已有 token：外链加 target="_blank"
			// ---------------------------------------------------------------
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

			// ---------------------------------------------------------------
			// 3. 调整 markdown-it 选项
			// ---------------------------------------------------------------
			md.set({
				// 把单个换行渲染成 <br>（预览里更符合直觉）
				breaks: true,
			});

			// 返回同一个实例，VS Code 会用它渲染预览
			return md;
		},
	};
}

export function deactivate() {}
