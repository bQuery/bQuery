# bQuery workspace prompts

These workspace prompt files are project-specific kickoffs for common bQuery agent tasks.

Use them from chat via `/`, or with **Chat: Run Prompt...**.

## Included prompts

- [`bquery-start-task.prompt.md`](./bquery-start-task.prompt.md) — orient to the repo, map the task, and continue with a concrete plan
- [`bquery-fix-bug.prompt.md`](./bquery-fix-bug.prompt.md) — reproduce a bug, implement the fix, and validate it
- [`bquery-public-api-change.prompt.md`](./bquery-public-api-change.prompt.md) — extend a public API with export, docs, and test wiring
- [`bquery-add-module.prompt.md`](./bquery-add-module.prompt.md) — add a new module or public entry point end to end
- [`bquery-ssr-server-workflow.prompt.md`](./bquery-ssr-server-workflow.prompt.md) — work on runtime-agnostic SSR or backend server features
- [`bquery-ai-guidance-sync.prompt.md`](./bquery-ai-guidance-sync.prompt.md) — refresh AI guidance and release metadata in sync

## Notes

- Prompts are intentionally single-purpose. Persistent repo guidance still lives in [`AGENT.md`](../../AGENT.md) and [`.github/copilot-instructions.md`](../copilot-instructions.md).
- If a prompt touches version, engine, or AI guidance files, finish by running `bun run check:ai-guidance`.
