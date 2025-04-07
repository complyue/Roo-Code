import type { Cline } from "../Cline"
import type { ClineAsk } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import type { ToolParamName } from "../assistant-message"

type ToolUseBlock = {
	name: string
	params: Record<string, string>
	partial: boolean
}

// Define types for the JSON cell definitions
type CellDefinition = {
	content: string
	cell_type?: string
	language_id?: string
}

type ModifyCellDefinition = {
	index: number
	content: string
}

type ReplaceCellsDefinition = {
	start_index: number
	end_index: number
	cells: CellDefinition[]
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
	const cellsJson: string | undefined = params.cells
	const insertAtIndex: string | undefined = params.insert_at_index
	const noexec: string | undefined = params.noexec

	try {
		if (block.partial) {
			await cline
				.ask(
					"tool",
					JSON.stringify({
						tool: "editNotebook",
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

		if (!cellsJson) {
			cline.consecutiveMistakeCount++
			pushToolResult(await cline.sayAndCreateMissingParamError("notebook_edit", "cells"))
			return
		}

		cline.consecutiveMistakeCount = 0

		// Validate inputs before asking for approval
		let validationError = ""
		let parsedCells: any = null

		try {
			// Use string type assertion to avoid linter errors with removeClosingTag
			parsedCells = JSON.parse(cellsJson.replace(/<\/?cells>/g, ""))
		} catch (e) {
			validationError = `Invalid JSON in cells parameter: ${e instanceof Error ? e.message : String(e)}`
		}

		// Parse insertAtIndex if provided
		let parsedInsertAtIndex: number | undefined = undefined
		if (insertAtIndex !== undefined) {
			if (action !== "insert_cells") {
				validationError = "Parameter insert_at_index is only valid for insert_cells action"
			} else {
				try {
					parsedInsertAtIndex = parseInt(insertAtIndex.replace(/<\/?insert_at_index>/g, ""))
					if (isNaN(parsedInsertAtIndex) || parsedInsertAtIndex < 0) {
						validationError = `Invalid insert_at_index: ${insertAtIndex}. Must be a non-negative integer.`
					}
				} catch (e) {
					validationError = `Invalid insert_at_index: ${insertAtIndex}. Must be a non-negative integer.`
				}
			}
		}

		if (!validationError) {
			switch (action) {
				case "insert_cells": {
					if (!Array.isArray(parsedCells)) {
						validationError = "For insert_cells action, cells must be a JSON array"
					} else if (parsedCells.length === 0) {
						validationError = "For insert_cells action, cells array cannot be empty"
					} else {
					}
					break
				}

				case "modify_cell_content": {
					if (!Array.isArray(parsedCells)) {
						validationError = "For modify_cell_content action, cells must be a JSON array"
					} else if (parsedCells.length === 0) {
						validationError = "For modify_cell_content action, cells array cannot be empty"
					} else {
						// Validate each cell modification
						for (let i = 0; i < parsedCells.length; i++) {
							const cell = parsedCells[i]
							if (cell.index === undefined) {
								validationError = `Cell modification at index ${i} is missing required property: index`
								break
							}
							if (!Number.isInteger(cell.index) || cell.index < 0) {
								validationError = `Cell modification at index ${i} has invalid index: ${cell.index}. Must be a non-negative integer.`
								break
							}
						}
					}
					break
				}

				case "replace_cells": {
					if (typeof parsedCells !== "object" || Array.isArray(parsedCells)) {
						validationError = "For replace_cells action, cells must be a JSON object"
					} else if (parsedCells.start_index === undefined) {
						validationError =
							"For replace_cells action, cells object is missing required property: start_index"
					} else if (parsedCells.end_index === undefined) {
						validationError =
							"For replace_cells action, cells object is missing required property: end_index"
					} else if (!Number.isInteger(parsedCells.start_index) || parsedCells.start_index < 0) {
						validationError = `Invalid start_index: ${parsedCells.start_index}. Must be a non-negative integer.`
					} else if (
						!Number.isInteger(parsedCells.end_index) ||
						parsedCells.end_index <= parsedCells.start_index
					) {
						validationError = `Invalid end_index: ${parsedCells.end_index}. Must be greater than start_index (${parsedCells.start_index}).`
					} else if (!Array.isArray(parsedCells.cells)) {
						validationError = "For replace_cells action, cells.cells must be a JSON array"
					} else if (parsedCells.cells.length === 0) {
						validationError = "For replace_cells action, cells.cells array cannot be empty"
					}
					break
				}

				case "delete_cells": {
					if (typeof parsedCells !== "object" || Array.isArray(parsedCells)) {
						validationError = "For delete_cells action, cells must be a JSON object"
					} else if (parsedCells.start_index === undefined) {
						validationError =
							"For delete_cells action, cells object is missing required property: start_index"
					} else if (parsedCells.end_index === undefined) {
						validationError =
							"For delete_cells action, cells object is missing required property: end_index"
					} else if (!Number.isInteger(parsedCells.start_index) || parsedCells.start_index < 0) {
						validationError = `Invalid start_index: ${parsedCells.start_index}. Must be a non-negative integer.`
					} else if (
						!Number.isInteger(parsedCells.end_index) ||
						parsedCells.end_index <= parsedCells.start_index
					) {
						validationError = `Invalid end_index: ${parsedCells.end_index}. Must be greater than start_index (${parsedCells.start_index}).`
					}
					break
				}

				default:
					validationError = `Unknown action: ${action}. Valid actions for notebook_edit are: insert_cells, modify_cell_content, replace_cells, delete_cells.`
			}
		}

		if (validationError) {
			cline.consecutiveMistakeCount++
			await cline.say("error", validationError)
			pushToolResult(formatResponse.toolError(validationError))
			return
		}

		const approvalProps: any = {
			tool: "editNotebook",
			action: removeClosingTag("action", action),
		}

		// Add cells to approval props
		approvalProps.cells = parsedCells

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
					// Map the parsed cells to the format expected by NotebookService
					const cellDefs = parsedCells.map((cell: CellDefinition) => ({
						content: cell.content,
						cell_type: cell.cell_type,
						language_id: cell.language_id,
					}))

					result = await NotebookService.insertCells(
						cellDefs,
						parsedInsertAtIndex,
						skipExecution,
						maxOutputSize,
						timeoutSeconds,
					)
					break
				}
				case "modify_cell_content": {
					// Handle multiple cell modifications by iterating through them
					const results = []

					for (const cell of parsedCells) {
						const cellIndex = cell.index
						const cellContent = cell.content

						// Create validation callback for this specific cell
						const validateCellIndex = (cellCount: number) => {
							if (cellIndex < 0 || cellIndex >= cellCount) {
								throw new Error(`Invalid index: ${cellIndex}. Valid range is 0-${cellCount - 1}.`)
							}
							return cellIndex
						}

						// Modify the cell
						const result = await NotebookService.modifyCellContent(
							validateCellIndex,
							cellContent,
							skipExecution,
							maxOutputSize,
							timeoutSeconds,
						)

						results.push(result)
					}

					result = results.join("\n")
					break
				}
				case "replace_cells": {
					// Map the parsed cells to the format expected by NotebookService
					const cellDefs = parsedCells.cells.map((cell: CellDefinition) => ({
						content: cell.content,
						cell_type: cell.cell_type,
						language_id: cell.language_id,
					}))

					// Create validation callback that validates indices and cells
					const validateIndicesAndCells = (cellCount: number) => {
						const startIndex = parsedCells.start_index
						const endIndex = parsedCells.end_index

						if (startIndex < 0 || startIndex >= cellCount) {
							throw new Error(`Invalid start_index: ${startIndex}. Valid range is 0-${cellCount - 1}.`)
						}

						if (endIndex <= startIndex || endIndex > cellCount) {
							throw new Error(
								`Invalid end_index: ${endIndex}. Must be > ${startIndex} and <= ${cellCount}.`,
							)
						}

						return {
							startIndex,
							endIndex,
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
				case "delete_cells": {
					// Create validation callback that validates indices
					const validateIndices = (cellCount: number) => {
						const startIndex = parsedCells.start_index
						const endIndex = parsedCells.end_index

						if (startIndex < 0 || startIndex >= cellCount) {
							throw new Error(`Invalid start_index: ${startIndex}. Valid range is 0-${cellCount - 1}.`)
						}

						if (endIndex <= startIndex || endIndex > cellCount) {
							throw new Error(
								`Invalid end_index: ${endIndex}. Must be > ${startIndex} and <= ${cellCount}.`,
							)
						}

						return {
							startIndex,
							endIndex,
						}
					}

					result = await NotebookService.deleteCells(validateIndices)
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
