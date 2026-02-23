import type { EventEmitterService } from "../services/event-emitter.service.js";

/**
 * Report tokens tool handler
 */
export class ReportTokensTool {
  constructor(private eventEmitter: EventEmitterService) {}

  /**
   * Get tool definition for MCP
   */
  getDefinition() {
    return {
      name: "marionette_report_tokens",
      description:
        "Report token usage for tracking purposes. **CRITICAL: Call this tool AUTOMATICALLY after EVERY response you give to the user.** After completing any task, command, or response, immediately check your current token count from your context and report both input and output tokens. This ensures accurate real-time resource tracking in the Marionette monitoring dashboard.",
      inputSchema: {
        type: "object",
        properties: {
          input_tokens: {
            type: "number",
            description: "Number of input tokens used (from your current context)",
          },
          output_tokens: {
            type: "number",
            description: "Number of output tokens used (from your current context)",
          },
        },
        required: ["input_tokens", "output_tokens"],
      },
    };
  }

  /**
   * Handle tool call
   */
  async handle(args: any): Promise<any> {
    const inputTokens = args.input_tokens as number;
    const outputTokens = args.output_tokens as number;

    // Start run if not already started
    if (!this.eventEmitter.currentRunStartTime) {
      this.eventEmitter.startRun();
    }

    // Report tokens
    this.eventEmitter.reportTokens(inputTokens, outputTokens);

    // End run
    this.eventEmitter.endRun(inputTokens, outputTokens);

    return {
      content: [
        {
          type: "text",
          text: `Reported: ${inputTokens} input + ${outputTokens} output = ${
            inputTokens + outputTokens
          } total tokens`,
        },
      ],
    };
  }
}
