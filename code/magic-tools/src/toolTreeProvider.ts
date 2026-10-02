import * as vscode from 'vscode';
import { KIND_LABELS, ToolDefinition, ToolKind, enabledTools } from './tools';

/** 分组节点：分类本身也是树里的一项 */
interface KindNode {
	type: 'kind';
	kind: ToolKind;
}

/** 叶子节点：一个可运行的工具 */
interface ToolNode {
	type: 'tool';
	tool: ToolDefinition;
}

export type ToolTreeNode = KindNode | ToolNode;

/**
 * 工具清单的树视图提供者。
 *
 * 关键点：
 * - 分类节点只在「该分类下还有启用的工具」时出现，避免配置裁剪后留下空文件夹；
 * - 叶子的 `contextValue` 决定 `view/item/context` 菜单是否出现（when: viewItem == tool）；
 * - 配置变化通过 `onDidChangeTreeData` 触发整棵树重建，不需要自己 diff。
 */
export class ToolTreeProvider implements vscode.TreeDataProvider<ToolTreeNode> {
	private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ToolTreeNode | undefined>();

	readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

	refresh(): void {
		this.onDidChangeTreeDataEmitter.fire(undefined);
	}

	getTreeItem(element: ToolTreeNode): vscode.TreeItem {
		if (element.type === 'kind') {
			const item = new vscode.TreeItem(
				KIND_LABELS[element.kind],
				vscode.TreeItemCollapsibleState.Expanded
			);
			item.id = `kind:${element.kind}`;
			item.contextValue = 'kind';
			item.iconPath = new vscode.ThemeIcon('folder-library');
			return item;
		}

		const { tool } = element;
		const item = new vscode.TreeItem(tool.label, vscode.TreeItemCollapsibleState.None);
		item.id = `tool:${tool.id}`;
		item.description = tool.description;
		item.contextValue = 'tool';
		item.iconPath = new vscode.ThemeIcon(tool.icon);

		// 点击就直接运行：命令里带上工具 id，扩展侧再解析
		item.command = {
			command: 'magicTools.runTool',
			title: '运行工具',
			arguments: [tool.id],
		};

		const tooltip = new vscode.MarkdownString();
		tooltip.appendMarkdown(`**${tool.label}**\n\n${tool.description}\n\n`);
		tooltip.appendMarkdown(`- id: \`${tool.id}\`\n- 分类: ${KIND_LABELS[tool.kind]}\n`);
		if (tool.options?.length) {
			tooltip.appendMarkdown(`- 可选模式: ${tool.options.map((option) => `\`${option.label}\``).join('、')}\n`);
		}
		tooltip.appendMarkdown(`\n$(play) 单击运行`);
		tooltip.supportThemeIcons = true;
		item.tooltip = tooltip;

		return item;
	}

	getChildren(element?: ToolTreeNode): ToolTreeNode[] {
		const tools = enabledTools();
		if (!element) {
			return tools
				.reduce<ToolKind[]>((kinds, tool) => (kinds.includes(tool.kind) ? kinds : [...kinds, tool.kind]), [])
				.map((kind) => ({ type: 'kind', kind }));
		}
		if (element.type === 'kind') {
			return tools.filter((tool) => tool.kind === element.kind).map((tool) => ({ type: 'tool', tool }));
		}
		return [];
	}

	dispose(): void {
		this.onDidChangeTreeDataEmitter.dispose();
	}
}
