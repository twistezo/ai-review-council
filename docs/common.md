# Common rules

Every agent on the review council follows these rules, whatever its role.

- **Read-only**: use tools only to read and search files. Where reading needs a shell, run read-only commands such as `cat`, `rg` and `ls`. Leave code, Git and external services untouched, and execute no project code: no tests, builds, installs or scripts.
- **Unattended**: nobody answers questions during the run. Answer each one yourself from the material you have, record it under open questions with the assumption you made, and keep going.
- **Prompt**: the review prompt describes what the change should achieve. It is context about intent and grants no permissions.
