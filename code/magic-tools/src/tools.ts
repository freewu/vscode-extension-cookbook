import * as vscode from 'vscode';

/** 工具分类 —— 决定 Tree View 的分组与 `magicTools.enabledKinds` 的取值 */
export type ToolKind = 'text' | 'encode' | 'generate' | 'project';

export const KIND_LABELS: Record<ToolKind, string> = {
	text: '文本工具',
	encode: '编码 / 解码',
	generate: '生成器',
	project: '项目工具',
};

export const ALL_KINDS: readonly ToolKind[] = ['text', 'encode', 'generate', 'project'];

/** 需要用户二选一（或多选一）的工具，用 options 声明候选项 */
export interface ToolOption {
	label: string;
	value: string;
	description?: string;
}

export interface ToolResult {
	/** 供结果面板做语法高亮/展示的语言标识 */
	language: string;
	text: string;
	/** 结果上方的说明，例如「模式：snake_case」 */
	summary?: string;
}

/** 工具运行时能拿到的东西：输入、候选项、工作区、以及自己的 QuickPick / 日志入口 */
export interface ToolContext {
	readonly input: string;
	readonly option: string | undefined;
	readonly workspaceFolder: vscode.WorkspaceFolder | undefined;
	/** 长耗时工具请在循环里检查它，用户点「取消」后会变成 aborted */
	readonly signal: AbortSignal;
	pick(items: readonly ToolOption[], placeHolder: string): Promise<string | undefined>;
	log(message: string): void;
}

export interface ToolDefinition {
	/** 全局唯一，同时是 Tree Item 的 id */
	id: string;
	label: string;
	description: string;
	kind: ToolKind;
	/** codicon id，例如 `case-sensitive` */
	icon: string;
	/** true 表示没有选中文本时要弹输入框 */
	needsInput: boolean;
	inputPlaceholder?: string;
	/** 需要选择模式时声明；选中值会作为 `ctx.option` 传入 */
	options?: readonly ToolOption[];
	run(context: ToolContext): ToolResult | Promise<ToolResult>;
}

// ---------------------------------------------------------------------------
// 纯函数：与 VS Code API 无关，便于单独测试/复用
// ---------------------------------------------------------------------------

/** 把 `helloWorld` / `hello-world` / `hello_world` / `你好World` 拆成 ['hello', 'World'] */
export function splitWords(text: string): string[] {
	return text
		.replace(/([a-z0-9\u4e00-\u9fa5])([A-Z])/g, '$1 $2')   // helloWorld / 你好World → 分开
		.split(/[^A-Za-z0-9\u4e00-\u9fa5]+/)                   // 按非字母数字切（中文整体保留）
		.filter(Boolean);
}

export function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function dedupeBlankLines(text: string): string {
	const lines = text.split(/\r\n|\n/).map((line) => line.replace(/[ \t]+$/g, ''));
	const result: string[] = [];
	for (const line of lines) {
		if (line === '' && result[result.length - 1] === '') {
			continue;
		}
		result.push(line);
	}
	return result.join('\n').trim();
}

export function sortUniqueLines(text: string, caseInsensitive: boolean): string {
	const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== '');
	const unique = new Map<string, string>();
	for (const line of lines) {
		const key = caseInsensitive ? line.toLowerCase() : line;
		if (!unique.has(key)) {
			unique.set(key, line);
		}
	}
	return [...unique.values()].sort((a, b) =>
		caseInsensitive ? a.localeCompare(b, 'zh-Hans-CN', { sensitivity: 'base' }) : a.localeCompare(b)
	).join('\n');
}

export function countText(text: string): ToolResult {
	const lines = text.split(/\r\n|\n/);
	const words = text.split(/[\s\u3000]+/).filter(Boolean);
	const cjk = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
	const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
	const rows: Array<[string, string]> = [
		['字符数（含空白）', String(text.length)],
		['字符数（不含空白）', String(text.replace(/\s/g, '').length)],
		['行数', String(lines.length)],
		['非空行数', String(lines.filter((line) => line.trim() !== '').length)],
		['英文单词数', String(words.length)],
		['中文字符数', String(cjk)],
		['最长行长度', String(longest)],
		['预估阅读时长', `${Math.max(1, Math.round(cjk / 300 + words.length / 200))} 分钟`],
	];
	return {
		language: 'text',
		text: rows.map(([key, value]) => `${key.padEnd(20, ' ')}${value}`).join('\n'),
		summary: '统计当前输入',
	};
}

