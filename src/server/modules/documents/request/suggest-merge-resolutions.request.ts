import { IsOptional, IsString } from "class-validator";

export class SuggestMergeResolutionsRequest {
  @IsOptional()
  @IsString()
  conflictMarkdown?: string;

  @IsOptional()
  @IsString()
  markedText?: string;

  resolveConflictMarkdown(): string {
    const v = this.conflictMarkdown ?? this.markedText;
    if (typeof v !== "string") {
      throw new Error("conflictMarkdown is required");
    }
    return v;
  }
}
