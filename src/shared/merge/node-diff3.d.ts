declare module "node-diff3" {
  export interface Diff3ConflictChunk<T> {
    a: T[];
    o: T[];
    b: T[];
    aIndex: number;
    oIndex: number;
    bIndex: number;
  }

  export type Diff3MergeResult<T> =
    | { ok: T[]; conflict?: undefined }
    | { ok?: undefined; conflict: Diff3ConflictChunk<T> };

  export function diff3Merge<T>(
    mine: T[],
    original: T[],
    theirs: T[],
    options?: Record<string, unknown>,
  ): Diff3MergeResult<T>[];
}
