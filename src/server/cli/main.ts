import { listAllVisitors } from "../identity/visitor.service.js";
import {
  migrateVisitor,
  MigrationError,
  type MigrationResult,
} from "../migrations/visitor-migration.service.js";

type Flags = Record<string, string | boolean>;

function parseFlags(argv: string[]): Flags {
  const out: Flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token || !token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function printUsage(): void {
  process.stdout.write(
    [
      "mdocs CLI",
      "",
      "Usage:",
      "  mdocs visitor list",
      "  mdocs visitor migrate --from OLD --to NEW [--dry-run] [--confirm]",
      "",
      "Notes:",
      "  Either --dry-run or --confirm must be supplied for migrate.",
      "  --confirm performs the migration inside a transaction and makes a backup first.",
      "",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const [command, sub, ...rest] = process.argv.slice(2);
  if (!command) {
    printUsage();
    process.exit(0);
  }
  if (command === "visitor" && sub === "list") {
    runVisitorList();
    return;
  }
  if (command === "visitor" && sub === "migrate") {
    runVisitorMigrate(parseFlags(rest));
    return;
  }
  printUsage();
  process.exit(1);
}

function runVisitorList(): void {
  const rows = listAllVisitors();
  for (const row of rows) {
    process.stdout.write(
      `${row.visitor_id}\t${row.visitor_name}\tcreated=${row.created_at}\tdisabled=${row.disabled_at ?? "-"}\tmerged_into=${row.merged_into_visitor_id ?? "-"}\n`,
    );
  }
}

function runVisitorMigrate(flags: Flags): void {
  const from = typeof flags.from === "string" ? flags.from : "";
  const to = typeof flags.to === "string" ? flags.to : "";
  const dryRun = flags["dry-run"] === true;
  const confirm = flags.confirm === true;

  if (!from || !to) {
    process.stderr.write("--from and --to are required\n");
    process.exit(2);
  }
  if (!dryRun && !confirm) {
    process.stderr.write("must pass --dry-run or --confirm\n");
    process.exit(2);
  }
  try {
    const result = migrateVisitor({ fromVisitorId: from, toVisitorId: to, confirm });
    printMigrationResult(result);
  } catch (err) {
    if (err instanceof MigrationError) {
      process.stderr.write(`migration error: ${err.code} ${err.message}\n`);
      process.exit(3);
    }
    process.stderr.write(`unexpected error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(4);
  }
}

function printMigrationResult(result: MigrationResult): void {
  const header = result.dryRun ? "dry-run" : "executed";
  process.stdout.write(
    [
      `migration ${header}`,
      `  from: ${result.from.visitor_id} (${result.from.visitor_name})`,
      `  to:   ${result.to.visitor_id} (${result.to.visitor_name})`,
      `  documents.owner_visitor_id: ${result.impact.documents_owner}`,
      `  documents.created_by:       ${result.impact.documents_created_by}`,
      `  documents.updated_by:       ${result.impact.documents_updated_by}`,
      `  attachments.owner_visitor_id: ${result.impact.attachments_owner}`,
      result.backupPath ? `  backup: ${result.backupPath}` : "  backup: -",
      "",
    ].join("\n"),
  );
}

void main();
