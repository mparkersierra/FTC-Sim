import type * as Monaco from "monaco-editor";
import { generatedFtcJavaApi } from "./generatedFtcJavaApi";
import type { GeneratedJavaType } from "./generatedFtcJavaApi";

type MonacoApi = typeof Monaco;
type CompletionItem = Monaco.languages.CompletionItem;
type CompletionList = Monaco.languages.CompletionList;
type ITextModel = Monaco.editor.ITextModel;
type CompletionContext = {
  getWorkspaceSources?: () => Record<string, string>;
};

type JavaMember = {
  label: string;
  detail: string;
  insertText: string;
  kind: "field" | "method";
};

type JavaType = GeneratedJavaType & { members?: JavaMember[] };
type JavaSymbol = {
  label: string;
  detail: string;
  typeName: string;
};

let completionDisposable: Monaco.IDisposable | null = null;

const memberInsertTextOverrides = new Map(
  Object.entries({
    "LinearOpMode.runOpMode": [
      "@Override",
      "public void runOpMode() {",
      "\t${1:// initialization code}",
      "",
      "\twaitForStart();",
      "",
      "\twhile (opModeIsActive()) {",
      "\t\t${2:// robot code}",
      "\t}",
      "}",
    ].join("\n"),
    "OpMode.init": ["@Override", "public void init() {", "\t${1:// initialization code}", "}"].join("\n"),
    "OpMode.init_loop": ["@Override", "public void init_loop() {", "\t${1:// runs repeatedly before start}", "}"].join("\n"),
    "OpMode.start": ["@Override", "public void start() {", "\t${1:// start code}", "}"].join("\n"),
    "OpMode.loop": ["@Override", "public void loop() {", "\t${1:// repeated code}", "}"].join("\n"),
    "OpMode.stop": ["@Override", "public void stop() {", "\t${1:// stop code}", "}"].join("\n"),
  }),
);

const ignoredCompletionMembers = new Set([
  "DcMotor.getAppliedPower",
]);

const generatedJavaTypes: JavaType[] = generatedFtcJavaApi.map((type) => ({
  ...type,
  members: type.members?.map((member) => ({
    ...member,
    insertText: memberInsertTextOverrides.get(`${type.simpleName}.${member.label}`) ?? member.insertText,
  })),
}));

let activeJavaTypes = generatedJavaTypes;
let activeTypesBySimpleName = new Map(generatedJavaTypes.map((type) => [type.simpleName, type]));
const implicitVariables = new Map([
  ["hardwareMap", "HardwareMap"],
  ["telemetry", "Telemetry"],
  ["gamepad1", "Gamepad"],
  ["gamepad2", "Gamepad"],
]);

export function registerFtcJavaCompletions(monaco: MonacoApi, context: CompletionContext = {}) {
  completionDisposable?.dispose();
  completionDisposable = monaco.languages.registerCompletionItemProvider("java", {
    triggerCharacters: [".", "@"],
    provideCompletionItems: (model, position): CompletionList => {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const source = model.getValue();
      const offset = model.getOffsetAt(position);
      const beforeCursor = source.slice(0, offset);
      const memberTarget = beforeCursor.match(/((?:[A-Za-z_$][\w$]*\.)+)$/);
      refreshActiveTypes({
        ...(context.getWorkspaceSources?.() ?? {}),
        [model.uri.toString()]: source,
      });

      if (memberTarget) {
        return {
          suggestions: memberCompletions(monaco, source, memberTarget[1].split(".").filter(Boolean), range),
        };
      }

      if (beforeCursor.endsWith("@")) {
        return {
          suggestions: annotationCompletions(monaco, model, range),
        };
      }

      return {
        suggestions: [
          ...localSymbolCompletions(monaco, source, offset, range),
          ...currentClassMemberCompletions(monaco, source, range),
          ...classCompletions(monaco, model, range),
          ...snippetCompletions(monaco, model, range),
          ...implicitVariableCompletions(monaco, range),
        ],
      };
    },
  });
}

