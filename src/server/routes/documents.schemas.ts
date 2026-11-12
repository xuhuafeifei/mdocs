/**
 * documents HTTP 的 query/body Zod schema（仅边界校验，不含业务）。
 */
import { z } from "zod";
import { FILE_TYPE } from "../../shared/file-types.js";
import {
  optionalQueryNumber,
  optionalQueryString,
  requiredQueryString,
} from "../infra/http/request.js";

const contentFormatMarkdown = z
  .enum(["markdown", "lexical"])
  .optional()
  .transform((v) => (v === "markdown" ? ("markdown" as const) : undefined));

export const deletedQuerySchema = z.object({
  limit: optionalQueryNumber,
});

export const restoreBodySchema = z.object({
  auditId: z.coerce.number().int().positive(),
});

export const listDocumentsQuerySchema = z.object({
  domainId: optionalQueryString,
  domainName: optionalQueryString,
});

export const createDocumentBodySchema = z.object({
  fileName: z.string(),
  content: z.string(),
  displayName: z.string().optional(),
  domainId: z.string().optional(),
  permission: z.number().optional(),
  parentId: z.string().optional(),
  contentFormat: contentFormatMarkdown,
  fileType: z
    .enum([
      FILE_TYPE.DOCUMENT,
      FILE_TYPE.HTML,
      FILE_TYPE.SHEET,
      FILE_TYPE.JOB,
    ])
    .optional()
    .transform((v) => v ?? FILE_TYPE.DOCUMENT),
});

export const convertBodySchema = z.object({
  content: z.string(),
  from: z.enum(["markdown", "lexical"]),
  to: z.enum(["markdown", "lexical"]),
});

export const embeddingIndexQuerySchema = z.object({
  domainId: optionalQueryString,
});

export const embeddingRebuildBodySchema = z.object({
  documentIds: z.array(z.string()),
});

export const syncStatusQuerySchema = z.object({
  localBaseCommitId: optionalQueryString,
});

export const mergeContextQuerySchema = z.object({
  localBaseCommitId: requiredQueryString,
  remoteCommitId: requiredQueryString,
});

export const getDocumentQuerySchema = z.object({
  format: z
    .enum(["json", "text"])
    .optional()
    .transform((v) => (v === "text" ? ("text" as const) : ("json" as const))),
});

export const jobConfigPutBodySchema = z.object({
  cron: z.string().optional(),
  prompt: z.string().optional(),
  jobType: z.string().optional(),
  tableSchema: z
    .object({
      x: z.string().optional(),
      y: z.string().optional(),
    })
    .optional(),
});

export const monitorConfigPutBodySchema = z
  .object({
    rules: z.array(z.any()).optional(),
    MonitorConfig: z.array(z.any()).optional(),
  })
  .refine((b) => Array.isArray(b.rules) || Array.isArray(b.MonitorConfig), {
    message: "rules (or MonitorConfig) array is required",
  })
  .transform((b) => ({
    rules: (b.rules ?? b.MonitorConfig!) as Array<{
      monitorId?: string;
      rule?: string;
      threshold?: number;
    }>,
  }));

export const jobLimitQuerySchema = z.object({
  limit: optionalQueryNumber,
});

export const jobDataDeleteBodySchema = z.object({
  ids: z.array(z.coerce.number()).optional(),
  all: z.boolean().optional(),
});

export const moveDocumentBodySchema = z.object({
  parentId: z.union([z.string(), z.null()]),
});

const publishMergeSchema = z.object({
  remoteCommitId: z.string(),
  localSnapshotContent: z.string().optional(),
  forceLocal: z
    .boolean()
    .optional()
    .transform((v) => (v === true ? (true as const) : undefined)),
});

const publishVersionSchema = z
  .object({
    localBaseCommitId: z.string().optional(),
    merge: publishMergeSchema.optional(),
  })
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    if (!v.localBaseCommitId && !v.merge) return undefined;
    return v;
  });

export const updateDocumentBodySchema = z.object({
  content: z.string(),
  displayName: z.string().optional(),
  permission: z.number().optional(),
  contentFormat: contentFormatMarkdown,
  version: publishVersionSchema,
  message: z.string().optional(),
  source: z.enum(["auto", "manual", "agent", "cli"]).optional(),
});

export const suggestCommitMessageBodySchema = z.object({
  content: z.string(),
  contentFormat: z
    .enum(["markdown", "lexical"])
    .optional()
    .transform((v) => (v === "markdown" ? ("markdown" as const) : ("lexical" as const))),
});

export const suggestDocumentMergeBodySchema = z.object({
  localContent: z.string(),
  localBaseCommitId: z.string().optional(),
  contentFormat: z
    .enum(["markdown", "plain", "lexical"])
    .optional()
    .transform((v) => v ?? ("markdown" as const)),
});

export const suggestMergeResolutionsBodySchema = z
  .object({
    conflictMarkdown: z.string().optional(),
    markedText: z.string().optional(),
  })
  .transform((b, ctx) => {
    const conflictMarkdown = b.conflictMarkdown ?? b.markedText;
    if (typeof conflictMarkdown !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "conflictMarkdown is required",
      });
      return z.NEVER;
    }
    return { conflictMarkdown };
  });

export const suggestMergeMessageBodySchema = z.object({
  localContent: z.string(),
  remoteContent: z.string(),
  mergedContent: z.string(),
  baseContent: z.string().optional(),
  contentFormat: z
    .enum(["markdown", "plain", "lexical"])
    .optional()
    .transform((v) =>
      v === "markdown" || v === "plain" ? v : ("lexical" as const),
    ),
});

export const searchBodySchema = z.object({
  query: z.string().trim().min(1),
  domainId: z.string().optional(),
  topN: z.number().optional(),
  mode: z
    .enum(["auto", "keyword", "semantic"])
    .optional()
    .transform((v) =>
      v === "keyword" || v === "semantic" ? v : ("auto" as const),
    ),
});

export const addInviteBodySchema = z.object({
  targetVisitorId: z.string().min(1),
  targetPermission: z.string().min(1),
});
