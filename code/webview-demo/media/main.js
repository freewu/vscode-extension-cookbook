// 该文件运行在 webview 沙箱中，只能使用浏览器 API + acquireVsCodeApi
(function () {
	// acquireVsCodeApi 只能调用一次，务必在模块顶层获取
	const vscode = acquireVsCodeApi();

	// --- 状态持久化：面板被隐藏/重建后可以恢复 ---
	const previousState = vscode.getState();
	if (previousState && previousState.color) {
		document.getElementById('color').textContent = previousState.color;
	}

	document.getElementById('say-hello').addEventListener('click', () => {
		vscode.postMessage({ command: 'alert', text: '来自 webview 的问候 👋' });
	});

	document.getElementById('pick-color').addEventListener('click', () => {
		vscode.postMessage({ command: 'pickColor' });
	});

	// --- 接收扩展发来的消息 ---
	window.addEventListener('message', (event) => {
		const message = event.data;
		switch (message.command) {
			case 'setColor': {
				const color = message.color || '（未选择）';
				document.getElementById('color').textContent = color;
				// 写入 webview 状态，retainContextWhenHidden 关闭时也能恢复
				vscode.setState({ color });
				break;
			}
		}
	});
})();
