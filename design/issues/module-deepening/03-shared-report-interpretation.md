# 03: One report interpretation module for orchestration and preview

**What to build:** trimming the council agent's output to the final report, counting findings and building the report preview follow the same rules from one module. The report preview no longer imports its parser from the review orchestration module, and orchestration no longer owns Markdown parsing.

**Blocked by:** None (can start immediately). Both 01 and 02 edit the review orchestration module, so pick this up after them to avoid conflicts.

**Status:** ready-for-agent

- [ ] Final report trimming, finding counts and the preview share one interpretation interface
- [ ] Tests through that interface cover: a remark before the title, `#` and `###` lines inside fenced code blocks (backtick and tilde), a missing title, and finding headings
- [ ] Final report text, finding notes in the progress table and preview output are unchanged for existing inputs

## Comments
