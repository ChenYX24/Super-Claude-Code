import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs, os, and path before importing the module
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("os", () => ({
  default: {
    homedir: vi.fn(() => "/mock/home"),
    platform: vi.fn(() => "win32"),
  },
  homedir: vi.fn(() => "/mock/home"),
  platform: vi.fn(() => "win32"),
}));

import fs from "fs";
import os from "os";
import { readSettings, readCodexSettings, getEnvironmentInfo } from "@/lib/settings-reader";
import type { ClaudeSettings } from "@/lib/settings-reader";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readSettings", () => {
  it("should return empty settings when no files exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = readSettings();

    expect(result.global).toEqual({});
    expect(result.local).toEqual({});
    expect(result.merged).toEqual({ permissions: {} });
    expect(result.codex).toBeNull();
  });

  it("should read and parse global settings", () => {
    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
      const filePath = String(p);
      return filePath.endsWith("settings.json");
    });

    vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathOrFileDescriptor) => {
      const filePath = String(p);
      if (filePath.endsWith("settings.json")) {
        return JSON.stringify({
          defaultModel: "claude-opus-4-20250514",
          theme: "dark",
          autoUpdate: true,
        });
      }
      return "";
    });

    const result = readSettings();

    expect(result.global.defaultModel).toBe("claude-opus-4-20250514");
    expect(result.global.theme).toBe("dark");
    expect(result.global.autoUpdate).toBe(true);
    expect(result.merged.defaultModel).toBe("claude-opus-4-20250514");
  });

  it("should merge local settings over global settings", () => {
    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
      const filePath = String(p);
      return (
        filePath.endsWith("settings.json") ||
        filePath.endsWith("settings.local.json")
      );
    });

    vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathOrFileDescriptor) => {
      const filePath = String(p);
      if (filePath.endsWith("settings.local.json")) {
        return JSON.stringify({
          defaultModel: "claude-sonnet-4-20250514",
          proxyUrl: "http://localhost:8080",
        });
      }
      if (filePath.endsWith("settings.json")) {
        return JSON.stringify({
          defaultModel: "claude-opus-4-20250514",
          theme: "dark",
        });
      }
      return "";
    });

    const result = readSettings();

    // Local overrides global
    expect(result.merged.defaultModel).toBe("claude-sonnet-4-20250514");
    // Global-only values are preserved
    expect(result.merged.theme).toBe("dark");
    // Local-only values are included
    expect(result.merged.proxyUrl).toBe("http://localhost:8080");
  });

  it("should merge permissions from both global and local", () => {
    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
      const filePath = String(p);
      return (
        filePath.endsWith("settings.json") ||
        filePath.endsWith("settings.local.json")
      );
    });

    vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathOrFileDescriptor) => {
      const filePath = String(p);
      if (filePath.endsWith("settings.local.json")) {
        return JSON.stringify({
          permissions: { autoApprove: true },
        });
      }
      if (filePath.endsWith("settings.json")) {
        return JSON.stringify({
          permissions: {
            allowedTools: ["Bash", "Read"],
            autoApprove: false,
          },
        });
      }
      return "";
    });

    const result = readSettings();

    // Local permissions override global
    expect(result.merged.permissions?.autoApprove).toBe(true);
    // Global permissions are preserved when not overridden
    expect(result.merged.permissions?.allowedTools).toEqual(["Bash", "Read"]);
  });

  it("should mask API keys in all settings", () => {
    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
      const filePath = String(p);
      return filePath.endsWith("settings.json");
    });

    vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathOrFileDescriptor) => {
      const filePath = String(p);
      if (filePath.endsWith("settings.json")) {
        return JSON.stringify({
          apiKey: "sk-ant-1234567890abcdef1234567890abcdef",
        });
      }
      return "";
    });

    const result = readSettings();

    // API key should be masked (first 8 chars + ... + last 4 chars)
    expect(result.global.apiKey).not.toBe("sk-ant-1234567890abcdef1234567890abcdef");
    expect(result.global.apiKey).toContain("...");
    expect(result.global.apiKey?.startsWith("sk-ant-1")).toBe(true);
    expect(result.global.apiKey?.endsWith("cdef")).toBe(true);
  });

  it("should handle malformed JSON gracefully", () => {
    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
      const filePath = String(p);
      return filePath.endsWith("settings.json");
    });

    vi.mocked(fs.readFileSync).mockReturnValue("{ invalid json }");

    const result = readSettings();

    expect(result.global).toEqual({});
  });
});

