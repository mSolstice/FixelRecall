import { homedir } from "node:os";

/**
 * Guided mode for the commands that change files: setup, rollback and uninstall.
 *
 * Run in a terminal, they show the dry run first, then ask "Apply these changes? (y/N)",
 * so nobody has to remember --confirm, --replace-existing-manifest or
 * FIXEL_RECALL_CONFIG_ROOT. Everything here is opt-out by being explicit: passing
 * --confirm or --dry-run keeps the original non-interactive behaviour exactly.
 */

export interface InteractiveIo {
  /** True when stdin and stdout are both a terminal. */
  readonly interactive: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
  ask(question: string): Promise<string>;
  out(text: string): void;
  err(text: string): void;
}

export interface FlowCommandOptions {
  readonly configRoot?: string;
  readonly confirm?: boolean;
  readonly dryRun?: boolean;
}

export interface FlowCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type FlowCommandRunner = (
  argv: readonly string[],
  options: FlowCommandOptions
) => Promise<FlowCommandResult>;

const flowCommands: ReadonlySet<string> = new Set(["setup", "rollback", "uninstall"]);
const skipPromptFlags: readonly string[] = ["--yes", "-y"];

export function wantsGuidedFlow(argv: readonly string[], io: InteractiveIo): boolean {
  const command = argv[0];
  if (command === undefined || !flowCommands.has(command)) {
    return false;
  }
  if (argv.includes("--confirm") || argv.includes("--dry-run")) {
    return false;
  }
  return io.interactive || skipPromptFlags.some((flag) => argv.includes(flag));
}

export function isAffirmative(answer: string): boolean {
  const value = answer.trim().toLowerCase();
  return value === "y" || value === "yes";
}

async function confirmWith(io: InteractiveIo, question: string, skip: boolean): Promise<boolean> {
  return skip ? true : isAffirmative(await io.ask(question));
}

/** Setup needs a host. Ask once when it was not given, so `setup` alone just works. */
async function chooseSetupTarget(argv: readonly string[], io: InteractiveIo): Promise<string[]> {
  const hasTarget =
    (argv[1] !== undefined && !argv[1].startsWith("-")) ||
    argv.includes("--host") ||
    argv.includes("--target");
  if (hasTarget || !io.interactive) {
    return [...argv];
  }
  io.out(
    [
      "Which tool should Fixel Recall set up?",
      "  1) Codex CLI",
      "  2) Claude Code CLI",
      "  3) Both",
      ""
    ].join("\n")
  );
  const answer = (await io.ask("Choose 1, 2 or 3 [3]: ")).trim().toLowerCase();
  const target =
    answer === "1" || answer === "codex"
      ? "codex"
      : answer === "2" || answer === "claude" || answer === "claude-code"
        ? "claude-code"
        : "both";
  return [argv[0] ?? "setup", target, ...argv.slice(1)];
}

function emit(io: InteractiveIo, result: FlowCommandResult): void {
  if (result.stdout.length > 0) {
    io.out(result.stdout);
  }
  if (result.stderr.length > 0) {
    io.err(result.stderr);
  }
}

export async function runGuidedFlow(
  argv: readonly string[],
  io: InteractiveIo,
  run: FlowCommandRunner
): Promise<number> {
  const skipPrompts = skipPromptFlags.some((flag) => argv.includes(flag));
  const command = argv[0] ?? "setup";
  const cleaned = argv.filter((arg) => !skipPromptFlags.includes(arg));
  const args = command === "setup" ? await chooseSetupTarget(cleaned, io) : [...cleaned];
  // Without an explicit root the command only previews into a temp folder. A guided
  // run is meant to apply for real, so default to the user's home directory.
  const configRoot = io.env["FIXEL_RECALL_CONFIG_ROOT"] ?? homedir();

  const preview = await run(args, { configRoot, confirm: false, dryRun: true });
  emit(io, preview);
  if (preview.exitCode !== 0) {
    return preview.exitCode;
  }

  io.out(`\nConfig root: ${configRoot}\n`);
  if (!(await confirmWith(io, "Apply these changes? (y/N) ", skipPrompts))) {
    io.out("No changes were made.\n");
    return 0;
  }

  let applied = await run([...args, "--confirm"], { configRoot, confirm: true, dryRun: false });
  if (
    command === "setup" &&
    applied.stdout.includes("Refused: an existing Fixel Recall install manifest")
  ) {
    io.out(`\n${applied.stdout}`);
    if (!(await confirmWith(io, "Replace the existing install? (y/N) ", skipPrompts))) {
      io.out("No changes were made.\n");
      return 0;
    }
    applied = await run([...args, "--confirm", "--replace-existing-manifest"], {
      configRoot,
      confirm: true,
      dryRun: false
    });
  }
  io.out("\n");
  emit(io, applied);
  return applied.exitCode;
}
