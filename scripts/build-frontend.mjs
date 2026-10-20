import { build } from "vite";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

await build();
const output = resolve("dist");
const manifest = JSON.parse(await readFile(resolve(output, "manifest.webmanifest"), "utf8"));
if (manifest.start_url !== "./" || manifest.scope !== "./" || manifest.id !== "./") throw new Error("The app manifest must remain project-scoped.");
const configuration = JSON.parse(await readFile(resolve(output, "config.json"), "utf8"));
if (typeof configuration.apiOrigin !== "string") throw new Error("config.json must specify apiOrigin.");
await writeFile(resolve(output, ".nojekyll"), "");
