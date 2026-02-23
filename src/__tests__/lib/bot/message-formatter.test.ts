import { describe, it, expect } from "vitest";
import {
  formatHelp,
  formatStatus,
  formatSessionList,
  formatError,
  formatChatResponse,
} from "@/lib/bot/message-formatter";
import type { SessionSummary, BotStatusInfo } from "@/lib/bot/bot-interface";

describe("formatHelp", () => {
  it("should return markdown-formatted help text", () => {
    const result = formatHelp();

    expect(result.parseMode).toBe("markdown");
    expect(result.text).toContain("Super Claude Code Bot");
    expect(result.text).toContain("/sessions");
    expect(result.text).toContain("/chat");
    expect(result.text).toContain("/bg");
    expect(result.text).toContain("/queue");
    expect(result.text).toContain("/status");
    expect(result.text).toContain("/help");
  });

  it("should include usage instructions", () => {
    const result = formatHelp();

    expect(result.text).toContain("send a message directly");
    expect(result.text).toContain("/bg for long tasks");
  });

  it("should mention provider prefix syntax", () => {
    const result = formatHelp();

    expect(result.text).toContain("codex:");
    expect(result.text).toContain("/chat codex:");
  });
});

describe("formatStatus", () => {
  it("should format status info with all fields", () => {
    const info: BotStatusInfo = {
      totalSessions: 42,
      activeSessions: 3,
      totalProjects: 7,
      uptime: "2d 5h 30m",
    };

    const result = formatStatus(info);

    expect(result.parseMode).toBe("markdown");
    expect(result.text).toContain("SCC Dashboard Status");
    expect(result.text).toContain("42 total");
    expect(result.text).toContain("3 active");
    expect(result.text).toContain("7");
    expect(result.text).toContain("2d 5h 30m");
  });

  it("should format status with zero values", () => {
    const info: BotStatusInfo = {
      totalSessions: 0,
      activeSessions: 0,
      totalProjects: 0,
      uptime: "0m",
    };

    const result = formatStatus(info);

    expect(result.parseMode).toBe("markdown");
    expect(result.text).toContain("0 total, 0 active");
    expect(result.text).toContain("Projects: 0");
  });
});

describe("formatSessionList", () => {
  it("should return empty message when no sessions", () => {
    const result = formatSessionList([]);

    expect(result.text).toBe("No sessions found.");
    expect(result.parseMode).toBe("plain");
  });

  it("should format a single session", () => {
    const sessions: SessionSummary[] = [
      {
        id: "sess-1",
        project: "/home/user/my-project",
        lastActive: "2 min ago",
        messageCount: 15,
        status: "thinking",
        cost: "$0.12",
      },
    ];

    const result = formatSessionList(sessions);

    expect(result.parseMode).toBe("markdown");
    expect(result.text).toContain("Recent Sessions");
    expect(result.text).toContain("(1)");
    expect(result.text).toContain("my\\-project");
    expect(result.text).toContain("thinking");
    expect(result.text).toContain("15");
    expect(result.text).toContain("$0.12");
    expect(result.text).toContain("2 min ago");
  });

  it("should format multiple sessions with numbering", () => {
    const sessions: SessionSummary[] = [
      {
        id: "s1",
        project: "/proj/alpha",
        lastActive: "1h ago",
        messageCount: 5,
        status: "completed",
        cost: "$0.05",
      },
      {
        id: "s2",
        project: "/proj/beta",
        lastActive: "3h ago",
        messageCount: 20,
        status: "error",
        cost: "$0.50",
      },
    ];

    const result = formatSessionList(sessions);

    expect(result.text).toContain("(2)");
    expect(result.text).toContain("1.");
    expect(result.text).toContain("2.");
  });

  it("should truncate long project paths", () => {
    const sessions: SessionSummary[] = [
      {
        id: "s1",
        project: "/very/long/path/to/some/deeply/nested/project-directory",
        lastActive: "now",
        messageCount: 1,
        status: "idle",
        cost: "$0.00",
      },
    ];

    const result = formatSessionList(sessions);

    // Projects longer than 25 chars get truncated with "..." prefix (escaped as \.\.\.)
    expect(result.text).toContain("\\.\\.\\.");
  });

  it("should not truncate short project paths", () => {
    const sessions: SessionSummary[] = [
      {
        id: "s1",
        project: "short-project",
        lastActive: "now",
        messageCount: 1,
        status: "idle",
        cost: "$0.00",
      },
    ];

    const result = formatSessionList(sessions);

    expect(result.text).toContain("short\\-project");
  });
});

describe("formatError", () => {
  it("should format error with markdown", () => {
    const result = formatError("Connection refused");

    expect(result.parseMode).toBe("markdown");
    expect(result.text).toContain("Error");
    expect(result.text).toContain("Connection refused");
  });

  it("should escape markdown special characters in error messages", () => {
    const result = formatError("file_not_found [test]");

    expect(result.parseMode).toBe("markdown");
    // Characters like _ [ ] should be escaped
    expect(result.text).toContain("\\[");
    expect(result.text).toContain("\\]");
    expect(result.text).toContain("\\_");
  });

  it("should handle empty error message", () => {
    const result = formatError("");

    expect(result.parseMode).toBe("markdown");
    expect(result.text).toContain("Error");
  });
});

describe("formatChatResponse", () => {
  it("should format normal content", () => {
    const result = formatChatResponse("Here is the answer.");

    expect(result.parseMode).toBe("markdown");
    expect(result.text).toBe("Here is the answer.");
  });

  it("should include model info when provided", () => {
    const result = formatChatResponse("Answer", "claude-sonnet-4-20250514");

    expect(result.text).toContain("Answer");
    expect(result.text).toContain("Model: claude-sonnet-4-20250514");
  });

  it("should not include model footer when model is not provided", () => {
    const result = formatChatResponse("Just text");

    expect(result.text).toBe("Just text");
    expect(result.text).not.toContain("Model:");
  });

  it("should handle empty content", () => {
    const result = formatChatResponse("");

    expect(result.text).toBe("_(empty response)_");
    expect(result.parseMode).toBe("markdown");
  });

  it("should handle whitespace-only content", () => {
    const result = formatChatResponse("   \n\n   ");

    expect(result.text).toBe("_(empty response)_");
  });

  it("should truncate very long responses", () => {
    const longContent = "x".repeat(5000);

    const result = formatChatResponse(longContent);

    expect(result.text.length).toBeLessThan(5000);
    expect(result.text).toContain("_(truncated)_");
  });

  it("should not truncate content under the limit", () => {
    const content = "x".repeat(3999);

    const result = formatChatResponse(content);

    expect(result.text).not.toContain("_(truncated)_");
  });

  it("should trim whitespace from content", () => {
    const result = formatChatResponse("  hello  ");

    expect(result.text).toBe("hello");
  });
});
