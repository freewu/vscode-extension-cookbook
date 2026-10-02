import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	// ---------------- 1. 列出所有扩展，按需激活 ----------------
	context.subscriptions.push(
		vscode.commands.registerCommand('demoExt.list', async () => {
			// extensions.all 是**已安装**的全部扩展（包含内置扩展），不会触发激活
			const all = vscode.extensions.all;

			const picked = await vscode.window.showQuickPick(
				all
					.map((extension) => ({
						label: extension.id,
						description: extension.packageJSON.version as string | undefined,
						detail: extension.isActive ? '已激活' : '未激活',
						extension,
					}))
					.sort((a, b) => a.label.localeCompare(b.label)),
				{ placeHolder: `共 ${all.length} 个扩展，选择后尝试激活它`, matchOnDetail: true }
			);

			if (!picked) {
				return;
			}

			const extension = picked.extension;
			// activate() 的返回值就是该扩展 activate 函数返回的"导出 API"
			const exports = await extension.activate();
			const exportedKeys = exports && typeof exports === 'object' ? Object.keys(exports as object) : [];

			void vscode.window.showInformationMessage(
				`${extension.id} 已激活；导出：${exportedKeys.length > 0 ? exportedKeys.join('、') : '(无)'}`
			);
			console.log('[demoExt] exports =', exports);
		})
	);

	// ---------------- 2. 读取自身信息 ----------------
	context.subscriptions.push(
		vscode.commands.registerCommand('demoExt.showSelf', () => {
			// 开发模式下 publisher 可能是 undefined_publisher，所以用 name 兜底查找
			const self =
				vscode.extensions.all.find((extension) => extension.packageJSON.name === 'api-extensions-demo') ??
				vscode.extensions.all.find((extension) => extension.id.endsWith('api-extensions-demo'));

			if (!self) {
				void vscode.window.showWarningMessage('没找到本扩展自身');
				return;
			}

			console.log('[demoExt] id          =', self.id);
			console.log('[demoExt] extensionPath =', self.extensionPath);
			console.log('[demoExt] isActive    =', self.isActive);
			console.log('[demoExt] packageJSON =', self.packageJSON);

			void vscode.window.showInformationMessage(
				`${self.id}\n路径：${self.extensionPath}\n已激活：${self.isActive ? '是' : '否'}`
			);
		})
	);

	// ---------------- 3. 扩展列表变化 ----------------
	context.subscriptions.push(
		vscode.extensions.onDidChange(() => {
			console.log('[demoExt] 已安装扩展列表发生变化，当前共', vscode.extensions.all.length, '个');
		})
	);
}

export function deactivate() {}