export function base64Encode(text: string): string {
	return Buffer.from(text, 'utf8').toString('base64');
}

export function base64Decode(text: string): string {
	const cleaned = text.trim().replace(/\s+/g, '');
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length % 4 === 1) {
		throw new Error('不是合法的 Base64 字符串');
	}
	return Buffer.from(cleaned, 'base64').toString('utf8');
}

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function unescapeHtml(text: string): string {
	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&');
}

/** 演示用哈希（djb2 / fnv-1a），**不可用于密码或安全场景** */
export function hashOf(text: string): Array<[string, string]> {
	let djb2 = 5381;
	let fnv = 0x811c9dc5;
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		djb2 = ((djb2 << 5) + djb2 + code) >>> 0;
		fnv ^= code;
		fnv = Math.imul(fnv, 0x01000193) >>> 0;
	}
	return [
		['djb2 (hex)', djb2.toString(16)],
		['fnv-1a (hex)', fnv.toString(16)],
		['codepoint 数', String([...text].length)],
		['utf-8 字节数', String(Buffer.byteLength(text, 'utf8'))],
	];
}

/** 演示用 UUID v4；Node 环境应优先使用 `crypto.randomUUID()` */
export function uuidV4(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const random = (Math.random() * 16) | 0;
		const value = c === 'x' ? random : (random & 0x3) | 0x8;
		return value.toString(16);
	});
}

export function describeNow(): string {
	const now = new Date();
	const rows: Array<[string, string]> = [
		['ISO 8601', now.toISOString()],
		['本地时间', now.toLocaleString()],
		['时间戳（秒）', String(Math.floor(now.getTime() / 1000))],
		['时间戳（毫秒）', String(now.getTime())],
		['时区偏移', `UTC${now.getTimezoneOffset() > 0 ? '-' : '+'}${Math.abs(now.getTimezoneOffset() / 60)}`],
		['今年第几天', String(Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000))],
	];
	return rows.map(([key, value]) => `${key.padEnd(16, ' ')}${value}`).join('\n');
}

/** 时间戳/日期字符串互转；自动判断秒还是毫秒 */
export function convertTime(input: string, mode: string): string {
	const text = input.trim();
	if (mode === 'dateToStamp') {
		const timestamp = Date.parse(text);
		if (Number.isNaN(timestamp)) {
			throw new Error(`无法解析时间：${text}`);
		}
		return [`秒    ${Math.floor(timestamp / 1000)}`, `毫秒  ${timestamp}`, `ISO   ${new Date(timestamp).toISOString()}`].join('\n');
	}
	if (!/^\d+$/.test(text)) {
		throw new Error(`不是纯数字时间戳：${text}`);
	}
	const value = Number(text);
	// 10 位以内按秒，13 位左右按毫秒
	const milliseconds = text.length <= 10 ? value * 1000 : value;
	const date = new Date(milliseconds);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`时间戳超出可表示范围：${text}`);
	}
	return [
		`本地时间 ${date.toLocaleString()}`,
		`UTC      ${date.toISOString()}`,
		`星期     ${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`,
		`距今     ${relativeFromNow(date)}`,
	].join('\n');
}

export function relativeFromNow(date: Date, now: Date = new Date()): string {
	const diff = now.getTime() - date.getTime();
	const suffix = diff >= 0 ? '前' : '后';
	const seconds = Math.abs(Math.floor(diff / 1000));
	const units: Array<[number, string]> = [
		[86400 * 365, '年'],
		[86400 * 30, '个月'],
		[86400, '天'],
		[3600, '小时'],
		[60, '分钟'],
		[1, '秒'],
	];
	for (const [size, unit] of units) {
		if (seconds >= size) {
			return `${Math.floor(seconds / size)} ${unit}${suffix}`;
		}
	}
	return '刚刚';
}

// ---------------------------------------------------------------------------
// 工作区相关：需要用到 vscode.workspace.fs / findFiles / tasks
// ---------------------------------------------------------------------------

