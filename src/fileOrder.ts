/** File sorting rules for Hunk changesets. */

export type FileSortOrder = "mixed" | "filesFirst" | "foldersFirst";

export interface FileSortOptions {
  sortOrder: FileSortOrder;
  caseSensitive: boolean;
}

export interface SortableFile {
  path: string;
  isUntracked?: boolean;
}

const utf8 = new TextEncoder();

/** Byte-wise UTF-8 comparison without locale collation. */
export function compareUtf8(left: string, right: string): number {
  const leftBytes = utf8.encode(left);
  const rightBytes = utf8.encode(right);
  const shared = Math.min(leftBytes.length, rightBytes.length);

  for (let index = 0; index < shared; index += 1) {
    const l = leftBytes[index]!;
    const r = rightBytes[index]!;
    if (l !== r) return l < r ? -1 : 1;
  }

  return leftBytes.length === rightBytes.length ? 0 : leftBytes.length < rightBytes.length ? -1 : 1;
}

interface TrieNode<T extends SortableFile> {
  path: string;
  children: Map<string, TrieNode<T>>;
  file?: T;
}

function buildTrie<T extends SortableFile>(files: readonly T[]): TrieNode<T> {
  const root: TrieNode<T> = { path: "", children: new Map() };

  for (const file of files) {
    let node = root;
    for (const segment of file.path.split("/")) {
      let child = node.children.get(segment);
      if (!child) {
        child = {
          path: node === root ? segment : `${node.path}/${segment}`,
          children: new Map(),
        };
        node.children.set(segment, child);
      }
      node = child;
    }
    node.file = file;
  }

  return root;
}

function compareNodes<T extends SortableFile>(
  left: TrieNode<T>,
  right: TrieNode<T>,
  options: FileSortOptions,
): number {
  const leftIsFile = left.file !== undefined;
  const rightIsFile = right.file !== undefined;
  if (leftIsFile !== rightIsFile) {
    if (options.sortOrder === "filesFirst") return leftIsFile ? -1 : 1;
    if (options.sortOrder === "foldersFirst") return leftIsFile ? 1 : -1;
  }

  const leftPath = options.caseSensitive ? left.path : left.path.toLowerCase();
  const rightPath = options.caseSensitive ? right.path : right.path.toLowerCase();
  return compareUtf8(leftPath, rightPath);
}

function flattenSorted<T extends SortableFile>(
  node: TrieNode<T>,
  options: FileSortOptions,
): T[] {
  const children = [...node.children.values()].sort((left, right) =>
    compareNodes(left, right, options),
  );

  const leaves: T[] = [];
  for (const child of children) {
    if (child.file) leaves.push(child.file);
    else leaves.push(...flattenSorted(child, options));
  }
  return leaves;
}

/**
 * Sort paths through a trie, then keep tracked files above untracked files.
 * Hunk does not expose merge-conflict state to changeset transforms.
 */
export function sortFiles<T extends SortableFile>(
  files: readonly T[],
  options: FileSortOptions = { sortOrder: "mixed", caseSensitive: true },
): T[] {
  const flattened = flattenSorted(buildTrie(files), options);
  const tracked: T[] = [];
  const untracked: T[] = [];

  for (const file of flattened) {
    if (file.isUntracked) untracked.push(file);
    else tracked.push(file);
  }
  return [...tracked, ...untracked];
}