describe("readCodexSettings", () => {
  it("should return null when config file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = readCodexSettings();

    expect(result).toBeNull();
  });

  it("should parse TOML config with project entries", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      [
        "sandbox = \"docker\"",
        "",
        "[projects.'/home/user/project-a']",
        "trust_level = \"full\"",
        "",
        "[projects.'/home/user/project-b']",
        "trust_level = \"read-only\"",
      ].join("\n")
    );

    const result = readCodexSettings();

    expect(result).not.toBeNull();
    expect(result!.projects).toHaveLength(2);
    expect(result!.projects[0].path).toBe("/home/user/project-a");
    expect(result!.projects[0].trust_level).toBe("full");
    expect(result!.projects[1].path).toBe("/home/user/project-b");
    expect(result!.projects[1].trust_level).toBe("read-only");
    expect(result!.sandbox).toBe("docker");
  });

  it("should return null on read error", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("Permission denied");
    });

    const result = readCodexSettings();

    expect(result).toBeNull();
  });
});

describe("getEnvironmentInfo", () => {
  it("should return environment info from settings", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const settings: ClaudeSettings = {
      apiKey: "sk-ant-12345678abcdefgh",
      proxyUrl: "http://proxy:8080",
    };

    const result = getEnvironmentInfo(settings);

    expect(result.homeDir).toBe("/mock/home");
    expect(result.platform).toBe("win32");
    expect(result.nodeVersion).toBe(process.version);
    expect(result.hasApiKey).toBe(true);
    expect(result.apiKeyMasked).toBe("sk-ant-12345678abcdefgh");
    expect(result.proxyUrl).toBe("http://proxy:8080");
    expect(result.codexInstalled).toBe(false);
  });

  it("should detect API key from environment variable", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const originalEnv = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-ant-envkey1234567890abcd";

    try {
      const settings: ClaudeSettings = {};
      const result = getEnvironmentInfo(settings);

      expect(result.hasApiKey).toBe(true);
      // When settings.apiKey is undefined, it falls back to masking env var
      expect(result.apiKeyMasked).toContain("...");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = originalEnv;
      }
    }
  });

  it("should report no API key when none is available", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const originalEnv = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const settings: ClaudeSettings = {};
      const result = getEnvironmentInfo(settings);

      expect(result.hasApiKey).toBe(false);
      expect(result.apiKeyMasked).toBeUndefined();
    } finally {
      if (originalEnv !== undefined) {
        process.env.ANTHROPIC_API_KEY = originalEnv;
      }
    }
  });

  it("should detect codex installation", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const settings: ClaudeSettings = {};
    const result = getEnvironmentInfo(settings);

    expect(result.codexInstalled).toBe(true);
  });

  it("should detect proxy from environment variables", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const origHttp = process.env.HTTP_PROXY;
    const origHttps = process.env.HTTPS_PROXY;
    process.env.HTTP_PROXY = "http://env-proxy:3128";
    delete process.env.HTTPS_PROXY;

    try {
      const settings: ClaudeSettings = {};
      const result = getEnvironmentInfo(settings);

      expect(result.proxyUrl).toBe("http://env-proxy:3128");
    } finally {
      if (origHttp === undefined) {
        delete process.env.HTTP_PROXY;
      } else {
        process.env.HTTP_PROXY = origHttp;
      }
      if (origHttps !== undefined) {
        process.env.HTTPS_PROXY = origHttps;
      }
    }
  });
});
