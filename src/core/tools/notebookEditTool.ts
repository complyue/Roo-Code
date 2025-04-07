import type { Cline } from "../Cline"
import type { ClineAsk } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { ToolParamName } from "../assistant-message"

type ToolUseBlock = {
	name: string
	params: Record<string, string>
	partial: boolean
}

/**
 * Implementation of the notebook_edit tool
 */
export async function notebookEditTool(
	cline: Cline,
	block: ToolUseBlock,
	askApproval: (type: ClineAsk, partialMessage?: string) => Promise<boolean>,
	handleError: (action: string, error: Error) => Promise<void>,
	pushToolResult: (content: string) => void,
	removeClosingTag: (tag: ToolParamName, text?: string) => string,
) {
	// Create a typed variable to help with type checking
	const params = block.params
	const action: string | undefined = params.action
	const cellIndex: string | undefined = params.cell_index
	const startIndex: string | undefined = params.start_index
	const endIndex: string | undefined = params.end_index
	const cellContent: string | undefined = params.cell_content
	const cellType: string | undefined = params.cell_type
	const languageId: string | undefined = params.language_id
	const noexec: string | undefined = params.noexec

	try {
		if (block.partial) {
			await cline
				.ask(
					"tool",
					JSON.stringify({
						tool: "notebook_edit",
						action: removeClosingTag("action", action),
						content: "",
					}),
					block.partial,
				)
				.catch(() => {})
			return
		}

		if (!action) {
			cline.consecutiveMistakeCount++
			pushToolResult(await cline.sayAndCreateMissingParamError("notebook_edit", "action"))
			return
		}

		cline.consecutiveMistakeCount = 0

		// Validate inputs before asking for approval
		let validationError = ""

		switch (action) {
			case "insert_cells": {
				if (!cellContent) {
					validationError = "Missing required parameter: cell_content"
				}
				break
			}

			case "modify_cell_content":
				if (!cellIndex) {
					validationError = "Missing required parameter: cell_index"
				} else if (!params.cell_content) {
					validationError = "Missing required parameter: cell_content"
				}
				break

			case "replace_cells": {
				if (!startIndex) {
					validationError = "Missing required parameter: start_index"
				} else if (!endIndex) {
					validationError = "Missing required parameter: end_index"
				} else if (!cellContent) {
					validationError = "Missing required parameter: cell_content"
				}
				break
			}

			default:
				validationError = `Unknown action: ${action}. Valid actions for notebook_edit are: insert_cells, modify_cell_content, replace_cells.`
		}

		if (validationError) {
			cline.consecutiveMistakeCount++
			await cline.say("error", validationError)
			pushToolResult(formatResponse.toolError(validationError))
			return
		}

		const approvalProps: any = {
			tool: "notebook_edit",
			action: removeClosingTag("action", action),
		}

		// Add additional properties based on the action
		if (cellIndex) {
			approvalProps.cell_index = parseInt(removeClosingTag("cell_index", cellIndex))
		}
		if (startIndex) {
			approvalProps.start_index = parseInt(removeClosingTag("start_index", startIndex))
		}
		if (endIndex) {
			approvalProps.end_index = parseInt(removeClosingTag("end_index", endIndex))
		}

		// Ask for approval BEFORE executing the operation
		const didApprove = await askApproval("tool", JSON.stringify(approvalProps))
		if (!didApprove) {
			return
		}

		// Now actually execute the operation after approval
		try {
			const { NotebookService } = await import("../../services/notebook")
			let result = ""

			// Convert noexec string parameter to boolean
			// If it presents, means true unless explicitly spelled "false"
			const skipExecution = noexec !== undefined && noexec.toLowerCase() !== "false"

			// Get notebook settings from provider state
			const { notebookMaxOutputSize, notebookTimeoutSeconds } =
				(await cline.providerRef.deref()?.getState()) ?? {}
			const maxOutputSize = notebookMaxOutputSize ?? 2000
			const timeoutSeconds = notebookTimeoutSeconds ?? 30

			switch (action) {
				case "insert_cells": {
					// Create a cell object directly from parameters
					const cellDefs = [
						{
							content: cellContent!,
							cell_type: cellType,
							language_id: languageId,
						},
					]

					const parsedCellIndex = cellIndex ? parseInt(cellIndex) : undefined

					result = await NotebookService.insertCells(
						cellDefs,
						parsedCellIndex,
						skipExecution,
						maxOutputSize,
						timeoutSeconds,
					)
					break
				}
				case "modify_cell_content": {
					// Create validation callback that validates the cell index using snake_case in error messages
					const validateCellIndex = (cellCount: number) => {
						const parsedCellIndex = parseInt(cellIndex!)

						if (parsedCellIndex < 0 || parsedCellIndex >= cellCount) {
							throw new Error(
								`Invalid cell_index: ${parsedCellIndex}. Valid range is 0-${cellCount - 1}.`,
							)
						}

						return parsedCellIndex
					}

					if (cellContent === undefined) {
						throw new Error("cell_content is required for cell modification.")
					}

					result = await NotebookService.modifyCellContent(
						validateCellIndex,
						cellContent!,
						skipExecution,
						maxOutputSize,
						timeoutSeconds,
					)
					break
				}
				case "replace_cells": {
					// Create a cell object directly from parameters
					const cellDefs = [
						{
							content: cellContent!,
							cell_type: cellType,
							language_id: languageId,
						},
					]

					// Create validation callback that validates indices and cells using snake_case in error messages
					const validateIndicesAndCells = (cellCount: number) => {
						const parsedStartIndex = parseInt(startIndex!)
						const parsedEndIndex = parseInt(endIndex!)

						if (parsedStartIndex < 0 || parsedStartIndex >= cellCount) {
							throw new Error(
								`Invalid start_index: ${parsedStartIndex}. Valid range is 0-${cellCount - 1}.`,
							)
						}

						if (parsedEndIndex <= parsedStartIndex || parsedEndIndex > cellCount) {
							throw new Error(
								`Invalid end_index: ${parsedEndIndex}. Must be > ${parsedStartIndex} and <= ${cellCount}.`,
							)
						}

						return {
							startIndex: parsedStartIndex,
							endIndex: parsedEndIndex,
							cells: cellDefs,
						}
					}

					result = await NotebookService.replaceCells(
						validateIndicesAndCells,
						skipExecution,
						maxOutputSize,
						timeoutSeconds,
					)
					break
				}
			}

			pushToolResult(result)
		} catch (error) {
			const errorMsg = `Error executing notebook_edit tool: ${error instanceof Error ? error.message : String(error)}`
			await cline.say("error", errorMsg)
			pushToolResult(formatResponse.toolError(errorMsg))
		}
	} catch (error) {
		await handleError("executing notebook_edit tool", error)
	}
}
