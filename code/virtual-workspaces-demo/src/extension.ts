import * as vscode from 'vscode';

const NOTES_FILE = 'demo8-notes.txt';

export function activate(context: vscode.ExtensionContext) {
	// 1. 查看工作区文件夹的 scheme，判断是否运行在虚拟工作区
	context.subscriptions.push(
		vscode.commands.registerCommand('demo8.showWorkspaceInfo', async () => {
			const folders = vscode.workspace.workspaceFolders;
			if (!folders || folders.length === 0) {
				await vscode.window.showInformationMessage('当前没有打开任何工作区文件夹。');
				return;
			}
			const info = folders.map((f) => `${f.name} (scheme: ${f.uri.scheme})`).join('\n');
			// file 表示本地磁盘；vscode-vfs / github / memfs 等即为虚拟工作区
			const isVirtual = folders.some((f) => f.uri.scheme !== 'file');
			await vscode.window.showInformationMessage(
				`${info}\n是否虚拟工作区：${isVirtual ? '是' : '否'}`
			);
		})
	);

	// 2. 统一使用 vscode.workspace.fs，本地与虚拟工作区都能工作
	context.subscriptions.push(
		vscode.commands.registerCommand('demo8.writeNotes', async () => {
			const folder = vscode.workspace.workspaceFolders?.[0];
			if (!folder) {
				await vscode.window.showWarningMessage('请先打开一个文件夹。');
				return;
			}

			const uri = vscode.Uri.joinPath(folder.uri, NOTES_FILE);

			// 写入：文本必须转成 Uint8Array
			const content = `写入时间：${new Date().toLocaleString()}\n`;
			await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));

			// 读取：返回 Uint8Array
			const bytes = await vscode.workspace.fs.readFile(uri);
			const text = Buffer.from(bytes).toString('utf8');

			// 是否追加：先判断存在性，避免直接 stat 抛错
			const exists = await fileExists(uri);

			await vscode.window.showInformationMessage(`已写入 ${NOTES_FILE}（存在：${exists}）\n${text.trim()}`);
		})
	);
}

/** 判断文件/目录是否存在：exists 能力缺失时退化为 stat + 捕获异常 */
async function fileExists(uri: vscode.Uri): Promise<boolean> {
	if (typeof vscode.workspace.fs.stat === 'function') {
		try {
			await vscode.workspace.fs.stat(uri);
			return true;
		} catch {
			return false;
		}
	}
	return false;
}

export function deactivate() {}