function classCompletions(monaco: MonacoApi, model: ITextModel, range: Monaco.IRange): CompletionItem[] {
  return activeJavaTypes.map((type) => ({
    label: type.simpleName,
    kind: completionKindForType(monaco, type),
    detail: type.fullName,
    documentation: type.detail,
    insertText: type.simpleName,
    range,
    additionalTextEdits: importEditForType(monaco, model, type),
  }));
}

function annotationCompletions(monaco: MonacoApi, model: ITextModel, range: Monaco.IRange): CompletionItem[] {
  return activeJavaTypes.filter((type) => type.kind === "annotation").map((type) => {
    return {
      label: type.simpleName,
      kind: monaco.languages.CompletionItemKind.Class,
      detail: type.fullName,
      insertText:
        type.simpleName === "Disabled"
          ? "Disabled"
          : `${type.simpleName}(name = "\${1:${type.simpleName} OpMode}", group = "\${2:FTC Sim}")`,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      additionalTextEdits: importEditForType(monaco, model, type),
    };
  });
}

function snippetCompletions(monaco: MonacoApi, model: ITextModel, range: Monaco.IRange): CompletionItem[] {
  const dcMotorType = activeTypesBySimpleName.get("DcMotor");

  return [
    {
      label: "hardwareMap.get DcMotor",
      kind: monaco.languages.CompletionItemKind.Snippet,
      detail: "DcMotor motor = hardwareMap.get(DcMotor.class, \"name\")",
      insertText: 'DcMotor ${1:motor} = hardwareMap.get(DcMotor.class, "${2:name}");',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      additionalTextEdits: dcMotorType ? importEditForType(monaco, model, dcMotorType) : [],
    },
    {
      label: "telemetry.addData",
      kind: monaco.languages.CompletionItemKind.Snippet,
      detail: "telemetry.addData and update",
      insertText: 'telemetry.addData("${1:caption}", ${2:value});\ntelemetry.update();',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
    },
    {
      label: "while opModeIsActive",
      kind: monaco.languages.CompletionItemKind.Snippet,
      detail: "LinearOpMode active loop",
      insertText: "while (opModeIsActive()) {\n    ${1:// code}\n}",
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
    },
  ];
}

function implicitVariableCompletions(monaco: MonacoApi, range: Monaco.IRange): CompletionItem[] {
  return Array.from(implicitVariables.entries()).map(([label, typeName]) => ({
    label,
    kind: monaco.languages.CompletionItemKind.Variable,
    detail: typeName,
    insertText: label,
    range,
  }));
}

function localSymbolCompletions(
  monaco: MonacoApi,
  source: string,
  offset: number,
  range: Monaco.IRange,
): CompletionItem[] {
  return currentFileSymbols(source, offset).map((symbol) => ({
    label: symbol.label,
    kind: monaco.languages.CompletionItemKind.Variable,
    detail: symbol.detail,
    insertText: symbol.label,
    range,
  }));
}

function memberCompletions(
  monaco: MonacoApi,
  source: string,
  expressionParts: string[],
  range: Monaco.IRange,
): CompletionItem[] {
  const type = inferExpressionType(source, expressionParts);
  if (!type) return [];

  const enumValueCompletions =
    type.enumValues?.map((enumValue) => ({
      label: enumValue,
      kind: monaco.languages.CompletionItemKind.EnumMember,
      detail: `${type.simpleName}.${enumValue}`,
      insertText: enumValue,
      range,
    })) ?? [];

  const memberItems =
    membersForType(type).map((member) => ({
      label: member.label,
      kind:
        member.kind === "method"
          ? monaco.languages.CompletionItemKind.Method
          : monaco.languages.CompletionItemKind.Field,
      detail: member.detail,
      insertText: member.insertText,
      insertTextRules: member.insertText.includes("${")
        ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        : undefined,
      range,
    })) ?? [];

  return [...enumValueCompletions, ...memberItems];
}

