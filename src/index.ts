import type { HunkExtensionAPI } from "hunkdiff/extension";
import { parseConfig } from "./config";
import { sortFiles } from "./fileOrder";

const EXTENSION_ID = "hunk-file-order";

export default function (hunk: HunkExtensionAPI) {
  const { config, problems } = parseConfig(hunk.config);
  for (const problem of problems) hunk.log(`${EXTENSION_ID}: ${problem}`);

  if (config.sortOrder === "hunk") return;

  const options = {
    sortOrder: config.sortOrder,
    caseSensitive: config.caseSensitive,
  };
  let reported = false;
  hunk.transformChangeset((changeset, ctx) => {
    if (!reported && problems.length > 0) {
      reported = true;
      for (const problem of problems) ctx.notify(`${EXTENSION_ID}: ${problem}`, "warning");
    }

    return {
      ...changeset,
      files: sortFiles(changeset.files, options),
    };
  });
}
