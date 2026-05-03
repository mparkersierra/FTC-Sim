import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const outputPath = join(repoRoot, "apps/desktop/src/editor/generatedJdkJavaApi.ts");

const jdkClasses = [
  "java.lang.Math",
  "java.lang.String",
  "java.lang.System",
  "java.lang.Thread",
  "java.io.PrintStream",
  "java.util.ArrayList",
  "java.util.HashMap",
  "java.util.List",
  "java.util.Map",
];

const javaTypes = jdkClasses.flatMap(generateClassApi).sort((a, b) => a.fullName.localeCompare(b.fullName));

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  [
    'import type { GeneratedJavaType } from "./generatedFtcJavaApi";',
    "",
    "export const generatedJdkJavaApi: GeneratedJavaType[] = ",
    `${JSON.stringify(javaTypes, null, 2)};`,
    "",
  ].join("\n"),
);

console.log(`Generated ${javaTypes.length} JDK API completion types.`);

function generateClassApi(className) {
  const output = execFileSync("javap", ["-public", className], { encoding: "utf8" });
  const declaration = output.match(/\bpublic\s+(?:final\s+|abstract\s+)?(class|interface|enum)\s+([\w.$]+)/);

  if (!declaration) return [];

  const kind = declaration[1];
  const fullName = declaration[2].replace(/\$/g, ".");
  const simpleName = fullName.split(".").pop() ?? fullName;
  const members = output
    .split("\n")
    .map((line) => parseMember(line.trim(), simpleName))
    .filter(Boolean);

  return [
    compactType({
      kind,
      simpleName,
      fullName,
      detail: `JDK ${kind} ${simpleName}`,
      members: dedupeMembers(members),
    }),
  ];
}

function parseMember(line, ownerName) {
  if (!line.startsWith("public ") || !line.endsWith(";")) return null;

  const normalizedLine = normalizeJavapLine(line);
  if (normalizedLine.includes(` ${ownerName}(`)) return null;

  const method = normalizedLine.match(
    /^public\s+(?:(?:static|final|native|synchronized|abstract|default)\s+)*(.+?)\s+([A-Za-z_$][\w$]*)\((.*)\);$/,
  );
  if (method) {
    return {
      kind: "method",
      label: method[2],
      detail: `${method[1]} ${method[2]}(${method[3]})`,
      insertText: `${method[2]}($1)`,
    };
  }

  const field = normalizedLine.match(/^public\s+(?:(?:static|final|volatile|transient)\s+)*(.+?)\s+([A-Za-z_$][\w$]*);$/);
  if (field) {
    return {
      kind: "field",
      label: field[2],
      detail: `${field[1]} ${field[2]}`,
      insertText: field[2],
    };
  }

  return null;
}

function normalizeJavapLine(line) {
  return line
    .replace(/\s+throws\s+.+;$/, ";")
    .replace(/\btransient\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
