import { describe, expect, test } from "bun:test";
import { compareUtf8, sortFiles } from "./fileOrder";

/**
 * Mixed mode sorts trie siblings by their accumulated prefix path, walks them
 * depth-first, then puts tracked files above untracked files.
 */

function order(paths: string[]): string[] {
  return sortFiles(paths.map((path) => ({ path }))).map((file) => file.path);
}

describe("sortFiles", () => {
  test("groups by directory before comparing full paths", () => {
    // Root siblings are "README.md" and "src": 'R' (0x52) < 's' (0x73).
    expect(order(["src/main.ts", "README.md", "src/lib/z.ts"])).toEqual([
      "README.md",
      "src/lib/z.ts",
      "src/main.ts",
    ]);
  });

  test("sorts a/b.txt before a.txt — the case a global sort gets wrong", () => {
    // Siblings compared are "a" and "a.txt"; "a" is a prefix so it sorts first.
    // A naive full-path byte sort would put "a.txt" first ('.' 0x2E < '/' 0x2F).
    expect(order(["a.txt", "a/b.txt"])).toEqual(["a/b.txt", "a.txt"]);
  });

  test("orders deep chains by directory prefix at each level", () => {
    expect(order(["a/e.txt", "a/b/c/d.txt"])).toEqual(["a/b/c/d.txt", "a/e.txt"]);
  });

  test("is case-sensitive byte order, not alphabetical", () => {
    expect(order(["apple", "Zebra", "Banana"])).toEqual(["Banana", "Zebra", "apple"]);
  });

  test("supports case-insensitive sorting", () => {
    const files = ["apple", "Zebra", "Banana"].map((path) => ({ path }));
    expect(
      sortFiles(files, { sortOrder: "mixed", caseSensitive: false }).map((file) => file.path),
    ).toEqual(["apple", "Banana", "Zebra"]);
  });

  test("supports files-first and folders-first sorting", () => {
    const files = ["Dir/inner", "b-file", "Z-file"].map((path) => ({ path }));

    expect(
      sortFiles(files, { sortOrder: "filesFirst", caseSensitive: true }).map((file) => file.path),
    ).toEqual(["Z-file", "b-file", "Dir/inner"]);
    expect(
      sortFiles(files, { sortOrder: "foldersFirst", caseSensitive: true }).map((file) => file.path),
    ).toEqual(["Dir/inner", "Z-file", "b-file"]);
  });

  test("compares UTF-8 bytes, not locale collation", () => {
    // "é" encodes as 0xC3 0xA9, above 'z' (0x7A); localeCompare would flip this.
    expect(order(["éclair", "zephyr"])).toEqual(["zephyr", "éclair"]);
  });

  test("prefix boundaries follow byte order across separators", () => {
    // "src2" vs "src/a.ts" at root level: '2' (0x32) < '/' (0x2F)? No —
    // "src" is a prefix of both accumulated paths; next bytes '2' vs '/'.
    // '/' (0x2F) < '2' (0x32), so the directory comes first.
    expect(order(["src2/x.ts", "src/a.ts"])).toEqual(["src/a.ts", "src2/x.ts"]);
  });

  test("sinks untracked files below tracked ones per tier", () => {
    const result = sortFiles([
      { path: "zzz-new.ts", isUntracked: true },
      { path: "src/main.ts" },
      { path: "aaa-new.md", isUntracked: true },
      { path: "README.md" },
    ]);
    expect(result.map((f) => f.path)).toEqual([
      "README.md",
      "src/main.ts",
      "aaa-new.md",
      "zzz-new.ts",
    ]);
  });

  test("keeps trie-flattened order within each tier", () => {
    const result = sortFiles([
      { path: "b/track.ts" },
      { path: "new-root.md", isUntracked: true },
      { path: "a/track.ts" },
      { path: "other/new.ts", isUntracked: true },
    ]);
    expect(result.map((f) => f.path)).toEqual([
      "a/track.ts",
      "b/track.ts",
      "new-root.md",
      "other/new.ts",
    ]);
  });
});

describe("compareUtf8", () => {
  test("shorter prefix sorts first", () => {
    expect(compareUtf8("a", "a.txt")).toBe(-1);
    expect(compareUtf8("a.txt", "a")).toBe(1);
  });

  test("equal strings compare as zero", () => {
    expect(compareUtf8("same/path.ts", "same/path.ts")).toBe(0);
  });
});
