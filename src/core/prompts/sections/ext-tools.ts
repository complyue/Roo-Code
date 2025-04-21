import { ExtensionToolManager } from "../../../exports/extensionToolApi"

export async function getExtToolsSection(extensionToolManager?: ExtensionToolManager): Promise<string> {
	if (!extensionToolManager) {
		return ""
	}

	const allTools = extensionToolManager.getAllTools()

	const registeredTools =
		allTools.length > 0
			? allTools
					.map(({ extensionId, tool }) => {
						const schemaStr = tool.inputSchema
							? `    Input Schema:
    ${JSON.stringify(tool.inputSchema, null, 2).split("\n").join("\n    ")}`
							: ""

						return `## ${extensionId}

### ${tool.name}
${tool.description}
${schemaStr}`
					})
					.join("\n\n")
			: "(No extension tools currently registered)"

	return `EXTENSION TOOLS

Extension tools are provided by other VS Code extensions to extend your capabilities. These tools can interact with the VS Code ecosystem and provide additional functionality beyond your built-in capabilities.

# Registered Extension Tools

When an extension registers tools, you can use these tools via the \`use_ext_tool\` tool. The tool requires the extension ID, tool name, and any arguments expected by the tool.

${registeredTools}`
}
