// 运行在 webview 沙箱里：只有浏览器 API + acquireVsCodeApi
(function () {
	// 只能调用一次，必须在顶层获取
	const vscode = acquireVsCodeApi();

	const resultEl = document.getElementById('result');
	const toolEl = document.getElementById('tool-name');
	const languageEl = document.getElementById('language');
	const summaryEl = document.getElementById('summary');
	const noticeEl = document.getElementById('notice');

	// 面板被隐藏后 webview 可能被销毁，靠 setState 恢复上一次结果
	const previousState = vscode.getState();
	if (previousState && previousState.result) {
		render(previousState.result);
	}

	document.getElementById('copy').addEventListener('click', () => {
		// 浏览器剪贴板在 webview 里不可靠，交给扩展宿主写
		vscode.postMessage({ command: 'copy' });
		flash('已请求复制');
	});

	document.getElementById('rerun').addEventListener('click', () => {
		vscode.postMessage({ command: 'rerun' });
	});

	window.addEventListener('message', (event) => {
		const message = event.data;
		if (message.command === 'result') {
			render(message);
			vscode.setState({ result: message });
		}
	});

	// 通知扩展「脚本已就绪」，此时再推数据就不会丢消息
	vscode.postMessage({ command: 'ready' });

	let persistentNotice = '';
	let flashTimer;

	function render(data) {
		// 关键：用 textContent 而不是 innerHTML —— 用户输入里的标签不会被解析
		resultEl.textContent = data.text || '（空结果）';
		toolEl.textContent = data.tool || 'Magic Tools';
		languageEl.textContent = data.language || '';
		languageEl.hidden = !data.language;

		const parts = [];
		if (data.summary) {
			parts.push(data.summary);
		}
		parts.push(`${data.fullLength} 字符`);
		summaryEl.textContent = parts.join(' · ');

		if (data.truncated) {
			persistentNotice = `预览已截断：省略了 ${data.omittedLines} 行，点「复制」可拿到完整结果。`;
		} else {
			persistentNotice = '';
		}
		setNotice(persistentNotice);
	}

	/** 临时提示，1.5 秒后回落到常驻提示（例如“已截断”警告） */
	function flash(text) {
		setNotice(text);
		clearTimeout(flashTimer);
		flashTimer = setTimeout(() => setNotice(persistentNotice), 1500);
	}

	function setNotice(text) {
		noticeEl.textContent = text;
		noticeEl.hidden = !text;
	}
})();
