import { describe, it, expect } from "vitest";
import { parseAssistantEvent, toSessionMessage, PHASE_LABELS } from "@/lib/chat-types";
import type { LiveChatMessage } from "@/lib/chat-types";

describe("parseAssistantEvent", () => {
  it("should parse text content blocks", () => {
    const event = {
      message: {
        content: [{ type: "text" as const, text: "Hello, world!" }],
      },
    };

    const result = parseAssistantEvent(event);

    expect(result.text).toBe("Hello, world!");
    expect(result.thinkingContent).toBe("");
    expect(result.toolCalls).toEqual([]);
    expect(result.phase).toBe("responding");
  });

  it("should parse thinking content blocks", () => {
    const event = {
      message: {
        content: [
          { type: "thinking" as const, thinking: "Let me analyze this..." },
        ],
      },
    };

    const result = parseAssistantEvent(event);

    expect(result.text).toBe("");
    expect(result.thinkingContent).toBe("Let me analyze this...");
    expect(result.toolCalls).toEqual([]);
    expect(result.phase).toBe("thinking");
  });

  it("should parse tool_use content blocks", () => {
    const event = {
      message: {
        content: [
          {
            type: "tool_use" as const,
            name: "read_file",
            input: { path: "/tmp/test.txt" },
          },
        ],
      },
    };

    const result = parseAssistantEvent(event);

    expect(result.text).toBe("");
    expect(result.thinkingContent).toBe("");
    expect(result.toolCalls).toEqual([
      { name: "read_file", input: '{"path":"/tmp/test.txt"}' },
    ]);
    expect(result.phase).toBe("tool_use");
  });

  it("should handle tool_use without input", () => {
    const event = {
      message: {
        content: [
          { type: "tool_use" as const, name: "list_files" },
        ],
      },
    };

    const result = parseAssistantEvent(event);

    expect(result.toolCalls).toEqual([
      { name: "list_files", input: undefined },
    ]);
    expect(result.phase).toBe("tool_use");
  });

  it("should concatenate multiple text blocks", () => {
    const event = {
      message: {
        content: [
          { type: "text" as const, text: "Hello " },
          { type: "text" as const, text: "world!" },
        ],
      },
    };

    const result = parseAssistantEvent(event);

    expect(result.text).toBe("Hello world!");
  });

  it("should concatenate multiple thinking blocks", () => {
    const event = {
      message: {
        content: [
          { type: "thinking" as const, thinking: "First thought. " },
          { type: "thinking" as const, thinking: "Second thought." },
        ],
      },
    };

    const result = parseAssistantEvent(event);

    expect(result.thinkingContent).toBe("First thought. Second thought.");
    expect(result.phase).toBe("thinking");
  });

  it("should handle mixed content blocks", () => {
    const event = {
      message: {
        content: [
          { type: "thinking" as const, thinking: "Analyzing..." },
          { type: "text" as const, text: "Here is the result" },
          {
            type: "tool_use" as const,
            name: "write_file",
            input: { path: "/out.txt", content: "done" },
          },
        ],
      },
    };

    const result = parseAssistantEvent(event);

    expect(result.text).toBe("Here is the result");
    expect(result.thinkingContent).toBe("Analyzing...");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("write_file");
    // tool_use takes priority for phase when tool calls are present
    expect(result.phase).toBe("tool_use");
  });

  it("should set phase to 'thinking' when only thinking content is present", () => {
    const event = {
      message: {
        content: [
          { type: "thinking" as const, thinking: "Deep thought" },
        ],
      },
    };

    const result = parseAssistantEvent(event);

    expect(result.phase).toBe("thinking");
  });

  it("should set phase to 'responding' when both thinking and text are present (no tools)", () => {
    const event = {
      message: {
        content: [
          { type: "thinking" as const, thinking: "Hmm..." },
          { type: "text" as const, text: "Answer" },
        ],
      },
    };

    const result = parseAssistantEvent(event);

    // Phase is responding because text is present and no tool calls
    expect(result.phase).toBe("responding");
  });

  it("should return defaults for null message", () => {
    const result = parseAssistantEvent({});

    expect(result.text).toBe("");
    expect(result.thinkingContent).toBe("");
    expect(result.toolCalls).toEqual([]);
    expect(result.phase).toBe("responding");
  });

  it("should return defaults for null content", () => {
    const result = parseAssistantEvent({ message: {} });

    expect(result.text).toBe("");
    expect(result.thinkingContent).toBe("");
    expect(result.toolCalls).toEqual([]);
    expect(result.phase).toBe("responding");
  });

  it("should return defaults when content is not an array", () => {
    const event = {
      message: {
        content: "not an array" as unknown as [],
      },
    };

    const result = parseAssistantEvent(event);

    expect(result.text).toBe("");
    expect(result.thinkingContent).toBe("");
    expect(result.toolCalls).toEqual([]);
    expect(result.phase).toBe("responding");
  });

  it("should return defaults for empty content array", () => {
    const event = {
      message: {
        content: [],
      },
    };

    const result = parseAssistantEvent(event);

    expect(result.text).toBe("");
    expect(result.thinkingContent).toBe("");
    expect(result.toolCalls).toEqual([]);
    expect(result.phase).toBe("responding");
  });

  it("should ignore unknown block types gracefully", () => {
    const event = {
      message: {
        content: [
          { type: "unknown_type" as "text", text: "should be ignored" },
          { type: "text" as const, text: "valid text" },
        ],
      },
    };

    const result = parseAssistantEvent(event);

    // The unknown type falls through the switch without matching
    expect(result.text).toBe("valid text");
    expect(result.phase).toBe("responding");
  });

  it("should trim text output", () => {
    const event = {
      message: {
        content: [
          { type: "text" as const, text: "  spaced text  " },
        ],
      },
    };

    const result = parseAssistantEvent(event);

    expect(result.text).toBe("spaced text");
  });
});