function inferExpressionType(source: string, expressionParts: string[]): JavaType | null {
  const [rootVariableName, ...memberNames] = expressionParts;
  let currentType = inferVariableType(source, rootVariableName);

  for (const memberName of memberNames) {
    const member = currentType ? membersForType(currentType).find((candidate) => candidate.label === memberName) : null;
    currentType = member ? normalizeTypeName(typeNameFromMemberDetail(member.detail)) : null;
  }

  return currentType;
}

function typeNameFromMemberDetail(detail: string) {
  return detail.trim().split(/\s+/)[0] ?? "";
}

function membersForType(type: JavaType): JavaMember[] {
  const inheritedType = type.extendsName ? normalizeTypeName(type.extendsName) : null;
  const ownMembers = (type.members ?? []).filter((member) => !ignoredCompletionMembers.has(`${type.simpleName}.${member.label}`));
  const members = [...(inheritedType ? membersForType(inheritedType) : []), ...ownMembers];
  const seen = new Set<string>();

  return members.filter((member) => {
    const key = `${member.kind}:${member.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferVariableType(source: string, variableName: string): JavaType | null {
  const implicitTypeName = implicitVariables.get(variableName);
  if (implicitTypeName) return activeTypesBySimpleName.get(implicitTypeName) ?? null;

  const symbolTypeName = currentFileSymbols(source, source.length).find((symbol) => symbol.label === variableName)?.typeName;
  if (symbolTypeName) return normalizeTypeName(symbolTypeName);

  const escapedVariableName = escapeRegExp(variableName);
  const assignmentPattern = new RegExp(
    `(?:final\\s+)?([A-Za-z_$][\\w$.]*)\\s+${escapedVariableName}\\s*=\\s*hardwareMap\\.get\\(\\s*([A-Za-z_$][\\w$]*)\\.class`,
    "g",
  );
  const declarationPattern = new RegExp(
    `(?:^|[;{}()\\n\\r])\\s*(?:private\\s+|public\\s+|protected\\s+)?(?:final\\s+)?([A-Za-z_$][\\w$.]*)\\s+${escapedVariableName}\\b`,
    "g",
  );

  const assignmentMatches = Array.from(source.matchAll(assignmentPattern));
  const latestAssignment = assignmentMatches[assignmentMatches.length - 1];
  if (latestAssignment) {
    return normalizeTypeName(latestAssignment[2]) ?? normalizeTypeName(latestAssignment[1]);
  }

  const declarationMatches = Array.from(source.matchAll(declarationPattern));
  const latestDeclaration = declarationMatches[declarationMatches.length - 1];
  if (latestDeclaration) {
    return normalizeTypeName(latestDeclaration[1]);
  }

  return null;
}

function currentFileSymbols(source: string, offset: number): JavaSymbol[] {
  const sourceBeforeCursor = stripJavaCommentsAndStrings(source.slice(0, offset));
  const symbols: JavaSymbol[] = [];
  const symbolPattern = new RegExp(
    [
      "\\b(?:private\\s+|public\\s+|protected\\s+|static\\s+|final\\s+|volatile\\s+|transient\\s+)*",
      "([A-Za-z_$][\\w$.]*(?:\\s*<[^;{}()=]+>)?(?:\\s*\\[\\])?)",
      "\\s+([A-Za-z_$][\\w$]*)",
      "\\s*(?=[=;,):])",
    ].join(""),
    "g",
  );

  for (const match of sourceBeforeCursor.matchAll(symbolPattern)) {
    const typeName = normalizeDeclarationType(match[1]);
    const label = match[2];

    if (!typeName || reservedNonTypeKeywords.has(typeName) || javaKeywords.has(label)) {
      continue;
    }

    symbols.push({
      label,
      typeName,
      detail: `${typeName} ${label}`,
    });
  }

  return dedupeSymbols(symbols);
}

function normalizeDeclarationType(typeName: string) {
  return typeName.replace(/\s+/g, " ").trim();
}

function dedupeSymbols(symbols: JavaSymbol[]) {
  const seen = new Set<string>();

  return symbols.filter((symbol) => {
    if (seen.has(symbol.label)) return false;
    seen.add(symbol.label);
    return true;
  });
}

function stripJavaCommentsAndStrings(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function refreshActiveTypes(workspaceSources: Record<string, string>) {
  const workspaceTypes = Object.values(workspaceSources).flatMap(parseWorkspaceJavaTypes);
  const mergedTypes = [...generatedJavaTypes, ...workspaceTypes];
  const seenFullNames = new Set<string>();

  activeJavaTypes = mergedTypes.filter((type) => {
    if (seenFullNames.has(type.fullName)) return false;
    seenFullNames.add(type.fullName);
    return true;
  });
  activeTypesBySimpleName = new Map(activeJavaTypes.map((type) => [type.simpleName, type]));
}

function parseWorkspaceJavaTypes(source: string): JavaType[] {
  const cleanedSource = stripJavaCommentsAndStrings(source);
  const packageName = cleanedSource.match(/\bpackage\s+([\w.]+)\s*;/)?.[1] ?? "";
  const classPattern =
    /\b(?:(?:public|private|protected)\s+)?(?:(?:abstract|final|static)\s+)?(class|enum|interface)\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$.]*))?/g;

  return Array.from(cleanedSource.matchAll(classPattern)).map((match) => {
    const kind = match[1] as JavaType["kind"];
    const simpleName = match[2];
    const extendsName = match[3];
    const body = bodyAfterDeclaration(cleanedSource, match.index ?? 0);

    return {
      kind,
      simpleName,
      fullName: packageName ? `${packageName}.${simpleName}` : simpleName,
      detail: `TeamCode ${kind} ${simpleName}`,
      extendsName,
      members: workspaceMembersFromBody(body, simpleName),
      enumValues: kind === "enum" ? enumValuesFromBody(body) : undefined,
    };
  });
}

function workspaceMembersFromBody(body: string, ownerName: string): JavaMember[] {
  const topLevelBody = topLevelClassBodyText(body);
  const fieldPattern =
    /(?:^|[;\n\r])\s*(?:(?:public|private|protected)\s+)?(?:(?:static|final|volatile|transient)\s+)*([A-Za-z_$][\w$.]*(?:\s*<[^;{}()=]+>)?(?:\s*\[\])?)\s+([^;(){}]+);/g;
  const methodPattern =
    /(?:^|[;\n\r])\s*(?:(?:public|private|protected)\s+)?(?:(?:static|final|abstract|synchronized)\s+)*(?:<[^>]+>\s+)?([A-Za-z_$][\w$.[\]<>?]*)\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*(?:throws\s+[^{;]+)?[{;]/g;

  const fields = Array.from(topLevelBody.matchAll(fieldPattern)).flatMap((match) => {
    const typeName = normalizeDeclarationType(match[1]);
    return match[2]
      .split(",")
      .map((declarator) => declarator.trim().match(/^([A-Za-z_$][\w$]*)/)?.[1])
      .filter((label): label is string => Boolean(label))
      .map((label) => ({
        kind: "field" as const,
        label,
        detail: `${typeName} ${label}`,
        insertText: label,
      }));
  });

  const methods = Array.from(topLevelBody.matchAll(methodPattern))
    .filter((match) => match[2] !== ownerName)
    .map((match) => ({
      kind: "method" as const,
      label: match[2],
      detail: `${normalizeDeclarationType(match[1])} ${match[2]}(${normalizeDeclarationType(match[3])})`,
      insertText: `${match[2]}($1)`,
    }));

  return dedupeMembers([...fields, ...methods]);
}

function topLevelClassBodyText(body: string) {
  let depth = 0;

  return Array.from(body)
    .map((character) => {
      if (character === "{") {
        depth += 1;
        return "{";
      }

      if (character === "}") {
        depth = Math.max(0, depth - 1);
        return "}";
      }

      return depth === 0 ? character : character === "\n" || character === "\r" ? character : " ";
    })
    .join("");
}

function bodyAfterDeclaration(source: string, declarationIndex: number) {
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

function enumValuesFromBody(body: string) {
  const beforeMembers = body.split(";")[0] ?? body;
  return beforeMembers
    .split(",")
    .map((value) => value.trim().match(/^([A-Z][A-Z0-9_]*)\b/)?.[1])
    .filter((value): value is string => Boolean(value));
}

function dedupeMembers(members: JavaMember[]) {
  const seen = new Set<string>();

  return members.filter((member) => {
    const key = `${member.kind}:${member.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeTypeName(typeName: string): JavaType | null {
  const typeNameParts = typeName.split(".");
  const simpleName = typeNameParts[typeNameParts.length - 1] ?? typeName;
  return activeTypesBySimpleName.get(simpleName) ?? null;
}

function importEditForType(monaco: MonacoApi, model: ITextModel, type: JavaType): Monaco.editor.ISingleEditOperation[] {
  const source = model.getValue();
  if (source.includes(`import ${type.fullName};`) || source.includes(`${type.fullName}`)) {
    return [];
  }

  const lineNumber = importInsertLine(model);
  return [
    {
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      text: `import ${type.fullName};\n`,
    },
  ];
}

function importInsertLine(model: ITextModel) {
  let lastImportLine = 0;
  let packageLine = 0;

  for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber += 1) {
    const line = model.getLineContent(lineNumber).trim();
    if (line.startsWith("package ")) {
      packageLine = lineNumber;
    }

    if (line.startsWith("import ")) {
      lastImportLine = lineNumber;
    }
  }

  if (lastImportLine > 0) return lastImportLine + 1;
  if (packageLine > 0) return packageLine + 1;
  return 1;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function completionKindForType(monaco: MonacoApi, type: JavaType) {
  if (type.kind === "enum") return monaco.languages.CompletionItemKind.Enum;
  if (type.kind === "interface") return monaco.languages.CompletionItemKind.Interface;
  return monaco.languages.CompletionItemKind.Class;
}

const javaKeywords = new Set([
  "abstract",
  "assert",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extends",
  "final",
  "finally",
  "float",
  "for",
  "goto",
  "if",
  "implements",
  "import",
  "instanceof",
  "int",
  "interface",
  "long",
  "native",
  "new",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "strictfp",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "try",
  "void",
  "volatile",
  "while",
]);

const javaPrimitiveTypes = new Set(["boolean", "byte", "char", "double", "float", "int", "long", "short"]);
const reservedNonTypeKeywords = new Set([...javaKeywords].filter((keyword) => !javaPrimitiveTypes.has(keyword)));

function currentClassMemberCompletions(
  monaco: MonacoApi,
  source: string,
  range: Monaco.IRange,
): CompletionItem[] {
  const extendsMatch = source.match(/\bclass\s+[A-Za-z_$][\w$]*\s+extends\s+([A-Za-z_$][\w$.]*)/);

  if (!extendsMatch) return [];

  const parentType = normalizeTypeName(extendsMatch[1]);
  if (!parentType) return [];

  return membersForType(parentType).map((member) => ({
    label: member.label,
    kind:
      member.kind === "method"
        ? monaco.languages.CompletionItemKind.Method
        : monaco.languages.CompletionItemKind.Field,
    detail: member.detail,
    insertText: member.insertText,
    insertTextRules: member.insertText.includes("${")
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      : undefined,
    range,
  }));
}
