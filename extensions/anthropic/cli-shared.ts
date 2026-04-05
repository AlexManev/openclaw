import {
  CLAUDE_CLI_CLEAR_ENV,
  CLAUDE_CLI_MODEL_ALIASES,
  CLAUDE_CLI_SESSION_ID_FIELDS,
  normalizeClaudeBackendConfig,
} from "openclaw/plugin-sdk/cli-backend";
import type { CliBackendConfig } from "openclaw/plugin-sdk/cli-backend";

export {
  CLAUDE_CLI_MODEL_ALIASES,
  CLAUDE_CLI_SESSION_ID_FIELDS,
  CLAUDE_CLI_CLEAR_ENV,
  normalizeClaudeBackendConfig,
};
export type { CliBackendConfig };

export const CLAUDE_CLI_BACKEND_ID = "claude-cli";

export function isClaudeCliProvider(providerId: string): boolean {
  return providerId.trim().toLowerCase() === CLAUDE_CLI_BACKEND_ID;
}