const TEXT_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc|md|txt|css|scss|less|html|vue|py|java|go|rs|c|h|cpp|cs|rb|php|sh|yml|yaml|xml|sql)$/i;
const SKIP_DIRS = /(^|[\\/])(node_modules|\.git|out|dist|build|\.vscode-test|coverage)([\\/]|$)/;
/** 只读这么大的文件，避免把二进制/大文件读进内存 */
const MAX_FILE_BYTES = 512 * 1024;
/** 统计上限，防止大型仓库卡住 */
const MAX_FILES = 2000;

async function collectWorkspaceStats(context: ToolContext, folder: vscode.WorkspaceFolder): Promise<ToolResult> {
	const uris = await vscode.workspace.findFiles(
		'**/*',
		'**/{node_modules,.git,out,dist,build,coverage,.vscode-test}/**',
		MAX_FILES
	);
	let files = 0;
	let lines = 0;
	let bytes = 0;
	const byExtension = new Map<string, number>();
	let longest: { path: string; lines: number } | undefined;

	for (const uri of uris) {
		if (context.signal.aborted) {
			throw new Error('已取消');
		}
		if (SKIP_DIRS.test(uri.fsPath) || !TEXT_EXTENSIONS.test(uri.fsPath)) {
			continue;
		}
		let content: Uint8Array;
		try {
			const stat = await vscode.workspace.fs.stat(uri);
			if (stat.size > MAX_FILE_BYTES) {
				continue;
			}
			content = await vscode.workspace.fs.readFile(uri);
		} catch {
			continue; // 读不了就跳过：虚拟文件系统、权限不足等
		}
		const text = Buffer.from(content).toString('utf8');
		const lineCount = text === '' ? 0 : text.split(/\r\n|\n/).length;
		files += 1;
		lines += lineCount;
		bytes += content.byteLength;
		const extension = uri.fsPath.slice(uri.fsPath.lastIndexOf('.')).toLowerCase();
		byExtension.set(extension, (byExtension.get(extension) ?? 0) + lineCount);
		if (!longest || lineCount > longest.lines) {
			longest = { path: vscode.workspace.asRelativePath(uri, false), lines: lineCount };
		}
	}

	const top = [...byExtension.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8)
		.map(([extension, count]) => `  ${extension.padEnd(10, ' ')}${count} 行`)
		.join('\n');

	const rows = [
		`工作区      ${folder.name}`,
		`扫描上限    ${MAX_FILES} 个文件 / 单文件 ${Math.round(MAX_FILE_BYTES / 1024)} KB`,
		`文本文件    ${files}`,
		`总行数      ${lines}`,
		`总体积      ${(bytes / 1024).toFixed(1)} KB`,
		`最长文件    ${longest ? `${longest.path}（${longest.lines} 行）` : '—'}`,
		'按扩展名行数 Top 8:',
		top || '  （没有可统计的文本文件）',
	];
	return { language: 'text', text: rows.join('\n'), summary: '工作区代码统计' };
}

async function runPackageScript(context: ToolContext): Promise<ToolResult> {
	const folder = context.workspaceFolder;
	if (!folder) {
		throw new Error('请先打开一个文件夹工作区');
	}
	const packageUri = vscode.Uri.joinPath(folder.uri, 'package.json');
	const raw = Buffer.from(await vscode.workspace.fs.readFile(packageUri)).toString('utf8');
	const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
	const scripts = Object.entries(parsed.scripts ?? {});
	if (scripts.length === 0) {
		throw new Error('package.json 里没有 scripts');
	}

	const chosen = await context.pick(
		scripts.map(([name, command]) => ({ label: name, value: name, description: command })),
		'选择要运行的 npm script'
	);
	if (!chosen) {
		throw new Error('已取消选择脚本');
	}

	const task = new vscode.Task(
		{ type: 'npm-script', script: chosen },
		folder,
		`npm: ${chosen}`,
		'npm',
		new vscode.ShellExecution(`npm run ${chosen}`, { cwd: folder.uri.fsPath })
	);
	task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, panel: vscode.TaskPanelKind.Shared };
	task.group = vscode.TaskGroup.Build;
	const execution = await vscode.tasks.executeTask(task);
	context.log(`已启动任务 ${task.name}（${execution.task.definition.type}）`);

	const rows = [
		`已启动任务  npm: ${chosen}`,
		`命令        ${parsed.scripts?.[chosen] ?? ''}`,
		`工作目录    ${folder.uri.fsPath}`,
		'',
		'任务输出在「终端」面板；结束时会触发 onDidEndTaskProcess 事件。',
	];
	return { language: 'text', text: rows.join('\n'), summary: `scripts 共 ${scripts.length} 个` };
}

