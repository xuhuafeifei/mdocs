import fs from "node:fs";
import path from "node:path";
import { resolveInstalledPackageRoot, runSelfUpdate } from "./self-update.js";

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
      "  mdocs                          Start server",
      "  mdocs start                    Start server",
      "  mdocs version                  Print installed version",
      "  mdocs update [--source taobao|npm] [--registry URL]",
      "  mdocs visitor list [--active|--disabled|--all]",
      "  mdocs visitor migrate --from OLD --to NEW [--dry-run] [--confirm]",
      "  mdocs agent session repair [--visitor ID|name] [--kind normal|coding|all] [--dry-run|--confirm]",
      "",
      "Notes:",
      "  version also accepts -v / --version.",
      "  update upgrades @fgbg/mdocs in-place (keeps node_modules, then npm install + rebuild natives).",
      "  update default --source=taobao (https://registry.npmmirror.com);",
      "  use --source npm for registry.npmjs.org, or --registry <url> for a custom registry.",
      "  visitor list defaults to --active (only enabled visitors).",
      "  For migrate, OLD/NEW can be either visitor ID (UUID) or visitor name.",
      "  Either --dry-run or --confirm must be supplied.",
      "  --confirm performs the migration inside a transaction and makes a backup first.",
      "  agent session repair rebuilds session.json from orphan *.jsonl (does not delete transcripts).",
      "",
    ].join("\n"),
  );
}

/** CLI 入口：根据命令与子命令分发到对应的处理函数。 */
async function main(): Promise<void> {
  const [command, sub, ...rest] = process.argv.slice(2);
  if (!command) {
    await startServer();
    return;
  }
  if (command === "start") {
    await startServer();
    return;
  }
  if (command === "version" || command === "-v" || command === "--version") {
    printVersion();
    return;
  }
  if (command === "update") {
    // 不加载 server/db：better-sqlite3 半残时仍须能跑 update 自救
    const flags = parseFlags(rest);
    const source = typeof flags.source === "string" ? flags.source : undefined;
    const registry =
      typeof flags.registry === "string" ? flags.registry : undefined;
    runSelfUpdate({ source, registry });
    return;
  }
  if (command === "visitor" && sub === "list") {
    await runVisitorList(parseFlags(rest));
    return;
  }
  if (command === "visitor" && sub === "migrate") {
    await runVisitorMigrate(parseFlags(rest));
    return;
  }
  if (command === "agent" && sub === "session" && rest[0] === "repair") {
    await runAgentSessionRepair(parseFlags(rest.slice(1)));
    return;
  }
  printUsage();
  process.exit(1);
}

