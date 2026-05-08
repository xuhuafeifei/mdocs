import { listAllVisitors } from "../identity/visitor.service.js";
import {
  migrateVisitor,
  MigrationError,
  type MigrationResult,
} from "../migrations/visitor-migration.service.js";

type Flags = Record<string, string | boolean>;

/** 解析命令行参数，将 `--key value` 或 `--flag` 形式转为键值对象。 */
function parseFlags(argv: string[]): Flags {
  const out: Flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token || !token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    // 若下一项存在且不是新的标志，则将其视为当前标志的值
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

/** 打印 CLI 使用说明到标准输出。 */
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

/** CLI 入口：根据命令与子命令分发到对应的处理函数。 */
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

/** 执行 `visitor list`：查询所有访客并以 TSV 格式输出。 */
function runVisitorList(): void {
  const rows = listAllVisitors();
  for (const row of rows) {
    process.stdout.write(
      `${row.visitor_id}\t${row.visitor_name}\tcreated=${row.created_at}\tdisabled=${row.disabled_at ?? "-"}\tmerged_into=${row.merged_into_visitor_id ?? "-"}\n`,
    );
  }
}

/** 执行 `visitor migrate`：校验参数后调用迁移服务，并输出结果或错误。 */
function runVisitorMigrate(flags: Flags): void {
  const from = typeof flags.from === "string" ? flags.from : "";
  const to = typeof flags.to === "string" ? flags.to : "";
  const dryRun = flags["dry-run"] === true;
  const confirm = flags.confirm === true;

  // 校验必填参数
  if (!from || !to) {
    process.stderr.write("--from and --to are required\n");
    process.exit(2);
  }
  // 校验必须指定执行模式
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

/** 将访客迁移结果格式化为可读文本并输出到标准输出。 */
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
