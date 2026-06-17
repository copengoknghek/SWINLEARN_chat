---
type: "query"
date: "2026-06-11T08:22:48.723597+00:00"
question: "How should future Codex sessions use Graphify and agentmemory in this repo?"
contributor: "graphify"
source_nodes: ["AGENTS.md", "graphify-out/graph.json", ".codex/hooks.json"]
---

# Q: How should future Codex sessions use Graphify and agentmemory in this repo?

## Answer

Use Graphify for current codebase structure, call paths, and file relationships with scoped queries around a 1200-token budget. Use agentmemory for cross-session decisions, unresolved questions, and prior work history. Save only concise graph-derived findings to agentmemory, not full reports or large query outputs. Run graphify update . after code changes.

## Source Nodes

- AGENTS.md
- graphify-out/graph.json
- .codex/hooks.json