import {
  CLAUDE_CLI_CLEAR_ENV,
  CLAUDE_CLI_MODEL_ALIASES,
  CLAUDE_CLI_SESSION_ID_FIELDS,
  CLI_FRESH_WATCHDOG_DEFAULTS,
  CLI_RESUME_WATCHDOG_DEFAULTS,
  normalizeClaudeBackendConfig,
} from "openclaw/plugin-sdk/cli-backend";
import { formatCliCommand } from "openclaw/plugin-sdk/cli-runtime";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import type {
  OpenClawPluginApi,
  ProviderAuthContext,
  ProviderAuthMethodNonInteractiveContext,
} from "openclaw/plugin-sdk/plugin-entry";
import { readClaudeCliCredentialsCached } from "openclaw/plugin-sdk/provider-auth";
import type { ProviderAuthResult } from "openclaw/plugin-sdk/provider-auth";

const PROVIDER_ID = "claude-headless";
const BACKEND_ID = "claude-headless";
const DEFAULT_MODEL_REF = "claude-headless/claude-sonnet-4-6";

// Headless mode args: -p (print/headless), stream-json output, and
// bypassPermissions replaces the legacy --dangerously-skip-permissions flag.
const HEADLESS_ARGS = [
  "-p",
  "--output-format",
  "stream-json",
  "--include-partial-messages",
  "--verbose",
  "--permission-mode",
  "bypassPermissions",
] as const;

const HEADLESS_RESUME_ARGS = [
  "-p",
  "--output-format",
  "stream-json",
  "--include-partial-messages",
  "--verbose",
  "--permission-mode",
  "bypassPermissions",
  "--resume",
  "{sessionId}",
] as const;

function hasClaudeHeadlessAuth(): boolean {
  return Boolean(readClaudeCliCredentialsCached());
}

type AgentDefaultsModels = Record<string, unknown>;

function buildAuthResult(config: ProviderAuthContext["config"]): ProviderAuthResult {
  const existingModels = (config.agents?.defaults?.models ?? {}) as AgentDefaultsModels;
  return {
    profiles: [],
    configPatch: {
      agents: {
        defaults: {
          model: DEFAULT_MODEL_REF,
          models: {
            ...existingModels,
            [DEFAULT_MODEL_REF]: existingModels[DEFAULT_MODEL_REF] ?? {},
          },
        },
      },
    },
    defaultModel: DEFAULT_MODEL_REF,
    notes: [
      "Claude headless mode enabled: using local Claude CLI in headless mode with permissions bypassed.",
      "No Anthropic API key is required.",
    ],
  };
}

function registerClaudeHeadlessPlugin(api: OpenClawPluginApi): void {
  // Register the CLI backend that spawns `claude -p --permission-mode bypassPermissions`.
  api.registerCliBackend({
    id: BACKEND_ID,
    bundleMcp: true,
    config: {
      command: "claude",
      args: [...HEADLESS_ARGS],
      resumeArgs: [...HEADLESS_RESUME_ARGS],
      output: "jsonl",
      input: "stdin",
      modelArg: "--model",
      modelAliases: { ...CLAUDE_CLI_MODEL_ALIASES },
      sessionArg: "--session-id",
      sessionMode: "always",
      sessionIdFields: [...CLAUDE_CLI_SESSION_ID_FIELDS],
      systemPromptArg: "--append-system-prompt",
      systemPromptMode: "append",
      systemPromptWhen: "first",
      clearEnv: [...CLAUDE_CLI_CLEAR_ENV],
      reliability: {
        watchdog: {
          fresh: { ...CLI_FRESH_WATCHDOG_DEFAULTS },
          resume: { ...CLI_RESUME_WATCHDOG_DEFAULTS },
        },
      },
      serialize: true,
    },
    normalizeConfig: normalizeClaudeBackendConfig,
  });

  // Register the provider so users can set it up via `openclaw auth`.
  api.registerProvider({
    id: PROVIDER_ID,
    label: "Claude Headless",
    docsPath: "/providers/claude-headless",
    auth: [
      {
        id: "detect",
        label: "Claude headless (local CLI)",
        hint: "Use local Claude CLI in headless mode with permissions bypassed — no API key required",
        kind: "custom",
        wizard: {
          choiceId: "claude-headless",
          choiceLabel: "Claude headless (local CLI)",
          choiceHint: "Use local Claude CLI in headless mode — no Anthropic API key required",
          groupId: "claude-headless",
          groupLabel: "Claude Headless",
          groupHint: "No API key required",
          modelAllowlist: {
            allowedKeys: [
              "claude-headless/claude-sonnet-4-6",
              "claude-headless/claude-opus-4-6",
              "claude-headless/claude-opus-4-5",
              "claude-headless/claude-sonnet-4-5",
              "claude-headless/claude-haiku-4-5",
            ],
            initialSelections: [DEFAULT_MODEL_REF],
            message: "Claude headless models",
          },
        },
        run: async (ctx: ProviderAuthContext): Promise<ProviderAuthResult> => {
          if (!hasClaudeHeadlessAuth()) {
            throw new Error(
              [
                "Claude CLI is not authenticated on this host.",
                `Run ${formatCliCommand("claude auth login")} first, then re-run this setup.`,
              ].join("\n"),
            );
          }
          return buildAuthResult(ctx.config);
        },
        runNonInteractive: async (
          ctx: ProviderAuthMethodNonInteractiveContext,
        ): Promise<ProviderAuthContext["config"] | null> => {
          if (!hasClaudeHeadlessAuth()) {
            ctx.runtime.error(
              [
                'Auth choice "claude-headless" requires Claude CLI auth on this host.',
                `Run ${formatCliCommand("claude auth login")} first.`,
              ].join("\n"),
            );
            ctx.runtime.exit(1);
            return null;
          }
          const result = buildAuthResult(ctx.config);
          const currentDefaults = ctx.config.agents?.defaults;
          const currentModel = currentDefaults?.model;
          const currentFallbacks =
            currentModel && typeof currentModel === "object" && "fallbacks" in currentModel
              ? currentModel.fallbacks
              : undefined;
          return {
            ...ctx.config,
            ...result.configPatch,
            agents: {
              ...ctx.config.agents,
              ...result.configPatch?.agents,
              defaults: {
                ...currentDefaults,
                ...result.configPatch?.agents?.defaults,
                model: {
                  ...(Array.isArray(currentFallbacks) ? { fallbacks: currentFallbacks } : {}),
                  primary: result.defaultModel,
                },
              },
            },
          };
        },
      },
    ],
  });
}

export default definePluginEntry({
  id: "claude-headless",
  name: "Claude Headless Provider",
  description:
    "Use local Claude CLI in headless mode as a provider — no Anthropic API key required",
  register(api) {
    registerClaudeHeadlessPlugin(api);
  },
});
