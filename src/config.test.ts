import { expect, test } from "bun:test";
import { parseConfig, type SortOrder } from "./config";

test("defaults to mixed, case-sensitive sorting", () => {
  expect(parseConfig({})).toEqual({
    config: { sortOrder: "mixed", caseSensitive: true },
    problems: [],
  });
});

test("accepts every sort order and a case-insensitive setting", () => {
  const sortOrders = ["hunk", "mixed", "filesFirst", "foldersFirst"] satisfies readonly SortOrder[];
  for (const sortOrder of sortOrders) {
    expect(parseConfig({ sortOrder, caseSensitive: false })).toEqual({
      config: { sortOrder, caseSensitive: false },
      problems: [],
    });
  }
});

test("reports invalid values and falls back to defaults", () => {
  expect(parseConfig({ sortOrder: "alphabetical", caseSensitive: "yes" })).toEqual({
    config: { sortOrder: "mixed", caseSensitive: true },
    problems: [
      'sortOrder must be "hunk", "mixed", "filesFirst", or "foldersFirst"',
      "caseSensitive must be true or false",
    ],
  });
});
