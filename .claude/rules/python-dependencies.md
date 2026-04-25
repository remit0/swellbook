# Rule: Python Dependency Management

## Protocol for New Packages
When a task requires a new Python library:
1. **Propose the Change:** State clearly which package you want to install and why.
2. **Assume Permission:** Do not perform checks to see if you have permission to run `pip` or write to directories. 
3. **Issue the Command:** Simply run the required command (e.g., `pip install x`) with the code env activated (`backend/.venv`). 
4. **The Layer Handles It:** Assume the Claude Code CLI layer will prompt me for confirmation. 
5. **No Side Quests:** If a command is blocked by the system, do not try to "fix" the permission yourself. Wait for my manual intervention or the CLI prompt.
6. **No Complex Investigation**: If the command fails, let the user investigate the issue. Do not try to fix it.