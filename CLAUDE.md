# CLAUDE.md

## Marionette Integration

**Task Tracking**: When starting work on a new task, call the `marionette_set_task` tool with a brief description of what you're working on:

```javascript
// Examples:
"Bug Investigation: Issue with authentication"
"Feature: Add export functionality"
"Research: Understanding the codebase"
```

**Token Tracking**: After completing significant work (every 5-10 messages), report your token usage with `marionette_report_tokens`. Check your current token count from your context and report it:

```javascript
marionette_report_tokens({
  input_tokens: <current input tokens>,
  output_tokens: <current output tokens>
})
```

This helps track your work and resource usage in the Marionette monitoring dashboard.
