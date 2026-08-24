import type { FileSortOrder } from "./fileOrder";

export type SortOrder = FileSortOrder | "hunk";

export interface SortingConfig {
  sortOrder: SortOrder;
  caseSensitive: boolean;
}

const defaultConfig: SortingConfig = {
  sortOrder: "mixed",
  caseSensitive: true,
};

function isSortOrder(value: unknown): value is SortOrder {
  return value === "hunk" || value === "mixed" || value === "filesFirst" || value === "foldersFirst";
}

export function parseConfig(config: Record<string, unknown>): {
  config: SortingConfig;
  problems: string[];
} {
  const problems: string[] = [];
  const sortOrder = config.sortOrder;
  const caseSensitive = config.caseSensitive;
  const hasValidSortOrder = isSortOrder(sortOrder);

  if (sortOrder !== undefined && !hasValidSortOrder) {
    problems.push('sortOrder must be "hunk", "mixed", "filesFirst", or "foldersFirst"');
  }
  if (caseSensitive !== undefined && typeof caseSensitive !== "boolean") {
    problems.push("caseSensitive must be true or false");
  }

  return {
    config: {
      sortOrder: hasValidSortOrder ? sortOrder : defaultConfig.sortOrder,
      caseSensitive: typeof caseSensitive === "boolean" ? caseSensitive : defaultConfig.caseSensitive,
    },
    problems,
  };
}
