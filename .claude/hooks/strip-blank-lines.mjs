// Elimina las lineas en blanco de un archivo de codigo, respetando el contenido
// que no debe tocarse: template literals, strings multilinea y JSX text.
// Exporta `stripBlankLines(source, ext)` -> string.

const STRIPPABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
]);

export function isStrippable(ext) {
  return STRIPPABLE_EXTENSIONS.has(ext);
}

// Recorre el archivo caracter a caracter para saber, en cada salto de linea, si
// estamos dentro de un template literal (`...`) o de un comentario de bloque.
// Solo se borran las lineas vacias que estan fuera de esos contextos.
function protectedLines(source) {
  const protectedSet = new Set();
  let line = 1;
  let mode = "code"; // code | template | block-comment | line-comment | single | double
  const templateDepth = [];

  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    const next = source[i + 1];

    if (c === "\n") {
      line += 1;
      if (mode === "template" || mode === "block-comment") protectedSet.add(line);
      if (mode === "line-comment") mode = "code";
      if (mode === "single" || mode === "double") mode = "code";
      continue;
    }

    if (mode === "single" || mode === "double") {
      if (c === "\\") i += 1;
      else if ((mode === "single" && c === "'") || (mode === "double" && c === '"')) mode = "code";
      continue;
    }

    if (mode === "line-comment") continue;

    if (mode === "block-comment") {
      if (c === "*" && next === "/") {
        i += 1;
        mode = "code";
      }
      continue;
    }

    if (mode === "template") {
      if (c === "\\") i += 1;
      else if (c === "`") mode = "code";
      else if (c === "$" && next === "{") {
        i += 1;
        templateDepth.push("template");
        mode = "code";
      }
      continue;
    }

    // mode === "code"
    if (c === "/" && next === "/") {
      i += 1;
      mode = "line-comment";
    } else if (c === "/" && next === "*") {
      i += 1;
      mode = "block-comment";
    } else if (c === "`") {
      mode = "template";
    } else if (c === "'") {
      mode = "single";
    } else if (c === '"') {
      mode = "double";
    } else if (c === "}" && templateDepth.length > 0) {
      templateDepth.pop();
      mode = "template";
    } else if (c === "{" && templateDepth.length > 0) {
      templateDepth.push("brace");
    }
  }

  return protectedSet;
}

export function stripBlankLines(source, ext) {
  if (!isStrippable(ext)) return source;

  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const keep = protectedLines(source);
  const lines = source.split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i += 1) {
    const isBlank = lines[i].trim() === "";
    const isLast = i === lines.length - 1;
    // La ultima linea vacia es el salto final del archivo: se conserva.
    if (isBlank && !isLast && !keep.has(i + 1)) continue;
    out.push(lines[i]);
  }

  let result = out.join(eol);
  if (!result.endsWith(eol)) result += eol;
  return result;
}
