import * as vscode from 'vscode';

/** 认证提供者 id：其它扩展用 vscode.authentication.getSession('demoAuth', ...) 来消费 */
const PROVIDER_ID = 'demoAuth';
const PROVIDER_LABEL = 'Demo 认证';
const SESSIONS_KEY = 'demoAuth.sessions';

export async function activate(context: vscode.ExtensionContext) {
	// ---------------- 1. 注册认证提供者 ----------------
	// 注册后，VS Code 的「账户」菜单里会出现这个提供者，
	// 其它扩展也能通过 vscode.authentication.getSession('demoAuth', ...) 请求会话。
	const provider = new DemoAuthenticationProvider(context);
	context.subscriptions.push(
		vscode.authentication.registerAuthenticationProvider(PROVIDER_ID, PROVIDER_LABEL, provider, {
			supportsMultipleAccounts: false,
		}),
		provider
	);

	// ---------------- 2. 消费会话 ----------------
	context.subscriptions.push(
		vscode.commands.registerCommand('demoAuth.signIn', async () => {
			// createIfNone: true —— 没有会话时弹出「是否允许扩展登录」的确认框
			const session = await vscode.authentication.getSession(PROVIDER_ID, ['read'], {
				createIfNone: true,
			});
			if (session) {
				void vscode.window.showInformationMessage(
					`已登录：${session.account.label}（token 前 8 位：${session.accessToken.slice(0, 8)}...）`
				);
			}
		}),

		vscode.commands.registerCommand('demoAuth.showAccounts', async () => {
			const accounts = await vscode.authentication.getAccounts(PROVIDER_ID);
			void vscode.window.showInformationMessage(
				accounts.length > 0 ? `已有账号：${accounts.map((a) => a.label).join('、')}` : '暂无账号'
			);
		}),

		vscode.commands.registerCommand('demoAuth.signOut', async () => {
			// silent: true —— 不弹确认框，直接取已有的会话
			const session = await vscode.authentication.getSession(PROVIDER_ID, ['read'], { silent: true });
			if (!session) {
				void vscode.window.showWarningMessage('当前没有会话，无需退出');
				return;
			}
			await provider.removeSession(session.id);
			void vscode.window.showInformationMessage('已退出登录');
		})
	);

	// ---------------- 3. 会话变化事件 ----------------
	context.subscriptions.push(
		vscode.authentication.onDidChangeSessions((event) => {
			if (event.provider.id !== PROVIDER_ID) {
				return;
			}
			// 注意：消费侧的事件只给 provider 信息（没有 added/removed/changed）
			// 增量的 added/removed/changed 只出现在提供者侧的事件里（见下）
			console.log(`[demoAuth] 提供者 ${event.provider.label} 的会话发生变化`);
		})
	);
}

export function deactivate() {}

/**
 * 一个"假"的认证提供者：真实现里 createSession 应该走 OAuth / 设备码流程，
 * 这里直接返回一个本地生成的 token，用来演示完整的会话生命周期。
 */
class DemoAuthenticationProvider implements vscode.AuthenticationProvider {
	private readonly _onDidChangeSessions = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	readonly onDidChangeSessions: vscode.Event<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent> =
		this._onDidChangeSessions.event;

	private sessions: vscode.AuthenticationSession[] = [];

	constructor(private readonly context: vscode.ExtensionContext) {
		// 会话是敏感数据，应该放 secrets，而不是 globalState
		void this.context.secrets.get(SESSIONS_KEY).then((raw) => {
			if (raw) {
				this.sessions = JSON.parse(raw) as vscode.AuthenticationSession[];
			}
		});
	}

	getSessions(_scopes?: readonly string[]): Thenable<vscode.AuthenticationSession[]> {
		return Promise.resolve(this.sessions);
	}

	async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
		const session: vscode.AuthenticationSession = {
			id: `demo-${Date.now()}`,
			accessToken: `demo-token-${Math.random().toString(36).slice(2, 10)}`,
			account: { id: 'demo-user', label: 'Demo 用户' },
			scopes: [...scopes],
		};

		this.sessions = [...this.sessions, session];
		await this.persist();
		// 必须 fire 事件，否则 VS Code 不知道会话变了
		this._onDidChangeSessions.fire({ added: [session], removed: [], changed: [] });
		return session;
	}

	async removeSession(sessionId: string): Promise<void> {
		const removed = this.sessions.find((session) => session.id === sessionId);
		this.sessions = this.sessions.filter((session) => session.id !== sessionId);
		await this.persist();
		if (removed) {
			this._onDidChangeSessions.fire({ added: [], removed: [removed], changed: [] });
		}
	}

	dispose(): void {
		this._onDidChangeSessions.dispose();
	}

	private async persist(): Promise<void> {
		await this.context.secrets.store(SESSIONS_KEY, JSON.stringify(this.sessions));
	}
}
