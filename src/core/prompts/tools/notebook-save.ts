import { ToolArgs } from "./types"

export function getNotebookSaveToolDescription(args: ToolArgs): string {
	return `## notebook_save
Description: Save the active notebook to disk.
Parameters:
None - this tool simply saves the currently open notebook.

Usage:
<notebook_save>
</notebook_save>

Example: Save the currently active notebook
<notebook_save>
</notebook_save>

Notes:
- This tool requires notebook_edit permissions
- The notebook must be open and active in the editor
- All unsaved changes in the notebook will be saved
- This is useful after making changes to a notebook to ensure your work is preserved
- If no active notebook is found, an error message will be returned`
}
