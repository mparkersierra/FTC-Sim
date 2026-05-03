import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const sourceRoot = join(repoRoot, "libs/ftc-sdk-shim/src/main/java");
const outputPath = join(repoRoot, "apps/desktop/src/editor/generatedFtcJavaApi.ts");

const javaFiles = walk(sourceRoot).filter((filePath) => filePath.endsWith(".java"));
const javaTypes = javaFiles.flatMap(parseJavaFile).sort((a, b) => a.fullName.localeCompare(b.fullName));

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  [
    "export type GeneratedJavaMember = {",
    '  kind: "field" | "method";',
    "  label: string;",
    "  detail: string;",
    "  insertText: string;",
    "};",
    "",
    "export type GeneratedJavaType = {",
    '  kind: "annotation" | "class" | "enum" | "interface";',
    "  simpleName: string;",
    "  fullName: string;",
    "  detail: string;",
    "  extendsName?: string;",
    "  members?: GeneratedJavaMember[];",
    "  enumValues?: string[];",
    "};",
    "",
    "export const generatedFtcJavaApi: GeneratedJavaType[] = ",
    `${JSON.stringify(javaTypes, null, 2)};`,
    "",
  ].join("\n"),
);

console.log(`Generated ${javaTypes.length} Java API completion types from ${relative(repoRoot, sourceRoot)}.`);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function parseJavaFile(filePath) {
  const source = stripComments(readFileSync(filePath, "utf8"));
  const packageName = source.match(/\bpackage\s+([\w.]+)\s*;/)?.[1];
  const declaration = source.match(
    /\bpublic\s+(?:(abstract|final)\s+)?(@interface|class|enum|interface)\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$.]*))?/,
  );

  if (!packageName || !declaration) return [];

  const [, , declarationKind, simpleName, extendsName] = declaration;
  const fullName = `${packageName}.${simpleName}`;
  const body = bodyAfterDeclaration(source, declaration.index ?? 0);
  const kind = declarationKind === "@interface" ? "annotation" : declarationKind;
  const topLevelType = compactType({
    kind,
    simpleName,
    fullName,
    detail: detailFor(kind, simpleName),
    extendsName,
    members: membersFromBody(body, simpleName),
    enumValues: kind === "enum" ? enumValuesFromBody(body) : undefined,
  });

  const nestedEnumTypes = nestedEnumsFromBody(body).map((nestedEnum) =>
    compactType({
      kind: "enum",
      simpleName: nestedEnum.simpleName,
      fullName: `${fullName}.${nestedEnum.simpleName}`,
      detail: `FTC Java enum ${nestedEnum.simpleName}`,
      members: membersFromBody(nestedEnum.body, nestedEnum.simpleName),
      enumValues: enumValuesFromBody(nestedEnum.body),
    }),
  );

  return [topLevelType, ...nestedEnumTypes];
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function bodyAfterDeclaration(source, declarationIndex) {
  const openBrace = source.indexOf("{", declarationIndex);
  if (openBrace === -1) return "";

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openBrace + 1, index);
  }

  return source.slice(openBrace + 1);
}

function nestedEnumsFromBody(body) {
  const nestedEnums = [];
  const enumPattern = /\bpublic\s+enum\s+([A-Za-z_$][\w$]*)/g;

  for (const match of body.matchAll(enumPattern)) {
    nestedEnums.push({
      simpleName: match[1],
      body: bodyAfterDeclaration(body, match.index ?? 0),
    });
  }

  return nestedEnums;
}

function membersFromBody(body, ownerName) {
  const methodPattern =
    /\bpublic\s+(?:(?:static|final|abstract|synchronized|default)\s+)*(?:<[^>]+>\s+)?([A-Za-z_$][\w$.[\]<>?]*(?:\s*<[^;{}()]+>)?)\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*(?:throws\s+[^{;]+)?[{;]/g;
  const fieldPattern =
    /\bpublic\s+(?:(?:static|final|volatile|transient)\s+)*([A-Za-z_$][\w$.[\]<>?]*)\s+([A-Za-z_$][\w$]*)\s*(?:=[^;]*)?;/g;

  const methods = Array.from(body.matchAll(methodPattern))
    .filter((match) => match[2] !== ownerName)
    .map((match) => methodMember(match[2], match[1], match[3]));

  const fields = Array.from(body.matchAll(fieldPattern)).map((match) => fieldMember(match[2], match[1]));
  return dedupeMembers([...fields, ...methods]);
}

function methodMember(name, returnType, parameters) {
  const normalizedParameters = normalizeWhitespace(parameters);
  return {
    kind: "method",
    label: name,
    detail: `${normalizeWhitespace(returnType)} ${name}(${normalizedParameters})`,
    insertText: `${name}($1)`,
  };
}

function fieldMember(name, type) {
  return {
    kind: "field",
    label: name,
    detail: `${normalizeWhitespace(type)} ${name}`,
    insertText: name,
  };
}

function enumValuesFromBody(body) {
  const beforeMembers = body.split(";")[0] ?? body;
  return beforeMembers
    .split(",")
    .map((value) => value.trim().match(/^([A-Z][A-Z0-9_]*)\b/)?.[1])
    .filter(Boolean);
}

function compactType(type) {
  return Object.fromEntries(
    Object.entries(type).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== "";
    }),
  );
}

function dedupeMembers(members) {
  const seen = new Set();
  return members.filter((member) => {
    const key = `${member.kind}:${member.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detailFor(kind, simpleName) {
  if (kind === "annotation") return `FTC Java annotation ${simpleName}`;
  if (kind === "enum") return `FTC Java enum ${simpleName}`;
  if (kind === "interface") return `FTC Java interface ${simpleName}`;
  return `FTC Java class ${simpleName}`;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}
