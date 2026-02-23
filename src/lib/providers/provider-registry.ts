import type { CliProvider } from "./provider-interface";
import { ClaudeProvider } from "./claude-provider";
import { CodexProvider } from "./codex-provider";

class ProviderRegistry {
  private providers = new Map<string, CliProvider>();

  register(provider: CliProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): CliProvider | undefined {
    return this.providers.get(name);
  }

  list(): CliProvider[] {
    return Array.from(this.providers.values());
  }

  listAvailable(): CliProvider[] {
    return this.list().filter((p) => p.isAvailable());
  }

  getDefault(): CliProvider {
    const claude = this.providers.get("claude");
    if (claude) return claude;
    // Fallback to first registered provider
    const first = this.providers.values().next().value;
    if (!first) throw new Error("No providers registered");
    return first;
  }
}

// Singleton registry with default providers
const registry = new ProviderRegistry();
registry.register(new ClaudeProvider());
registry.register(new CodexProvider());

export { registry };
export type { ProviderRegistry };
