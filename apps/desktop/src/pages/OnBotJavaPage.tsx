import type {
  CSSProperties,
  FormEvent as ReactFormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { teamCodeFileTemplates } from "../config";
import { registerFtcJavaCompletions } from "../editor/ftcJavaCompletions";
import type {
  TabId,
  TeamCodeContextMenu,
  TeamCodeDialog,
  TeamCodeFileTemplate,
  TeamCodeFolder,
  TeamCodeImportConflictAction,
  TeamCodeImportConflictPrompt,
  TeamCodeOpModeBase,
  TeamCodeSelection,
} from "../types";

type TeamCodeDragItem = { kind: "file" | "folder"; path: string };

type OnBotJavaPageProps = {
  activeTab: TabId;
  codeFileName: string;
  codeStatus: string;
  codeText: string;
  exportedTeamCodeZipPath: string;
  openCodeFileTabs: string[];
  pendingCloseCodeFileTab: string | null;
  expandedTeamCodeFolders: Record<TeamCodeFolder, boolean>;
  isLoadingCodeFile: boolean;
  rootTeamCodeFiles: string[];
  runnerLog: string;
  selectedTargetLabel: string;
  teamCodeContextMenu: TeamCodeContextMenu | null;
  teamCodeDialog: TeamCodeDialog | null;
  teamCodeDialogSubmitLabel: string;
  teamCodeDialogTitle: string;
  teamCodeFilesByFolder: Record<TeamCodeFolder, string[]>;
  teamCodeFolders: string[];
  teamCodeImportConflictPrompt: TeamCodeImportConflictPrompt | null;
  teamCodeSelection: TeamCodeSelection;
  teamCodeSourceTextByFile: Record<string, string>;
  terminalHeight: number;
  onCreateCodeFile: () => void;
  onCreateCodeFileFromContextFolder: () => void;
  onCreateCodeFolder: () => void;
  onCreateCodeFolderFromContextFolder: () => void;
  onCancelCloseCodeFileTab: () => void;
  onConfirmSaveAndCloseCodeFileTab: () => void;
  onDeleteTeamCodeItem: () => void;
  onDismissDialog: () => void;
  onExportTeamCode: () => void;
  onImportTeamCodeGithubRepoLink: (repoUrl: string) => void;
  onImportTeamCodeZipFile: (file: File) => void;
  onLoadRunnerLog: () => void;
  onLoadTeamCodeFiles: () => void;
  onMoveTeamCodeItem: (item: TeamCodeDragItem, targetFolder: string) => void;
  onCloseCodeFileTab: (fileName: string) => void;
  onOpenCodeFile: (fileName: string) => void;
  onOpenTeamCodeExport: () => void;
  onOpenTeamCodeContextMenu: (
    event: ReactMouseEvent<HTMLButtonElement>,
    menu: Omit<TeamCodeContextMenu, "x" | "y">,
  ) => void;
  onRenameTeamCodeItem: () => void;
  onResolveTeamCodeImportConflict: (action: TeamCodeImportConflictAction) => void;
  onSaveCodeFile: () => void;
  onSaveCodeFileOnly: () => void;
  onSetCodeText: (value: string) => void;
  onStartTerminalResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSubmitTeamCodeDialog: (event: ReactFormEvent<HTMLFormElement>) => void;
  onToggleTeamCodeFolder: (folder: TeamCodeFolder) => void;
  onUpdateTeamCodeDialogOpModeBase: (opModeBase: TeamCodeOpModeBase) => void;
  onUpdateTeamCodeDialogTemplate: (template: TeamCodeFileTemplate) => void;
  onUpdateTeamCodeDialogValue: (value: string) => void;
  onUpdateTeamCodeImportConflictRenamePath: (value: string) => void;
};

export function OnBotJavaPage({
  activeTab,
  codeFileName,
  codeStatus,
  codeText,
  exportedTeamCodeZipPath,
  openCodeFileTabs,
  pendingCloseCodeFileTab,
  expandedTeamCodeFolders,
  isLoadingCodeFile,
  rootTeamCodeFiles,
  runnerLog,
  selectedTargetLabel,
  teamCodeContextMenu,
  teamCodeDialog,
  teamCodeDialogSubmitLabel,
  teamCodeDialogTitle,
  teamCodeFilesByFolder,
  teamCodeFolders,
  teamCodeImportConflictPrompt,
  teamCodeSelection,
  teamCodeSourceTextByFile,
  terminalHeight,
  onCreateCodeFile,
  onCreateCodeFileFromContextFolder,
  onCreateCodeFolder,
  onCreateCodeFolderFromContextFolder,
  onCancelCloseCodeFileTab,
  onConfirmSaveAndCloseCodeFileTab,
  onDeleteTeamCodeItem,
  onDismissDialog,
  onExportTeamCode,
  onImportTeamCodeGithubRepoLink,
  onImportTeamCodeZipFile,
  onLoadRunnerLog,
  onLoadTeamCodeFiles,
  onMoveTeamCodeItem,
  onCloseCodeFileTab,
  onOpenCodeFile,
  onOpenTeamCodeExport,
  onOpenTeamCodeContextMenu,
  onRenameTeamCodeItem,
  onResolveTeamCodeImportConflict,
  onSaveCodeFile,
  onSaveCodeFileOnly,
  onSetCodeText,
  onStartTerminalResize,
  onSubmitTeamCodeDialog,
  onToggleTeamCodeFolder,
  onUpdateTeamCodeDialogOpModeBase,
  onUpdateTeamCodeDialogTemplate,
  onUpdateTeamCodeDialogValue,
  onUpdateTeamCodeImportConflictRenamePath,
}: OnBotJavaPageProps) {
  const [draggedTeamCodeItem, setDraggedTeamCodeItem] = useState<TeamCodeDragItem | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredTeamCodeDropFolder, setHoveredTeamCodeDropFolder] = useState<string | null>(null);
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [isGithubUploadFormOpen, setIsGithubUploadFormOpen] = useState(false);
  const [githubUploadUrl, setGithubUploadUrl] = useState("");
  const uploadZipInputRef = useRef<HTMLInputElement | null>(null);
  const activePointerDragRef = useRef<{
    item: TeamCodeDragItem;
    startX: number;
    startY: number;
  } | null>(null);
  const didPointerDragRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const teamCodeSourceTextByFileRef = useRef(teamCodeSourceTextByFile);
  teamCodeSourceTextByFileRef.current = teamCodeSourceTextByFile;

  const handleEditorMount: OnMount = (_editor, monaco) => {
    registerFtcJavaCompletions(monaco, {
      getWorkspaceSources: () => teamCodeSourceTextByFileRef.current,
    });
  };

  const dragItemLabel = (item: TeamCodeDragItem) => {
    if (item.kind === "folder") return item.path.split("/").pop() ?? item.path;
    return item.path.split("/").pop() ?? item.path;
  };

  const basenameForTeamCodePath = (path: string) => path.split("/").pop() ?? path;

  const parentFolderForTeamCodePath = (path: string) => {
    const separatorIndex = path.lastIndexOf("/");
    return separatorIndex === -1 ? "" : path.slice(0, separatorIndex);
  };

  const canMoveTeamCodeItemToFolder = (item: TeamCodeDragItem, targetFolder: string) => {
    if (parentFolderForTeamCodePath(item.path) === targetFolder) return false;
    if (item.kind === "folder" && (targetFolder === item.path || targetFolder.startsWith(`${item.path}/`))) {
      return false;
    }

    return true;
  };

  const childFoldersByParent = teamCodeFolders.reduce<Record<string, string[]>>((groups, folder) => {
    const parentFolder = parentFolderForTeamCodePath(folder);
    groups[parentFolder] = [...(groups[parentFolder] ?? []), folder];
    return groups;
  }, {});

  for (const folders of Object.values(childFoldersByParent)) {
    folders.sort((a, b) => basenameForTeamCodePath(a).localeCompare(basenameForTeamCodePath(b)));
  }

  const folderFromPoint = (clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY);

    if (!(target instanceof HTMLElement)) {
      return null;
    }

    const fileBrowser = target.closest(".file-browser");
    if (!fileBrowser) {
      return null;
    }

    const folderElement = target.closest<HTMLElement>("[data-teamcode-folder]");
    return folderElement?.dataset.teamcodeFolder ?? "";
  };

  const startTeamCodePointerDrag =
    (item: TeamCodeDragItem) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;

      activePointerDragRef.current = {
        item,
        startX: event.clientX,
        startY: event.clientY,
      };
      didPointerDragRef.current = false;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const activeDrag = activePointerDragRef.current;
        if (!activeDrag) return;

        const distanceX = moveEvent.clientX - activeDrag.startX;
        const distanceY = moveEvent.clientY - activeDrag.startY;
        const movedFarEnough = Math.hypot(distanceX, distanceY) > 6;

        if (!movedFarEnough) return;

        didPointerDragRef.current = true;
        setDraggedTeamCodeItem(activeDrag.item);
        setDragPreviewPosition({ x: moveEvent.clientX, y: moveEvent.clientY });

        const targetFolder = folderFromPoint(moveEvent.clientX, moveEvent.clientY);
        setHoveredTeamCodeDropFolder(
          targetFolder !== null && canMoveTeamCodeItemToFolder(activeDrag.item, targetFolder) ? targetFolder : null,
        );
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);

        const activeDrag = activePointerDragRef.current;
        activePointerDragRef.current = null;
        setDraggedTeamCodeItem(null);
        setDragPreviewPosition(null);
        setHoveredTeamCodeDropFolder(null);

        if (!activeDrag || !didPointerDragRef.current) {
          return;
        }

        suppressNextClickRef.current = true;
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 0);

        const targetFolder = folderFromPoint(upEvent.clientX, upEvent.clientY);

        if (targetFolder === null || !canMoveTeamCodeItemToFolder(activeDrag.item, targetFolder)) {
          return;
        }

        onMoveTeamCodeItem(activeDrag.item, targetFolder);
      };

      const handlePointerCancel = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
        activePointerDragRef.current = null;
        didPointerDragRef.current = false;
        setDraggedTeamCodeItem(null);
        setDragPreviewPosition(null);
        setHoveredTeamCodeDropFolder(null);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
    };

  const shouldSuppressClick = () => {
    if (!suppressNextClickRef.current) return false;
    suppressNextClickRef.current = false;
    return true;
  };

  const fileDialogStem =
    teamCodeDialog?.kind === "createFile" || teamCodeDialog?.kind === "renameFile"
      ? teamCodeDialog.value.replace(/\.java$/i, "")
      : "";

  const renderTeamCodeFolder = (folder: string, depth: number) => (
    <div className="file-group" key={folder} data-teamcode-folder={folder}>
      <button
        className="file-group-title"
        onPointerDown={startTeamCodePointerDrag({ kind: "folder", path: folder })}
        onClick={() => {
          if (shouldSuppressClick()) return;
          onToggleTeamCodeFolder(folder);
        }}
        onContextMenu={(event) => onOpenTeamCodeContextMenu(event, { kind: "folder", path: folder })}
        data-drop-target={hoveredTeamCodeDropFolder === folder ? "true" : undefined}
        data-selected={teamCodeSelection.kind === "folder" && teamCodeSelection.path === folder}
        style={{ "--teamcode-indent": `${depth * 16}px` } as CSSProperties}
        type="button"
      >
        <span>{expandedTeamCodeFolders[folder] ?? true ? "v" : ">"}</span>
        <span>{basenameForTeamCodePath(folder)}</span>
      </button>

      {(expandedTeamCodeFolders[folder] ?? true) && (
        <>
          {(childFoldersByParent[folder] ?? []).map((childFolder) => renderTeamCodeFolder(childFolder, depth + 1))}

          {(teamCodeFilesByFolder[folder] ?? []).map((fileName) => (
            <button
              className={`file-item nested ${
                teamCodeSelection.kind === "file" && teamCodeSelection.path === fileName ? "selected" : ""
              }`}
              disabled={isLoadingCodeFile}
              key={fileName}
              onPointerDown={startTeamCodePointerDrag({ kind: "file", path: fileName })}
              onClick={() => {
                if (shouldSuppressClick()) return;
                onOpenCodeFile(fileName);
              }}
              onContextMenu={(event) => onOpenTeamCodeContextMenu(event, { kind: "file", path: fileName })}
              style={{ "--teamcode-indent": `${depth * 16}px` } as CSSProperties}
              type="button"
            >
              {basenameForTeamCodePath(fileName)}
            </button>
          ))}
        </>
      )}
    </div>
  );

  return (
    <section className={`tab app-panel onbot-panel ${activeTab === "onbotJava" ? "active" : ""}`}>
      <div className="ide-shell">
        <aside
          className="file-browser"
          data-dragging={draggedTeamCodeItem ? "true" : undefined}
          data-drop-target={hoveredTeamCodeDropFolder === "" ? "root" : undefined}
        >
          <div className="file-browser-title">
            <div>
              <span>TeamCode</span>
              <span className="file-browser-target">Target: {selectedTargetLabel}</span>
            </div>
            <div className="file-browser-actions" aria-label="TeamCode file commands">
              <button onClick={onCreateCodeFile} title="New File" type="button">
                +
              </button>
              <button onClick={onCreateCodeFolder} title="New Folder" type="button">
                +/
              </button>
            </div>
          </div>

          {rootTeamCodeFiles.map((fileName) => (
            <button
              className={`file-item ${
                teamCodeSelection.kind === "file" && teamCodeSelection.path === fileName ? "selected" : ""
              }`}
              disabled={isLoadingCodeFile}
              key={fileName}
              onPointerDown={startTeamCodePointerDrag({ kind: "file", path: fileName })}
              onClick={() => {
                if (shouldSuppressClick()) return;
                onOpenCodeFile(fileName);
              }}
              onContextMenu={(event) => onOpenTeamCodeContextMenu(event, { kind: "file", path: fileName })}
              type="button"
            >
              {fileName}
            </button>
          ))}

          {(childFoldersByParent[""] ?? []).map((folder) => renderTeamCodeFolder(folder, 0))}
        </aside>

        <div className="editor-pane">
          <div className="editor-tabs" aria-label="Open Java files">
            {openCodeFileTabs.length === 0 ? (
              <div className="editor-empty-tab">No file selected</div>
            ) : (
              openCodeFileTabs.map((fileName) => (
                <div className="editor-file-tab" data-active={codeFileName === fileName} key={fileName}>
                  <button
                    className="editor-file-tab-main"
                    disabled={isLoadingCodeFile && codeFileName !== fileName}
                    onClick={() => onOpenCodeFile(fileName)}
                    title={fileName}
                    type="button"
                  >
                    {basenameForTeamCodePath(fileName)}
                  </button>
                  <button
                    className="editor-file-tab-close"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseCodeFileTab(fileName);
                    }}
                    title={`Close ${fileName}`}
                    type="button"
                  >
                    x
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="monaco-shell">
            <Editor
              height="100%"
              language="java"
              onChange={(value) => onSetCodeText(value ?? "")}
              onMount={handleEditorMount}
              options={{
                automaticLayout: true,
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                tabSize: 4,
              }}
              path={codeFileName || "blank.java"}
              theme="vs-dark"
              value={codeText}
            />
          </div>

          <div
            className="terminal-resize-handle"
            onPointerDown={onStartTerminalResize}
            role="separator"
            tabIndex={0}
          />

          <section className="runner-output" style={{ height: terminalHeight }}>
            <div className="runner-output-title">
              <span>Terminal</span>
              <span className="runner-output-status">
                {codeStatus}
                {exportedTeamCodeZipPath && (
                  <button onClick={onOpenTeamCodeExport} type="button">
                    Open Downloads
                  </button>
                )}
              </span>
            </div>
            <pre>{runnerLog || "TeamCode compile errors will appear here."}</pre>
          </section>
        </div>

        <div className="ide-action-dock" style={{ bottom: terminalHeight + 18 }}>
          <div className="ide-action-secondary">
            <button
              disabled={!codeFileName || isLoadingCodeFile}
              onClick={onSaveCodeFileOnly}
              title="Save Without Compiling"
              type="button"
            >
              <span className="save-icon" aria-hidden="true" />
            </button>
            <button onClick={onLoadRunnerLog} title="Refresh Runner Output" type="button">
              !
            </button>
            <button onClick={onLoadTeamCodeFiles} title="Refresh Files" type="button">
              R
            </button>
            <button onClick={onExportTeamCode} title="Export TeamCode Zip" type="button">
              ZIP
            </button>
            <button
              onClick={() => {
                setIsGithubUploadFormOpen(false);
                setIsUploadMenuOpen(true);
              }}
              title="Upload TeamCode"
              type="button"
            >
              UP
            </button>
          </div>

          <button
            className="ide-compile-button"
            disabled={!codeFileName || isLoadingCodeFile}
            onClick={onSaveCodeFile}
            title="Save, Compile, and Restart"
            type="button"
          >
            <img className="compile-icon" src="/assets/editor/wrench.png" alt="" aria-hidden="true" />
          </button>
        </div>

        {teamCodeContextMenu && (
          <div
            className="teamcode-context-menu"
            onClick={(event) => event.stopPropagation()}
            style={{ left: teamCodeContextMenu.x, top: teamCodeContextMenu.y }}
          >
            {teamCodeContextMenu.kind === "folder" && (
              <>
                <button onClick={onCreateCodeFileFromContextFolder} type="button">
                  New File
                </button>
                <button onClick={onCreateCodeFolderFromContextFolder} type="button">
                  New Folder
                </button>
              </>
            )}
            <button onClick={onRenameTeamCodeItem} type="button">
              Rename
            </button>
            <button onClick={onDeleteTeamCodeItem} type="button">
              Delete
            </button>
          </div>
        )}

        {teamCodeDialog && (
          <div className="teamcode-dialog-backdrop" onMouseDown={onDismissDialog}>
            <form
              className="teamcode-dialog"
              onMouseDown={(event) => event.stopPropagation()}
              onSubmit={onSubmitTeamCodeDialog}
            >
              <h2>{teamCodeDialogTitle}</h2>

              {teamCodeDialog.kind === "deleteFile" || teamCodeDialog.kind === "deleteFolder" ? (
                <p>
                  {teamCodeDialog.kind === "deleteFolder"
                    ? `Delete folder ${teamCodeDialog.path} and everything inside it?`
                    : `Delete ${teamCodeDialog.path}?`}
                </p>
              ) : (
                <>
                  {teamCodeDialog.kind === "createFile" || teamCodeDialog.kind === "renameFile" ? (
                    <div className="teamcode-path-input teamcode-file-name-input">
                      {teamCodeDialog.kind === "createFile" && teamCodeDialog.parentFolder && (
                        <span>{teamCodeDialog.parentFolder}/</span>
                      )}
                      {teamCodeDialog.kind === "renameFile" && teamCodeDialog.path.includes("/") && (
                        <span>{teamCodeDialog.path.slice(0, teamCodeDialog.path.lastIndexOf("/") + 1)}</span>
                      )}
                      <input
                        autoFocus
                        onChange={(event) => onUpdateTeamCodeDialogValue(event.target.value.replace(/\.java$/i, ""))}
                        value={fileDialogStem}
                      />
                      <span className="teamcode-fixed-extension">.java</span>
                    </div>
                  ) : teamCodeDialog.kind === "createFolder" && teamCodeDialog.parentFolder ? (
                    <div className="teamcode-path-input">
                      <span>{teamCodeDialog.parentFolder}/</span>
                      <input
                        autoFocus
                        onChange={(event) => onUpdateTeamCodeDialogValue(event.target.value)}
                        value={teamCodeDialog.value}
                      />
                    </div>
                  ) : (
                    <input
                      autoFocus
                      onChange={(event) => onUpdateTeamCodeDialogValue(event.target.value)}
                      value={teamCodeDialog.value}
                    />
                  )}

                  {teamCodeDialog.kind === "createFile" && (
                    <>
                      <div className="teamcode-template-options">
                        <label htmlFor="teamcode-file-template">Template</label>
                        <select
                          id="teamcode-file-template"
                          onChange={(event) => onUpdateTeamCodeDialogTemplate(event.target.value as TeamCodeFileTemplate)}
                          value={teamCodeDialog.template}
                        >
                          {teamCodeFileTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {(teamCodeDialog.template === "autonomous" || teamCodeDialog.template === "teleop") && (
                        <div className="teamcode-template-options">
                          <label htmlFor="teamcode-opmode-base">Base</label>
                          <select
                            id="teamcode-opmode-base"
                            onChange={(event) => onUpdateTeamCodeDialogOpModeBase(event.target.value as TeamCodeOpModeBase)}
                            value={teamCodeDialog.opModeBase}
                          >
                            <option value="linear">LinearOpMode</option>
                            <option value="iterative">OpMode</option>
                          </select>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <div className="teamcode-dialog-actions">
                <button onClick={onDismissDialog} type="button">
                  Cancel
                </button>
                <button type="submit">{teamCodeDialogSubmitLabel}</button>
              </div>
            </form>
          </div>
        )}

        {isUploadMenuOpen && (
          <div
            className="teamcode-dialog-backdrop"
            onMouseDown={() => {
              setIsUploadMenuOpen(false);
              setIsGithubUploadFormOpen(false);
            }}
          >
            <div className="teamcode-dialog" onMouseDown={(event) => event.stopPropagation()}>
              <h2>Upload TeamCode</h2>
              {isGithubUploadFormOpen ? (
                <>
                  <div className="teamcode-template-options teamcode-github-upload-field">
                    <label htmlFor="teamcode-github-upload-url">GitHub repo link</label>
                    <input
                      autoFocus
                      id="teamcode-github-upload-url"
                      onChange={(event) => setGithubUploadUrl(event.target.value)}
                      placeholder="https://github.com/FIRST-Tech-Challenge/FtcRobotController"
                      value={githubUploadUrl}
                    />
                  </div>
                  <div className="teamcode-dialog-actions">
                    <button onClick={() => setIsGithubUploadFormOpen(false)} type="button">
                      Back
                    </button>
                    <button
                      onClick={() => {
                        setIsUploadMenuOpen(false);
                        setIsGithubUploadFormOpen(false);
                        onImportTeamCodeGithubRepoLink(githubUploadUrl);
                      }}
                      type="button"
                    >
                      Upload
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="teamcode-upload-options">
                    <button
                      onClick={() => {
                        uploadZipInputRef.current?.click();
                      }}
                      type="button"
                    >
                      Zip File
                    </button>
                    <button onClick={() => setIsGithubUploadFormOpen(true)} type="button">
                      GitHub Repo Link
                    </button>
                  </div>
                  <div className="teamcode-dialog-actions">
                    <button onClick={() => setIsUploadMenuOpen(false)} type="button">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {teamCodeImportConflictPrompt && (
          <div className="teamcode-dialog-backdrop">
            <div className="teamcode-dialog" onMouseDown={(event) => event.stopPropagation()}>
              <h2>Import Conflict</h2>
              <p>
                {teamCodeImportConflictPrompt.path} already exists ({teamCodeImportConflictPrompt.index + 1} of{" "}
                {teamCodeImportConflictPrompt.total}).
              </p>
              <div className="teamcode-template-options">
                <label htmlFor="teamcode-import-rename-path">Rename to</label>
                <input
                  id="teamcode-import-rename-path"
                  onChange={(event) => onUpdateTeamCodeImportConflictRenamePath(event.target.value)}
                  value={teamCodeImportConflictPrompt.renamePath}
                />
              </div>
              <div className="teamcode-dialog-actions teamcode-import-conflict-actions">
                <button onClick={() => onResolveTeamCodeImportConflict("skip")} type="button">
                  Do Not Add
                </button>
                <button onClick={() => onResolveTeamCodeImportConflict("rename")} type="button">
                  Rename
                </button>
                <button onClick={() => onResolveTeamCodeImportConflict("replace")} type="button">
                  Replace
                </button>
                <button onClick={() => onResolveTeamCodeImportConflict("replaceAll")} type="button">
                  Replace All
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingCloseCodeFileTab && (
          <div className="teamcode-dialog-backdrop" onMouseDown={onCancelCloseCodeFileTab}>
            <div className="teamcode-dialog" onMouseDown={(event) => event.stopPropagation()}>
              <h2>Save Changes?</h2>
              <p>Save changes to {pendingCloseCodeFileTab} before closing?</p>
              <div className="teamcode-dialog-actions">
                <button onClick={onCancelCloseCodeFileTab} type="button">
                  Cancel
                </button>
                <button onClick={onConfirmSaveAndCloseCodeFileTab} type="button">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {draggedTeamCodeItem && dragPreviewPosition && (
        <div
          className="teamcode-drag-preview"
          style={{
            position: "fixed",
            left: dragPreviewPosition.x + 12,
            top: dragPreviewPosition.y + 12,
            zIndex: 10000,
            pointerEvents: "none",
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(22, 27, 34, 0.96)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            color: "white",
            fontSize: 13,
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.35)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span className="teamcode-drag-preview-icon">{draggedTeamCodeItem.kind === "folder" ? "📁" : "📄"}</span>
          <span>{dragItemLabel(draggedTeamCodeItem)}</span>
        </div>
      )}

      <input
        accept=".zip,application/zip,application/x-zip-compressed"
        ref={uploadZipInputRef}
        style={{ display: "none" }}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          setIsUploadMenuOpen(false);
          setIsGithubUploadFormOpen(false);
          if (file) {
            onImportTeamCodeZipFile(file);
          }
        }}
      />
    </section>
  );
}
