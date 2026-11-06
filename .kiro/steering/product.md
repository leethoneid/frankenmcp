# Product Vision — FrankenMCP

## What is FrankenMCP?

**FrankenMCP** is a web application that stitches multiple incompatible MCP (Model Context Protocol) servers together through a dynamic router, enabling users to control their entire business stack from a single chat interface. Instead of connecting five separate MCP servers and overwhelming the agent with 100+ tool definitions, FrankenMCP intelligently routes each request to only the relevant servers and trims unnecessary tool schemas, dramatically reducing context window usage.

The core value proposition: **One chat, multiple servers, zero context waste.**

## Target Users

1. **Solo founders** running lean operations across multiple tools (notes, tasks, documents, web automation)
2. **Developers** building multi-tool AI workflows who need efficient context management
3. **Teams** exploring MCP orchestration patterns for production deployments

## Core Value

- **Context efficiency**: Only load tools relevant to the current intent; trim everything else
- **Zero configuration friction**: Pre-configured demo servers work out-of-the-box with no API keys
- **Transparency**: Live "Monster Lab" dashboard shows per-turn routing decisions, trimming stats, and token savings in real time
- **Extensibility**: Easy to add new MCP servers (stdio, SSE, or Streamable HTTP transports)

## User Story

> "As a solo founder, I have my notes in one tool, tasks in another, and documents in a third. Normally I'd connect all three MCP servers to my AI, and it would drown in 100+ tool definitions, wasting tokens and slowing down responses. With FrankenMCP, I ask one question in the chat, and the router automatically figures out which servers are relevant, loads only those tools, and shows me exactly how much context was saved. I can see my whole business stack working together through one interface."

## Success Criteria

A first-time user can:
1. Open the deployed web app (no registration, no API keys required)
2. See three demo MCP servers already connected (notes, tasks, calculator)
3. Ask a question in the chat and receive an answer
4. View the routing decision: which servers were used, which tools were loaded, which were trimmed, and estimated token savings

This demonstrates the core value within 60 seconds of landing on the page.