describe("toSessionMessage", () => {
  it("should convert LiveChatMessage to SessionMessage", () => {
    const msg: LiveChatMessage = {
      id: "msg-123",
      role: "assistant",
      text: "Hello there",
      thinkingContent: "Let me think...",
      toolCalls: [{ name: "read_file", input: '{"path":"/a.txt"}' }],
      timestamp: 1700000000000,
      phase: "complete",
      cost: 0.05,
      durationMs: 1200,
      model: "claude-opus-4-20250514",
    };

    const result = toSessionMessage(msg);

    expect(result.uuid).toBe("msg-123");
    expect(result.role).toBe("assistant");
    expect(result.type).toBe("message");
    expect(result.content).toBe("Hello there");
    expect(result.timestamp).toBe(new Date(1700000000000).toISOString());
    expect(result.model).toBe("claude-opus-4-20250514");
    expect(result.thinkingContent).toBe("Let me think...");
    expect(result.toolUse).toEqual([{ name: "read_file", input: '{"path":"/a.txt"}' }]);
  });

  it("should set thinkingContent to undefined when empty", () => {
    const msg: LiveChatMessage = {
      id: "msg-456",
      role: "user",
      text: "hi",
      thinkingContent: "",
      toolCalls: [],
      timestamp: 1700000000000,
      phase: "complete",
    };

    const result = toSessionMessage(msg);

    expect(result.thinkingContent).toBeUndefined();
    expect(result.toolUse).toBeUndefined();
  });
});

describe("PHASE_LABELS", () => {
  it("should have labels for all phases", () => {
    expect(PHASE_LABELS.connecting).toBe("Connecting...");
    expect(PHASE_LABELS.thinking).toBe("Thinking...");
    expect(PHASE_LABELS.tool_use).toBe("Using tools...");
    expect(PHASE_LABELS.responding).toBe("Responding...");
    expect(PHASE_LABELS.complete).toBe("");
    expect(PHASE_LABELS.cancelled).toBe("Cancelled");
    expect(PHASE_LABELS.error).toBe("Error");
  });
});
