/**
 * Server configuration: resolves the Curviate API key and base URL from the
 * environment first, with a CLI-flag fallback for the API key only.
 *
 * The environment variable is the preferred path: a bearer key passed as a
 * bare CLI argument is visible to other users on the same machine through
 * `ps`/process listings and lands in shell history. `--api-key` exists only
 * for one-off, low-trust contexts and prints a warning to stderr when used.
 */

export interface ResolvedServerConfig {
  apiKey: string;
  baseUrl: string | undefined;
}

function readFlagValue(argv: string[], flag: string): string | undefined {
  const eqPrefix = `${flag}=`;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === flag) {
      return argv[i + 1];
    }
    if (arg !== undefined && arg.startsWith(eqPrefix)) {
      return arg.slice(eqPrefix.length);
    }
  }
  return undefined;
}

/**
 * Resolve the server's configuration from `process.argv` (subcommand args
 * only, i.e. `process.argv.slice(2)`) and `process.env`.
 *
 * Throws a plain `Error` with a user-actionable message when no API key can
 * be resolved from either source. Never throws for a missing base URL, the
 * SDK's own default applies.
 */
export function resolveServerConfig(
  argv: string[],
  env: NodeJS.ProcessEnv,
  warn: (message: string) => void = (message) => process.stderr.write(`${message}\n`),
): ResolvedServerConfig {
  const envApiKey = env.CURVIATE_API_KEY;
  const flagApiKey = readFlagValue(argv, "--api-key");

  let apiKey: string | undefined;
  if (envApiKey !== undefined && envApiKey.length > 0) {
    apiKey = envApiKey;
  } else if (flagApiKey !== undefined && flagApiKey.length > 0) {
    apiKey = flagApiKey;
    warn(
      "Warning: --api-key exposes your key in shell history and process listings. " +
        "Prefer the CURVIATE_API_KEY environment variable instead.",
    );
  }

  if (apiKey === undefined) {
    throw new Error(
      "Missing Curviate API key. Set the CURVIATE_API_KEY environment variable, " +
        "or pass --api-key <key> as a fallback. Get a key from https://app.curviate.com.",
    );
  }

  const baseUrl = env.CURVIATE_BASE_URL ?? readFlagValue(argv, "--base-url");

  return { apiKey, baseUrl };
}
