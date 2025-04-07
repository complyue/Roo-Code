import { ToolArgs } from "./types"

export function getNotebookEditToolDescription(args: ToolArgs): string {
	return `## notebook_edit
Description: Edit the active notebook in the editor. This tool allows you to insert new cells, append cells to the end, or replace existing cells. Note that new/modified code cells will be executed immediately by default, unless the noexec parameter is true.
Parameters:
- action: (required) The action to perform. Valid values are:
  - "insert_cells": Insert new cells into the notebook (or append to the end if insert_at_index is omitted)
  - "modify_cell_content": Modify the content of existing cells in the notebook (note: this will clear any existing outputs)
  - "replace_cells": Replace a range of cells with new cells (note: this will clear any existing outputs)
  - "delete_cells": Delete a range of cells from the notebook
- cells: (required) A JSON array containing cell definitions. The structure depends on the action:
  - For insert_cells: Array of objects with properties:
    - content: (required) The cell content
    - cell_type: (optional) The type of cell, either "code" or "markdown"
    - language_id: (optional) The language of the cell (e.g., "python", "javascript")
  - For modify_cell_content: Array of objects with properties:
    - index: (required) The index of the cell to modify (0-based)
    - content: (required) The new content for the cell
  - For replace_cells: A single object with properties:
    - start_index: (required) The starting index of the range to replace (0-based, inclusive)
    - end_index: (required) The ending index of the range to replace (0-based, exclusive)
    - cells: (required) Array of objects with properties:
      - content: (required) The cell content
      - cell_type: (optional) The type of cell, either "code" or "markdown"
      - language_id: (optional) The language of the cell (e.g., "python", "javascript")
  - For delete_cells: A single object with properties:
    - start_index: (required) The starting index of the range to delete (0-based, inclusive)
    - end_index: (required) The ending index of the range to delete (0-based, exclusive)
- insert_at_index: (optional, only for insert_cells action) The position to insert cells at (0-based, defaults to end of notebook)
- noexec: (optional) Boolean value to prevent automatic execution of new/modified code cells.
Usage:
<notebook_edit>
<action>action name here</action>
<cells>[JSON array of cell definitions]</cells>
<insert_at_index>index value here (if required)</insert_at_index>
<noexec>true</noexec>
</notebook_edit>

Example 1: Insert multiple cells at index 0
<notebook_edit>
<action>insert_cells</action>
<insert_at_index>0</insert_at_index>
<cells>[
  {
    "cell_type": "markdown",
    "content": "# Data Analysis\nThis notebook contains the analysis of our dataset."
  },
  {
    "cell_type": "code",
    "language_id": "python",
    "content": "import pandas as pd\nimport numpy as np\ndf = pd.read_csv('data.csv')\ndf.head()"
  }
]</cells>
</notebook_edit>

Example 2: Append a new markdown cell (no insert_at_index specified)
<notebook_edit>
<action>insert_cells</action>
<cells>[
  {
    "cell_type": "markdown",
    "content": "# Data Analysis\nThis notebook contains the analysis of our dataset with the following steps:\n1. Data loading and cleaning\n2. Exploratory data analysis\n3. Statistical testing\n4. Visualization"
  }
]</cells>
</notebook_edit>

Example 3: Modify multiple existing cells without execution
<notebook_edit>
<action>modify_cell_content</action>
<cells>[
  {
    "index": 2,
    "content": "import matplotlib.pyplot as plt\nplt.figure(figsize=(10, 6))\nplt.plot(df['x'], df['y'])\nplt.title('Data Visualization')\nplt.xlabel('X Axis')\nplt.ylabel('Y Axis')\nplt.show()"
  },
  {
    "index": 3,
    "content": "# Statistical Analysis\nLet's analyze the correlation between variables."
  }
]</cells>
<noexec>true</noexec>
</notebook_edit>

Example 4: Replace a range of cells with new cells
<notebook_edit>
<action>replace_cells</action>
<cells>{
  "start_index": 2,
  "end_index": 4,
  "cells": [
    {
      "cell_type": "code",
      "language_id": "python",
      "content": "import matplotlib.pyplot as plt\nimport seaborn as sns\n\nplt.figure(figsize=(10, 6))\nsns.scatterplot(x='x', y='y', data=df)\nplt.title('Scatter Plot')\nplt.show()"
    },
    {
      "cell_type": "markdown",
      "content": "## Observations\nThe scatter plot shows a positive correlation between x and y variables."
    }
  ]
}</cells>
</notebook_edit>

Example 5: Delete a range of cells
<notebook_edit>
<action>delete_cells</action>
<cells>{
  "start_index": 2,
  "end_index": 4
}</cells>
</notebook_edit>`
}
