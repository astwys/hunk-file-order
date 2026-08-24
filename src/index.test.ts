import { expect, mock, test } from "bun:test";
import type { HunkExtensionAPI } from "hunkdiff/extension";
import extension from "./index";

function createApi(config: Record<string, unknown> = {}) {
  return { config, log: mock(), transformChangeset: mock() };
}

function transformOf(api: ReturnType<typeof createApi>) {
  return api.transformChangeset.mock.calls[0]?.[0] as (
    changeset: { files: unknown[] } & Record<string, unknown>,
    context?: { notify: ReturnType<typeof mock> },
  ) => unknown;
}

test("registers a changeset transform", () => {
  const api = createApi();
  extension(api as unknown as HunkExtensionAPI);
  expect(api.transformChangeset).toHaveBeenCalledTimes(1);
});

test("uses Hunk's native order when sortOrder is hunk", () => {
  const api = createApi({ sortOrder: "hunk" });
  extension(api as unknown as HunkExtensionAPI);
  expect(api.transformChangeset).not.toHaveBeenCalled();
});

test("orders files in mixed mode", () => {
  const api = createApi();
  extension(api as unknown as HunkExtensionAPI);
  const transform = transformOf(api);

  const result = transform({
    title: "Working tree",
    files: [
      { path: "zzz-untracked.ts", isUntracked: true },
      { path: "src/main.ts" },
      { path: "a.txt" },
      { path: "a/b.txt" },
    ],
  }) as { files: Array<{ path: string }> };

  expect(result.files.map((file) => file.path)).toEqual([
    "a/b.txt",
    "a.txt",
    "src/main.ts",
    "zzz-untracked.ts",
  ]);
});

test("preserves changeset fields and opaque metadata", () => {
  const api = createApi();
  extension(api as unknown as HunkExtensionAPI);
  const transform = transformOf(api);

  const metadata = { parsed: true };
  const result = transform({
    id: "session-1",
    title: "Working tree",
    files: [{ path: "b.ts", metadata }, { path: "a.ts", metadata }],
  }) as { id: string; title: string; files: Array<{ path: string; metadata: unknown }> };

  expect(result.id).toBe("session-1");
  expect(result.title).toBe("Working tree");
  expect(result.files.map((file) => file.path)).toEqual(["a.ts", "b.ts"]);
  for (const file of result.files) expect(file.metadata).toBe(metadata);
});

test("reports invalid config once and falls back to mixed sorting", () => {
  const api = createApi({ sortOrder: "name", caseSensitive: "yes" });
  extension(api as unknown as HunkExtensionAPI);
  const transform = transformOf(api);
  const notify = mock();

  const first = transform({ files: [{ path: "a.ts" }, { path: "a/b.ts" }] }, { notify }) as {
    files: Array<{ path: string }>;
  };
  transform({ files: [{ path: "b.ts" }, { path: "a.ts" }] }, { notify });

  expect(first.files.map((file) => file.path)).toEqual(["a/b.ts", "a.ts"]);
  expect(api.log).toHaveBeenNthCalledWith(
    1,
    'hunk-file-order: sortOrder must be "hunk", "mixed", "filesFirst", or "foldersFirst"',
  );
  expect(api.log).toHaveBeenNthCalledWith(2, "hunk-file-order: caseSensitive must be true or false");
  expect(notify).toHaveBeenNthCalledWith(
    1,
    'hunk-file-order: sortOrder must be "hunk", "mixed", "filesFirst", or "foldersFirst"',
    "warning",
  );
  expect(notify).toHaveBeenNthCalledWith(
    2,
    "hunk-file-order: caseSensitive must be true or false",
    "warning",
  );
  expect(notify).toHaveBeenCalledTimes(2);
});
