import * as assert from 'assert';
import * as vscode from 'vscode';

// 直接导入被测代码
import { add } from '../extension';

suite('demo12 扩展测试', () => {
	test('纯函数可以直接断言（不需要扩展宿主）', () => {
		assert.strictEqual(add(1, 2), 3);
		assert.strictEqual(add(-1, 1), 0);
	});

	test('命令已注册，且返回值可被 executeCommand 拿到', async () => {
		// 先确认命令存在
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('demo12.add'), 'demo12.add 未注册');

		const result = await vscode.commands.executeCommand<number>('demo12.add', 2, 40);
		assert.strictEqual(result, 42);
	});

	test('扩展宿主里的 vscode API 可用', () => {
		assert.ok(Array.isArray(vscode.workspace.workspaceFolders));
		assert.strictEqual(typeof vscode.window.showInformationMessage, 'function');
	});

	// 需要文件系统的用例可以在这里创建临时文件后断言
	test('workspace.fs 可以读写临时文件', async () => {
		const folder = vscode.workspace.workspaceFolders?.[0];
		if (!folder) {
			// 无工作区时跳过，避免误报失败
			return;
		}
		const uri = vscode.Uri.joinPath(folder.uri, '.demo12-temp.txt');
		await vscode.workspace.fs.writeFile(uri, Buffer.from('hello', 'utf8'));
		const bytes = await vscode.workspace.fs.readFile(uri);
		assert.strictEqual(Buffer.from(bytes).toString('utf8'), 'hello');
		await vscode.workspace.fs.delete(uri);
	});
});
