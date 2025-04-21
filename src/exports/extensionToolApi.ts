import * as vscode from "vscode"
import { EventEmitter } from "node:events"
import { ExtensionTool, ExtensionToolAPI, ExtensionToolEventName, ExtensionToolEvents } from "./extensionTools"

/**
 * Implementation of the Extension Tool API
 */
export class ExtensionToolManager extends EventEmitter<ExtensionToolEvents> implements ExtensionToolAPI {
	private tools: Map<string, Map<string, ExtensionTool>> = new Map()
	private static instance: ExtensionToolManager | null = null

	/**
	 * Get the singleton instance of ExtensionToolManager
	 */
	public static getInstance(): ExtensionToolManager {
		if (!ExtensionToolManager.instance) {
			ExtensionToolManager.instance = new ExtensionToolManager()
		}
		return ExtensionToolManager.instance
	}

	/**
	 * Private constructor to enforce singleton pattern
	 */
	private constructor() {
		super()
	}

	/**
	 * Register a tool from an extension
	 */
	public registerTool(extensionId: string, tool: ExtensionTool): void {
		if (!this.tools.has(extensionId)) {
			this.tools.set(extensionId, new Map())
		}

		const extensionTools = this.tools.get(extensionId)!
		extensionTools.set(tool.name, tool)

		// Emit event
		this.emit(ExtensionToolEventName.ToolRegistered, extensionId, tool.name)

		console.log(`Registered tool '${tool.name}' from extension '${extensionId}'`)
	}

	/**
	 * Unregister a tool
	 */
	public unregisterTool(extensionId: string, toolName: string): void {
		const extensionTools = this.tools.get(extensionId)
		if (extensionTools && extensionTools.has(toolName)) {
			extensionTools.delete(toolName)

			// Emit event
			this.emit(ExtensionToolEventName.ToolUnregistered, extensionId, toolName)

			console.log(`Unregistered tool '${toolName}' from extension '${extensionId}'`)
		}
	}

	/**
	 * Unregister all tools from an extension
	 */
	public unregisterAllTools(extensionId: string): void {
		const extensionTools = this.tools.get(extensionId)
		if (extensionTools) {
			// Create a copy of the keys to avoid issues during iteration
			const toolNames = [...extensionTools.keys()]

			toolNames.forEach((toolName) => {
				this.unregisterTool(extensionId, toolName)
			})

			// Clean up the map
			this.tools.delete(extensionId)

			console.log(`Unregistered all tools from extension '${extensionId}'`)
		}
	}

	/**
	 * Get all tools registered by an extension
	 */
	public getRegisteredTools(extensionId: string): string[] {
		const extensionTools = this.tools.get(extensionId)
		if (!extensionTools) {
			return []
		}
		return [...extensionTools.keys()]
	}

	/**
	 * Check if a tool is registered
	 */
	public isToolRegistered(extensionId: string, toolName: string): boolean {
		const extensionTools = this.tools.get(extensionId)
		return !!extensionTools && extensionTools.has(toolName)
	}

	/**
	 * Execute a tool by extension ID and tool name
	 * @param extensionId ID of the extension that registered the tool
	 * @param toolName Name of the tool to execute
	 * @param args Arguments to pass to the tool
	 * @returns Tool execution result
	 */
	public async executeExtensionTool(extensionId: string, toolName: string, args?: Record<string, unknown>) {
		const extensionTools = this.tools.get(extensionId)
		if (!extensionTools) {
			throw new Error(`No tools registered for extension '${extensionId}'`)
		}

		const tool = extensionTools.get(toolName)
		if (!tool) {
			throw new Error(`Tool '${toolName}' not found for extension '${extensionId}'`)
		}

		try {
			return await tool.execute(args)
		} catch (error) {
			console.error(`Error executing tool '${toolName}' from extension '${extensionId}':`, error)
			return {
				content: [
					{
						type: "text",
						text: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	}

	/**
	 * Get all registered tools as a flat array
	 */
	public getAllTools(): { extensionId: string; tool: ExtensionTool }[] {
		const allTools: { extensionId: string; tool: ExtensionTool }[] = []

		for (const [extensionId, toolMap] of this.tools.entries()) {
			for (const [_, tool] of toolMap.entries()) {
				allTools.push({ extensionId, tool })
			}
		}

		return allTools
	}
}
