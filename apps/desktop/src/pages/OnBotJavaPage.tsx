import type {
  FormEvent as ReactFormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import Editor from "@monaco-editor/react";
import { teamCodeFileTemplates } from "../config";
import type {
  TabId,
  TeamCodeContextMenu,
  TeamCodeDialog,
  TeamCodeFileTemplate,
  TeamCodeFolder,
  TeamCodeSelection,
} from "../types";

type OnBotJavaPageProps = {
  activeTab: TabId;
  codeFileName: string;
  codeStatus: string;
  codeText: string;
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
  teamCodeSelection: TeamCodeSelection;
  terminalHeight: number;
  onCreateCodeFile: () => void;
  onCreateCodeFileFromContextFolder: () => void;
  onCreateCodeFolder: () => void;
  onCreateCodeFolderFromContextFolder: () => void;
  onDeleteTeamCodeItem: () => void;
  onDismissDialog: () => void;
  onLoadRunnerLog: () => void;
  onLoadTeamCodeFiles: () => void;
  onOpenCodeFile: (fileName: string) => void;
  onOpenTeamCodeContextMenu: (
    event: ReactMouseEvent<HTMLButtonElement>,
    menu: Omit<TeamCodeContextMenu, "x" | "y">,
  ) => void;
  onRenameTeamCodeItem: () => void;
  onSaveCodeFile: () => void;
  onSetCodeText: (value: string) => void;
  onStartTerminalResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSubmitTeamCodeDialog: (event: ReactFormEvent<HTMLFormElement>) => void;
  onToggleTeamCodeFolder: (folder: TeamCodeFolder) => void;
  onUpdateTeamCodeDialogTemplate: (template: TeamCodeFileTemplate) => void;
  onUpdateTeamCodeDialogValue: (value: string) => void;
};

export function OnBotJavaPage({
  activeTab,
  codeFileName,
  codeStatus,
  codeText,
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
  teamCodeSelection,
  terminalHeight,
  onCreateCodeFile,
  onCreateCodeFileFromContextFolder,
  onCreateCodeFolder,
  onCreateCodeFolderFromContextFolder,
  onDeleteTeamCodeItem,
  onDismissDialog,
  onLoadRunnerLog,
  onLoadTeamCodeFiles,
  onOpenCodeFile,
  onOpenTeamCodeContextMenu,
  onRenameTeamCodeItem,
  onSaveCodeFile,
  onSetCodeText,
  onStartTerminalResize,
  onSubmitTeamCodeDialog,
  onToggleTeamCodeFolder,
  onUpdateTeamCodeDialogTemplate,
  onUpdateTeamCodeDialogValue,
}: OnBotJavaPageProps) {
  return (
    <section className={`tab app-panel onbot-panel ${activeTab === "onbotJava" ? "active" : ""}`}>
      <div className="ide-shell">
        <aside className="file-browser">
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
              onClick={() => onOpenCodeFile(fileName)}
              onContextMenu={(event) => onOpenTeamCodeContextMenu(event, { kind: "file", path: fileName })}
              type="button"
            >
              {fileName}
            </button>
          ))}

          {teamCodeFolders.map((folder) => (
            <div className="file-group" key={folder}>
              <button
                className="file-group-title"
                onClick={() => onToggleTeamCodeFolder(folder)}
                onContextMenu={(event) => onOpenTeamCodeContextMenu(event, { kind: "folder", path: folder })}
                data-selected={teamCodeSelection.kind === "folder" && teamCodeSelection.path === folder}
                type="button"
              >
                <span>{expandedTeamCodeFolders[folder] ?? true ? "v" : ">"}</span>
                <span>{folder}</span>
              </button>

              {(expandedTeamCodeFolders[folder] ?? true) &&
                teamCodeFilesByFolder[folder].map((fileName) => (
                  <button
                    className={`file-item nested ${
                      teamCodeSelection.kind === "file" && teamCodeSelection.path === fileName ? "selected" : ""
                    }`}
                    disabled={isLoadingCodeFile}
                    key={fileName}
                    onClick={() => onOpenCodeFile(fileName)}
                    onContextMenu={(event) => onOpenTeamCodeContextMenu(event, { kind: "file", path: fileName })}
                    type="button"
                  >
                    {fileName.slice(folder.length + 1)}
                  </button>
                ))}
            </div>
          ))}
        </aside>

        <div className="editor-pane">
          <div className="editor-titlebar">
            <span>{codeFileName || "No file selected"}</span>
          </div>

          <div className="monaco-shell">
            <Editor
              height="100%"
              language="java"
              onChange={(value) => onSetCodeText(value ?? "")}
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
              <span>{codeStatus}</span>
            </div>
            <pre>{runnerLog || "Runner output will appear here."}</pre>
          </section>
        </div>

        <div className="ide-action-dock" style={{ bottom: terminalHeight + 18 }}>
          <div className="ide-action-secondary">
            <button onClick={onLoadRunnerLog} title="Refresh Runner Output" type="button">
              !
            </button>
            <button onClick={onLoadTeamCodeFiles} title="Refresh Files" type="button">
              R
            </button>
          </div>

          <button
            className="ide-save-button"
            disabled={!codeFileName || isLoadingCodeFile}
            onClick={onSaveCodeFile}
            title="Save"
            type="button"
          >
            <span className="save-icon" aria-hidden="true" />
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
                  {(teamCodeDialog.kind === "createFile" || teamCodeDialog.kind === "createFolder") &&
                  teamCodeDialog.parentFolder ? (
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
      </div>
    </section>
  );
}
