// 运行在自定义编辑器的 webview 中
const vscode = acquireVsCodeApi();

const editor = document.getElementById('editor');
const status = document.getElementById('status');

function setStatus(text, ok) {
	status.textContent = text;
	status.className = ok ? 'status ok' : 'status error';
}

function validate() {
	try {
		JSON.parse(editor.value);
		setStatus('JSON 合法', true);
		return true;
	} catch (error) {
		setStatus('JSON 解析失败：' + error.message, false);
		return false;
	}
}

editor.addEventListener('input', validate);

document.getElementById('apply').addEventListener('click', () => {
	if (!validate()) {
		return;
	}
	// 交给扩展宿主去修改 TextDocument
	vscode.postMessage({ type: 'edit', text: editor.value });
	setStatus('已写回文档，记得 Ctrl+S 保存', true);
});

// 放弃本地修改：让扩展重新推一次文档内容
document.getElementById('reload').addEventListener('click', () => {
	vscode.postMessage({ type: 'reload' });
});

document.getElementById('ping').addEventListener('click', () => {
	vscode.postMessage({ type: 'info', message: '扩展宿主收到消息了 👋' });
});

// 接收扩展推来的文档内容
window.addEventListener('message', (event) => {
	const message = event.data;
	if (message.type === 'update') {
		editor.value = message.text;
		validate();
	}
});
