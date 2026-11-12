import { describe, expect, test } from "vitest";
import { buildGraph } from "./index.js";
import type { GraphDeps } from "./types.js";

const FOLDER_ID = "536772fe-a95b-4dec-9299-385070671a3a";

function emptyDeps(): GraphDeps {
  return {
    extractDocNodes: async () => [],
    induceConceptNodes: async () => [],
    induceConceptRelations: async () => [],
    generateContains: async () => [],
    readMarkdown: async () => "",
    getCurrentCommitId: async () => "",
    getDocTitle: async () => "",
    readArticleCache: async () => null,
    writeArticleCache: async () => {},
    readDirGraph: async () => null,
    writeDirGraph: async () => {},
    readDomainGraph: async () => null,
    writeDomainGraph: async () => {},
  };
}

describe("folder progress label", () => {
  test("目录归纳进度用 display name，不用 document id", async () => {
    const labels: string[] = [];
    await buildGraph(
      {
        type: "folder",
        name: "产品需求",
        path: FOLDER_ID,
        documentId: FOLDER_ID,
        children: [],
      },
      emptyDeps(),
      {
        force: true,
        onFolderPhase: (e) => {
          labels.push(e.folderPath);
        },
      },
    );
    expect(labels).toEqual(["产品需求", "产品需求"]);
    expect(labels.some((label) => label.includes(FOLDER_ID))).toBe(false);
  });
});