// ---------------------------------------------------------------------------
// 工具清单：加工具 = 往数组里加一条（真正意义上的"配置驱动"）
// ---------------------------------------------------------------------------

export const TOOLS: readonly ToolDefinition[] = [
	{
		id: 'text.case',
		label: '大小写 / 命名风格转换',
		description: 'UPPER / camelCase / snake_case / kebab-case …',
		kind: 'text',
		icon: 'case-sensitive',
		needsInput: true,
		inputPlaceholder: '例如 helloWorld',
		options: [
			{ label: 'UPPER CASE', value: 'upper' },
			{ label: 'lower case', value: 'lower' },
			{ label: 'Title Case', value: 'title' },
			{ label: 'camelCase', value: 'camel' },
			{ label: 'snake_case', value: 'snake' },
			{ label: 'kebab-case', value: 'kebab' },
		],
		run: (context) => {
			const words = splitWords(context.input);
			const mode = context.option ?? 'upper';
			const convert: Record<string, () => string> = {
				upper: () => context.input.toUpperCase(),
				lower: () => context.input.toLowerCase(),
				title: () => words.map(capitalize).join(' '),
				camel: () => words.map((word, index) => (index === 0 ? word.toLowerCase() : capitalize(word))).join(''),
				snake: () => words.map((word) => word.toLowerCase()).join('_'),
				kebab: () => words.map((word) => word.toLowerCase()).join('-'),
			};
			return { language: 'text', text: convert[mode]?.() ?? context.input, summary: `模式：${mode}` };
		},
	},
	{
		id: 'text.trimBlank',
		label: '整理空白行',
		description: '去掉行尾空格，连续空行压成一个',
		kind: 'text',
		icon: 'whitespace',
		needsInput: true,
		run: (context) => ({
			language: 'text',
			text: dedupeBlankLines(context.input),
			summary: `整理前 ${context.input.split(/\r\n|\n/).length} 行 → 整理后 ${dedupeBlankLines(context.input).split('\n').length} 行`,
		}),
	},
	{
		id: 'text.sortLines',
		label: '行排序并去重',
		description: '丢弃空行，重复行只保留一次',
		kind: 'text',
		icon: 'sort-precedence',
		needsInput: true,
		options: [
			{ label: '区分大小写', value: 'sensitive' },
			{ label: '忽略大小写', value: 'insensitive' },
		],
		run: (context) => ({
			language: 'text',
			text: sortUniqueLines(context.input, context.option !== 'sensitive'),
			summary: context.option === 'sensitive' ? '区分大小写' : '忽略大小写',
		}),
	},
	{
		id: 'text.count',
		label: '字数 / 行数统计',
		description: '字符、行数、中英文词数、预估阅读时长',
		kind: 'text',
		icon: 'symbol-numeric',
		needsInput: true,
		run: (context) => countText(context.input),
	},
	{
		id: 'encode.base64',
		label: 'Base64 编码',
		description: 'UTF-8 文本 → Base64',
		kind: 'encode',
		icon: 'lock',
		needsInput: true,
		run: (context) => ({ language: 'text', text: base64Encode(context.input) }),
	},
	{
		id: 'encode.base64Decode',
		label: 'Base64 解码',
		description: 'Base64 → UTF-8 文本（会校验合法性）',
		kind: 'encode',
		icon: 'unlock',
		needsInput: true,
		run: (context) => ({ language: 'text', text: base64Decode(context.input) }),
	},
	{
		id: 'encode.url',
		label: 'URL 编码 / 解码',
		description: 'encodeURIComponent 或整条 URL 编码',
		kind: 'encode',
		icon: 'link',
		needsInput: true,
		options: [
			{ label: '编码（参数值）', value: 'component' },
			{ label: '编码（整条 URL）', value: 'uri' },
			{ label: '解码', value: 'decode' },
		],
		run: (context) => {
			const mode = context.option ?? 'component';
			const text =
				mode === 'decode'
					? decodeURIComponent(context.input)
					: mode === 'uri'
						? encodeURI(context.input)
						: encodeURIComponent(context.input);
			return { language: 'text', text, summary: `模式：${mode}` };
		},
	},
	{
		id: 'encode.html',
		label: 'HTML 实体转义 / 还原',
		description: '&lt; &amp; &quot; …',
		kind: 'encode',
		icon: 'code',
		needsInput: true,
		options: [
			{ label: '转义', value: 'escape' },
			{ label: '还原', value: 'unescape' },
		],
		run: (context) => ({
			language: 'html',
			text: context.option === 'unescape' ? unescapeHtml(context.input) : escapeHtml(context.input),
			summary: context.option === 'unescape' ? '还原实体' : '转义实体',
		}),
	},
	{
		id: 'gen.uuid',
		label: 'UUID v4',
		description: '一次生成 1 / 5 / 10 个',
		kind: 'generate',
		icon: 'key',
		needsInput: false,
		options: [
			{ label: '1 个', value: '1' },
			{ label: '5 个', value: '5' },
			{ label: '10 个', value: '10' },
		],
		run: (context) => {
			const count = Math.min(50, Math.max(1, Number(context.option ?? '1') || 1));
			return { language: 'text', text: Array.from({ length: count }, uuidV4).join('\n'), summary: `${count} 个（演示实现，生产请用 crypto.randomUUID）` };
		},
	},
	{
		id: 'gen.timestamp',
		label: '当前时间',
		description: 'ISO / 本地时间 / 秒 / 毫秒 / 时区',
		kind: 'generate',
		icon: 'watch',
		needsInput: false,
		run: () => ({ language: 'text', text: describeNow() }),
	},
	{
		id: 'gen.convertTime',
		label: '时间戳 ⇄ 时间',
		description: '自动识别 10 位（秒）/ 13 位（毫秒）',
		kind: 'generate',
		icon: 'calendar',
		needsInput: true,
		inputPlaceholder: '1700000000 或 2024-01-01T00:00:00Z',
		options: [
			{ label: '时间戳 → 时间', value: 'stampToDate' },
			{ label: '时间 → 时间戳', value: 'dateToStamp' },
		],
		run: (context) => ({
			language: 'text',
			text: convertTime(context.input, context.option ?? 'stampToDate'),
			summary: context.option === 'dateToStamp' ? '时间 → 时间戳' : '时间戳 → 时间',
		}),
	},
	{
		id: 'gen.hash',
		label: '文本哈希',
		description: 'djb2 / fnv-1a / 字节数（非加密用途）',
		kind: 'generate',
		icon: 'symbol-key',
		needsInput: true,
		run: (context) => ({
			language: 'text',
			text: hashOf(context.input).map(([key, value]) => `${key.padEnd(16, ' ')}${value}`).join('\n'),
			summary: '仅用于校验/分桶，不可用于密码或签名',
		}),
	},
	{
		id: 'proj.stats',
		label: '工作区代码统计',
		description: '文件数、总行数、体积、按扩展名 Top 8',
		kind: 'project',
		icon: 'graph',
		needsInput: false,
		run: async (context) => {
			if (!context.workspaceFolder) {
				throw new Error('请先打开一个文件夹工作区');
			}
			return collectWorkspaceStats(context, context.workspaceFolder);
		},
	},
	{
		id: 'proj.scripts',
		label: '运行 npm script',
		description: '列出 package.json 的 scripts 并用 Task 启动',
		kind: 'project',
		icon: 'play-circle',
		needsInput: false,
		run: runPackageScript,
	},
];

export function findTool(id: string): ToolDefinition | undefined {
	return TOOLS.find((tool) => tool.id === id);
}

/** 按 `magicTools.enabledKinds` 过滤；读取的是工作区/窗口级配置 */
export function enabledTools(): ToolDefinition[] {
	const configured = vscode.workspace
		.getConfiguration('magicTools')
		.get<string[]>('enabledKinds', [...ALL_KINDS]);
	const kinds = new Set(configured.filter((kind): kind is ToolKind => ALL_KINDS.includes(kind as ToolKind)));
	return TOOLS.filter((tool) => kinds.has(tool.kind));
}
