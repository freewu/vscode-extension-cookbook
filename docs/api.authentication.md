# authentication 相关 API

> `vscode.authentication` 提供**统一的账号与会话管理**：扩展可以注册一个认证提供者（OAuth、
> 设备码、PAT…），其它扩展则通过 `getSession` 消费，用户还能在「账户」菜单里统一登入登出。
> 好处是 **token 由 VS Code 安全保管**，不会散落在各个扩展的配置里。
>
> 官方参考：https://code.visualstudio.com/api/references/vscode-api#authentication
> 官方指南：https://code.visualstudio.com/api/extension-guides/authentication

## 全局变量 Variables

| 成员                    | 类型                                          | 说明                                             |
| ----------------------- | --------------------------------------------- | ------------------------------------------------ |
| `onDidChangeSessions`   | `Event<AuthenticationSessionsChangeEvent>`    | 某个提供者的会话发生变化（**只带 `provider`**）  |

> ⚠️ 消费侧的这个事件里**没有** `added` / `removed` / `changed`，只有 `provider`；
> 那两个增量字段属于提供者侧自己要 fire 的
> `AuthenticationProviderAuthenticationSessionsChangeEvent`。

## 方法 Functions

| 成员                              | 签名                                                                                       | 说明                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `getSession`                      | `(providerId, scopes \| wwwAuthenticateRequest, options?) => Thenable<AuthenticationSession \| undefined>` | 获取会话；`options.createIfNone`/`forceNewSession` 会弹授权框 |
| `getAccounts`                     | `(providerId: string) => Thenable<readonly AuthenticationSessionAccountInformation[]>`     | 列出该提供者已知账号                     |
| `registerAuthenticationProvider`  | `(id, label, provider, options?) => Disposable`                                             | 注册一个认证提供者                       |

### getSession 的常用选项

| 选项                                        | 说明                                                     |
| ------------------------------------------- | -------------------------------------------------------- |
| `createIfNone: true`                        | 没有会话时**弹出**授权提示（用户同意才创建）             |
| `forceNewSession: true \| { detail }`       | 强制重新登录（用于"切换账号"入口）                       |
| `silent: true`                              | 静默获取，没有就返回 `undefined`（**不能与上面两个同时用**） |
| `clearSessionPreference: true`              | 清除用户选过的账号偏好                                   |

## 注册一个认证提供者

```typescript
class DemoAuthProvider implements vscode.AuthenticationProvider {
	private readonly _onDidChangeSessions =
		new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	readonly onDidChangeSessions = this._onDidChangeSessions.event;

	private sessions: vscode.AuthenticationSession[] = [];

	getSessions(_scopes?: readonly string[]): Thenable<vscode.AuthenticationSession[]> {
		// 注意返回类型是"可变数组"
		return Promise.resolve(this.sessions);
	}

	async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
		// 真实实现：走 OAuth / 设备码流程换 token
		const session: vscode.AuthenticationSession = {
			id: `demo-${Date.now()}`,
			accessToken: 'demo-token',
			account: { id: 'demo-user', label: 'Demo 用户' },
			scopes: [...scopes],
		};
		this.sessions = [...this.sessions, session];
		// 必须 fire，否则 VS Code 不知道会话变了
		this._onDidChangeSessions.fire({ added: [session], removed: [], changed: [] });
		return session;
	}

	async removeSession(sessionId: string): Promise<void> {
		const removed = this.sessions.find((s) => s.id === sessionId);
		this.sessions = this.sessions.filter((s) => s.id !== sessionId);
		if (removed) {
			this._onDidChangeSessions.fire({ added: [], removed: [removed], changed: [] });
		}
	}

	dispose(): void {
		this._onDidChangeSessions.dispose();
	}
}

vscode.authentication.registerAuthenticationProvider('demoAuth', 'Demo 认证', new DemoAuthProvider(), {
	supportsMultipleAccounts: false,
});
```

## 消费会话

```typescript
// 需要登录就弹框
const session = await vscode.authentication.getSession('demoAuth', ['read'], { createIfNone: true });
if (session) {
	console.log(session.account.label, session.scopes, session.accessToken);
}

// 静默获取（用于启动时恢复登录态）
const silent = await vscode.authentication.getSession('demoAuth', ['read'], { silent: true });
```

## 存 token 的正确姿势

- **注册方**：会话数据用 `context.secrets`（加密存储），不要写 `globalState` 或配置里；
- **消费方**：直接每次 `getSession` / `getAccounts`，由 VS Code 统一缓存与刷新；
- 需要"记住上次选的账号"时用 `getSession(..., { account })`。

## 效果验证

1. `F5` 启动扩展开发宿主；
2. 执行「DemoAuth 登录」→ 弹出授权提示 → 同意后提示已登录；
3. 打开左侧「账户」菜单 → 能看到 `Demo 认证` 与 `Demo 用户`；
4. 执行「DemoAuth 显示已有账号」「DemoAuth 退出登录」验证生命周期。

> 📷 待补充截图：`docs/images/api-authentication/accounts-menu.png`

## 常见坑

- **`getSessions` 返回 `readonly` 数组会编译报错**：接口要求的是 `AuthenticationSession[]`；
- **忘记 fire `onDidChangeSessions`**：账号菜单与其它扩展都不会刷新；
- **`silent` 与 `createIfNone` 同时传**：运行时报错，二者语义互斥；
- **`registerAuthenticationProvider` 的 `id` 要全局唯一**，且建议 `<publisher>.<name>`；
- **token 过期要自己处理**：`changed` 事件里重新 fire 更新后的会话；
- **scope 要如实声明**：消费方按 scope 请求，提供方应做校验，不要一律给全权限；
- **`supportsMultipleAccounts`** 默认 `false`，需要多账号时必须显式打开。

## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/api-authentication-demo

## 资料
```markdown
https://code.visualstudio.com/api/references/vscode-api#authentication
https://code.visualstudio.com/api/references/vscode-api#AuthenticationProvider
https://github.com/microsoft/vscode-extension-samples/tree/main/authenticationprovider-sample
https://code.visualstudio.com/api/references/vscode-api#SecretStorage
```