/** 打印当前安装的包版本（开发仓库与全局安装均可）。 */
function printVersion(): void {
  const root = resolveInstalledPackageRoot();
  const pkgPath = path.join(root, "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    process.stdout.write(`${pkg.version ?? "?"}\n`);
  } catch (err) {
    process.stderr.write(
      `mdocs version: failed to read ${pkgPath}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}

/** 启动 HTTP 服务器。 */
async function startServer(): Promise<void> {
  const { useLogger } = await import("../logger/logger.js");
  const { getConfig } = await import("../config/index.js");
  const { buildApp } = await import("../app.js");
  const log = useLogger("cli-server");
  const cfg = getConfig();
  const app = buildApp();

  process.on("uncaughtException", (err) => {
    log.error(
      "uncaughtException: %s",
      err instanceof Error ? err.stack ?? err.message : String(err),
    );
  });
  process.on("unhandledRejection", (reason) => {
    log.error(
      "unhandledRejection: %s",
      reason instanceof Error ? reason.stack ?? reason.message : String(reason),
    );
  });

  const server = app.listen(cfg.port, cfg.host, () => {
    process.stdout.write(`mdocs listening on http://${cfg.host}:${cfg.port}\n`);
  });
  server.on("error", (err) => {
    log.error("server error: %s", err instanceof Error ? err.message : String(err));
    process.stderr.write(
      `server error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}

/** 执行 `visitor list`：查询访客并以 TSV 格式输出。 */
async function runVisitorList(flags: Flags): Promise<void> {
  const { listAllVisitors } = await import("../identity/visitor.service.js");
  let filter: "all" | "active" | "disabled" = "active";
  if (flags.all === true) filter = "all";
  if (flags.disabled === true) filter = "disabled";

  const rows = listAllVisitors(filter);
  for (const row of rows) {
    process.stdout.write(
      `${row.visitor_id}\t${row.visitor_name}\tcreated=${row.created_at}\tdisabled=${row.disabled_at ?? "-"}\tmerged_into=${row.merged_into_visitor_id ?? "-"}\n`,
    );
  }
}

/**
 * 根据输入字符串解析访客记录：先按 ID 查找，找不到再按名称查找。
 * 只返回未禁用的访客。
 */
async function resolveVisitor(
  ident: string,
): Promise<{ visitorId: string; visitorName: string }> {
  const { getDb } = await import("../db/connection.js");
  const { findVisitorById, findVisitorByName } = await import(
    "../db/repositories/visitor.repo.js"
  );
  const { MigrationError } = await import(
    "../migrations/visitor-migration.service.js"
  );
  const db = getDb();
  let row = findVisitorById(db, ident);
  if (!row) row = findVisitorByName(db, ident);
  if (!row) {
    throw new MigrationError(
      "NOT_FOUND",
      `visitor "${ident}" not found (tried as ID, then name)`,
    );
  }
  if (row.disabled_at) {
    throw new MigrationError("VISITOR_DISABLED", `visitor "${ident}" is disabled`);
  }
  return { visitorId: row.visitor_id, visitorName: row.visitor_name };
}

/** 执行 `visitor migrate`：校验参数后调用迁移服务，并输出结果或错误。 */
async function runVisitorMigrate(flags: Flags): Promise<void> {
  const { migrateVisitor, MigrationError } = await import(
    "../migrations/visitor-migration.service.js"
  );
  type MigrationResult = Awaited<ReturnType<typeof migrateVisitor>>;

  const fromRaw = typeof flags.from === "string" ? flags.from : "";
  const toRaw = typeof flags.to === "string" ? flags.to : "";
  const dryRun = flags["dry-run"] === true;
  const confirm = flags.confirm === true;

  if (!fromRaw || !toRaw) {
    process.stderr.write("--from and --to are required\n");
    process.exit(2);
  }
  if (!dryRun && !confirm) {
    process.stderr.write("must pass --dry-run or --confirm\n");
    process.exit(2);
  }
  try {
    const from = await resolveVisitor(fromRaw);
    const to = await resolveVisitor(toRaw);
    const result = migrateVisitor({
      fromVisitorId: from.visitorId,
      toVisitorId: to.visitorId,
      confirm,
    });
    printMigrationResult(result as MigrationResult);
  } catch (err) {
    if (err instanceof MigrationError) {
      process.stderr.write(`migration error: ${err.code} ${err.message}\n`);
      process.exit(3);
    }
    process.stderr.write(
      `unexpected error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(4);
  }
}

/**
 * 修复 agent session.json：把磁盘上有、索引里没有的 *.jsonl 补回 sessions[]。
 */
async function runAgentSessionRepair(flags: Flags): Promise<void> {
  const { repairAgentSessionsUnderDataDir } = await import(
    "../agent/Agent/session-manager.js"
  );
  const { MigrationError } = await import(
    "../migrations/visitor-migration.service.js"
  );

  const dryRun = flags["dry-run"] === true;
  const confirm = flags.confirm === true;
  if (!dryRun && !confirm) {
    process.stderr.write("must pass --dry-run or --confirm\n");
    process.exit(2);
  }
  const kindRaw = typeof flags.kind === "string" ? flags.kind : "all";
  if (kindRaw !== "all" && kindRaw !== "normal" && kindRaw !== "coding") {
    process.stderr.write("--kind must be normal|coding|all\n");
    process.exit(2);
  }
  let visitorId: string | undefined;
  if (typeof flags.visitor === "string" && flags.visitor.trim()) {
    try {
      visitorId = (await resolveVisitor(flags.visitor.trim())).visitorId;
    } catch (err) {
      const raw = flags.visitor.trim();
      if (/^[0-9a-f-]{36}$/i.test(raw)) {
        visitorId = raw;
      } else if (err instanceof MigrationError) {
        process.stderr.write(`repair error: ${err.code} ${err.message}\n`);
        process.exit(3);
      } else {
        throw err;
      }
    }
  }
  try {
    const rows = await repairAgentSessionsUnderDataDir({
      visitorId,
      kind: kindRaw,
      dryRun,
    });
    const header = dryRun ? "dry-run" : "executed";
    process.stdout.write(`agent session repair ${header}\n`);
    if (rows.length === 0) {
      process.stdout.write("  (no tenant session dirs)\n");
      return;
    }
    for (const r of rows) {
      process.stdout.write(
        `  ${r.visitorId}\t${r.kind}\tbefore=${r.before}\tafter=${r.after}\tadded=${r.added}\t${r.sessionDir}\n`,
      );
    }
  } catch (err) {
    process.stderr.write(
      `unexpected error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(4);
  }
}

/** 将访客迁移结果格式化为可读文本并输出到标准输出。 */
function printMigrationResult(result: {
  dryRun: boolean;
  from: { visitor_id: string; visitor_name: string };
  to: { visitor_id: string; visitor_name: string };
  impact: {
    documents_owner: number;
    documents_created_by: number;
    documents_updated_by: number;
    attachments_owner: number;
  };
  backupPath?: string | null;
}): void {
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
