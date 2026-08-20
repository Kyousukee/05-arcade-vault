#!/usr/bin/env node
// PostToolUse hook: formatea con Prettier, auto-arregla con ESLint y compacta las
// lineas en blanco del archivo que Claude acaba de crear o editar.
// Sin dependencias externas (no hay `jq` en el sistema).
// Nunca falla: siempre sale con codigo 0 para no bloquear la sesion.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isStrippable, stripBlankLines } from "./strip-blank-lines.mjs";
const PROJECT_DIR = path.resolve(
  process.env.CLAUDE_PROJECT_DIR ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."),
);
const ESLINT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIPPED_DIRS = ["node_modules", ".next", ".git", "out", "build"];
function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}
function resolveFilePath(payload) {
  const raw = payload?.tool_response?.filePath ?? payload?.tool_input?.file_path;
  if (typeof raw !== "string" || raw.length === 0) return null;
  const absolute = path.resolve(PROJECT_DIR, raw);
  const relative = path.relative(PROJECT_DIR, absolute);
  // Fuera del proyecto (o en otro disco): no tocar.
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  if (relative.split(path.sep).some((segment) => SKIPPED_DIRS.includes(segment))) return null;
  if (!existsSync(absolute)) return null;
  return absolute;
}
function runBin(binRelativePath, args) {
  const bin = path.join(PROJECT_DIR, binRelativePath);
  if (!existsSync(bin)) return;
  spawnSync(process.execPath, [bin, ...args], {
    cwd: PROJECT_DIR,
    stdio: "ignore",
    timeout: 45_000,
  });
}
try {
  const payload = JSON.parse(readStdin());
  const file = resolveFilePath(payload);
  if (file) {
    runBin("node_modules/prettier/bin/prettier.cjs", ["--write", "--ignore-unknown", file]);
    const ext = path.extname(file);
    if (ESLINT_EXTENSIONS.has(ext)) {
      runBin("node_modules/eslint/bin/eslint.js", ["--fix", file]);
    }
    // Ultimo paso: sin lineas en blanco, solo codigo.
    if (isStrippable(ext)) {
      const source = readFileSync(file, "utf8");
      const compact = stripBlankLines(source, ext);
      if (compact !== source) writeFileSync(file, compact, "utf8");
    }
  }
} catch {
  // Archivo a medio editar, JSON invalido, etc. — se ignora en silencio.
}
process.exit(0);
