/**
 * Unit tests for diagram utility functions.
 * These are pure functions and can be tested without DOM or React.
 */

import { describe, it, expect } from "vitest";
import {
  parseDiagramPayload,
  calculateToolbarPosition,
  findChartBlocks,
  identifyChartBlock,
} from "./diagramUtils";

describe("diagramUtils", () => {
  describe("parseDiagramPayload", () => {
    it("should parse valid JSON object", () => {
      const result = parseDiagramPayload('{"type": "flow", "nodes": []}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ type: "flow", nodes: [] });
      }
    });

    it("should reject empty payload", () => {
      const result = parseDiagramPayload("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Empty payload");
      }
    });

    it("should reject invalid JSON", () => {
      const result = parseDiagramPayload("not-json");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid diagram JSON");
      }
    });

    it("should reject JSON array", () => {
      const result = parseDiagramPayload('[1, 2, 3]');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not an object");
      }
    });

    it("should reject JSON primitive", () => {
      const result = parseDiagramPayload('"string"');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not an object");
      }
    });

    it("should reject null JSON", () => {
      const result = parseDiagramPayload("null");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid diagram JSON");
      }
    });
  });

  describe("calculateToolbarPosition", () => {
    it("should calculate position with default offset", () => {
      const mockElement = {
        getBoundingClientRect: () => ({
          top: 100,
          right: 500,
        }),
      } as Element;

      const position = calculateToolbarPosition(mockElement);
      expect(position.top).toBe(106); // 100 + default offset 6, min 4
      expect(position.left).toBe(418); // 500 - 76 - 6
    });

    it("should respect minimum bounds", () => {
      const mockElement = {
        getBoundingClientRect: () => ({
          top: -50,
          right: 50,
        }),
      } as Element;

      const position = calculateToolbarPosition(mockElement);
      expect(position.top).toBe(4); // minimum bound
      expect(position.left).toBe(4); // minimum bound
    });

    it("should accept custom toolbar width and offset", () => {
      const mockElement = {
        getBoundingClientRect: () => ({
          top: 100,
          right: 300,
        }),
      } as Element;

      const position = calculateToolbarPosition(mockElement, 50, 10);
      expect(position.top).toBe(110); // 100 + 10
      expect(position.left).toBe(240); // 300 - 50 - 10
    });
  });

  describe("findChartBlocks", () => {
    it("should find blocks with meta2 source", () => {
      const container = document.createElement("div");
      container.innerHTML = `
        <div class="vditor-wysiwyg__block">
          <div class="vditor-wysiwyg__pre"><code class="language-meta2">{"test": 1}</code></div>
        </div>
        <div class="vditor-wysiwyg__block">
          <div class="vditor-wysiwyg__pre"><code class="language-javascript">code</code></div>
        </div>
        <div class="vditor-wysiwyg__block">
          <div class="vditor-wysiwyg__pre"><code class="language-meta">{"test": 2}</code></div>
        </div>
      `;

      const blocks = findChartBlocks(container);
      expect(blocks.length).toBe(2);
    });

    it("should return empty array when no blocks exist", () => {
      const container = document.createElement("div");
      const blocks = findChartBlocks(container);
      expect(blocks.length).toBe(0);
    });
  });

  describe("identifyChartBlock", () => {
    it("should identify chart block from target element", () => {
      const container = document.createElement("div");
      container.innerHTML = `
        <div class="vditor-wysiwyg__block">
          <div class="vditor-wysiwyg__pre"><code class="language-meta2">{"test": 1}</code></div>
        </div>
      `;
      document.body.appendChild(container);

      const codeElement = container.querySelector("code")!;
      const block = identifyChartBlock(codeElement, container);

      expect(block).toBeTruthy();
      expect(block?.classList.contains("vditor-wysiwyg__block")).toBe(true);

      document.body.removeChild(container);
    });

    it("should return null for non-chart block", () => {
      const container = document.createElement("div");
      container.innerHTML = `
        <div class="vditor-wysiwyg__block">
          <div class="vditor-wysiwyg__pre"><code class="language-javascript">code</code></div>
        </div>
      `;
      document.body.appendChild(container);

      const codeElement = container.querySelector("code")!;
      const block = identifyChartBlock(codeElement, container);

      expect(block).toBeNull();

      document.body.removeChild(container);
    });

    it("should return null for target outside container", () => {
      const container = document.createElement("div");
      const externalElement = document.createElement("div");
      document.body.appendChild(container);
      document.body.appendChild(externalElement);

      const block = identifyChartBlock(externalElement, container);
      expect(block).toBeNull();

      document.body.removeChild(container);
      document.body.removeChild(externalElement);
    });

    it("should handle text node targets", () => {
      const container = document.createElement("div");
      container.innerHTML = `
        <div class="vditor-wysiwyg__block">
          <div class="vditor-wysiwyg__pre"><code class="language-meta2">{"test": 1}</code></div>
        </div>
      `;
      document.body.appendChild(container);

      const textNode = container.querySelector("code")!.firstChild!;
      const block = identifyChartBlock(textNode, container);

      expect(block).toBeTruthy();

      document.body.removeChild(container);
    });
  });
});
