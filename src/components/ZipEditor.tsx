import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  File,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Search,
  Upload,
  Download,
  Copy,
  Check,
  Code2,
  Layers,
  FileCheck,
} from 'lucide-react';
import { ZipFileItem, FileTreeNode, FolderNode, FileNode } from '../types/zip';
import { buildFileTree } from '../utils/zipManager';

interface ZipEditorProps {
  files: Record<string, ZipFileItem>;
  onUpdateFileContent: (path: string, newContent: string) => void;
  onSaveFile: (path: string) => void;
  onAddFile: (path: string, initialContent?: string) => void;
  onDeleteFile: (path: string) => void;
  onUploadZip: (file: File) => void;
  onDownloadZip: () => void;
  onResetZip: () => void;
}

export const ZipEditor: React.FC<ZipEditorProps> = ({
  files,
  onUpdateFileContent,
  onSaveFile,
  onAddFile,
  onDeleteFile,
  onUploadZip,
  onDownloadZip,
  onResetZip,
}) => {
  const [activeFilePath, setActiveFilePath] = useState<string>('JARVIS-main/app.py');
  const [openTabs, setOpenTabs] = useState<string[]>([
    'JARVIS-main/app.py',
    'JARVIS-main/providers.py',
    'JARVIS-main/actions.py',
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'JARVIS-main': true,
    'JARVIS-main/integrations': true,
    'JARVIS-main/tests': true,
  });
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('JARVIS-main/');
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);

  // File tree
  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const activeFile = files[activeFilePath];

  const handleSelectFile = (path: string) => {
    setActiveFilePath(path);
    if (!openTabs.includes(path)) {
      setOpenTabs([...openTabs, path]);
    }
  };

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextTabs = openTabs.filter((t) => t !== path);
    setOpenTabs(nextTabs);
    if (activeFilePath === path && nextTabs.length > 0) {
      setActiveFilePath(nextTabs[nextTabs.length - 1]);
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const handleCopyCode = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath.trim() || files[newFilePath.trim()]) return;
    onAddFile(newFilePath.trim(), '# New file\n');
    setActiveFilePath(newFilePath.trim());
    if (!openTabs.includes(newFilePath.trim())) {
      setOpenTabs([...openTabs, newFilePath.trim()]);
    }
    setIsAddingFile(false);
    setNewFilePath('JARVIS-main/');
  };

  const getFileIcon = (name: string) => {
    if (name.endsWith('.py')) return <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    if (name.endsWith('.md')) return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (name.endsWith('.yaml') || name.endsWith('.yml')) return <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (name.endsWith('.example') || name.endsWith('.json')) return <Code2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />;
    return <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  // Render tree node
  const renderTreeNode = (node: FileTreeNode) => {
    if (node.isFolder) {
      const isExpanded = expandedFolders[node.path] ?? false;
      return (
        <div key={node.path} className="select-none">
          <div
            onClick={() => toggleFolder(node.path)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800/40 rounded cursor-pointer group"
          >
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>
          {isExpanded && (
            <div className="pl-3.5 border-l border-cyan-900/20 ml-2 mt-0.5 space-y-0.5">
              {node.children.map((child) => renderTreeNode(child))}
            </div>
          )}
        </div>
      );
    }

    // Filter by search
    if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return null;
    }

    const isSelected = activeFilePath === node.path;
    const fileItem = files[node.path];

    return (
      <div
        key={node.path}
        onClick={() => handleSelectFile(node.path)}
        className={`flex items-center justify-between gap-2 px-2 py-1 text-xs font-mono rounded cursor-pointer transition-colors ${
          isSelected
            ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 font-medium'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {getFileIcon(node.name)}
          <span className="truncate">{node.name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {fileItem?.isModified && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Modified" />
          )}
        </div>
      </div>
    );
  };

  const lineCount = activeFile?.content ? activeFile.content.split('\n').length : 0;

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col bg-[#050b14] text-slate-200">
      {/* Action / Toolbar Sub-Header */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-[#08101e] border-b border-cyan-900/30 text-xs font-mono">
        <div className="flex items-center gap-4 text-slate-400">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-200 font-semibold">ZIP ARCHIVE EXPLORER</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400 tabular-nums">{Object.keys(files).length} files</span>
          </div>
          <span className="text-slate-600">|</span>
          <label className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Any .ZIP</span>
            <input
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadZip(f);
              }}
            />
          </label>
          <button
            onClick={onResetZip}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-pointer"
            title="Reset to fresh upgraded JARVIS backend"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Archive</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingFile(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-cyan-300 bg-slate-900 border border-slate-700/60 hover:border-cyan-500/40 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New File</span>
          </button>
          <button
            onClick={onDownloadZip}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .ZIP</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: File Tree */}
        <aside className="w-72 bg-[#060d1a] border-r border-cyan-900/30 flex flex-col shrink-0">
          <div className="p-3 border-b border-cyan-900/20">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#030712] border border-cyan-950/80 focus:border-cyan-500/50 rounded pl-8 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {fileTree.map((node) => renderTreeNode(node))}
          </div>

          <div className="p-3 border-t border-cyan-900/20 text-[11px] font-mono text-slate-500 flex justify-between items-center">
            <span>JARVIS Backend v2.0</span>
            <span className="text-cyan-400/80">Production Edition</span>
          </div>
        </aside>

        {/* Center / Right: Tabbed Code Editor */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#030712]">
          {/* File Tabs */}
          <div className="flex items-center justify-between border-b border-cyan-900/30 bg-[#050b16] px-2 overflow-x-auto">
            <div className="flex items-center gap-1">
              {openTabs.map((path) => {
                const isActive = activeFilePath === path;
                const fileItem = files[path];
                const name = path.split('/').pop() || path;
                return (
                  <div
                    key={path}
                    onClick={() => setActiveFilePath(path)}
                    className={`group flex items-center gap-2 px-3 py-2 text-xs font-mono border-b-2 cursor-pointer transition-colors ${
                      isActive
                        ? 'border-cyan-400 bg-[#030712] text-cyan-300 font-medium'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                  >
                    {getFileIcon(name)}
                    <span className="truncate max-w-[140px]">{name}</span>
                    {fileItem?.isModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Modified" />
                    )}
                    <button
                      onClick={(e) => handleCloseTab(path, e)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 ml-1 text-xs"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions for active file */}
            {activeFile && (
              <div className="flex items-center gap-2 pr-2">
                <button
                  onClick={() => setWordWrap(!wordWrap)}
                  className={`px-2 py-1 text-[11px] font-mono rounded border ${
                    wordWrap
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-600/40'
                      : 'text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Toggle word wrap"
                >
                  Wrap
                </button>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-cyan-300 border border-slate-800 rounded transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                {activeFile.isModified && (
                  <button
                    onClick={() => onSaveFile(activeFilePath)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors"
                  >
                    <Save className="w-3 h-3" />
                    <span>Save to Zip</span>
                  </button>
                )}
                <button
                  onClick={() => onDeleteFile(activeFilePath)}
                  className="text-slate-600 hover:text-rose-400 p-1 transition-colors"
                  title="Delete file"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Active File Metadata Bar */}
          {activeFile && (
            <div className="flex items-center justify-between px-4 py-1.5 bg-[#040814] border-b border-cyan-950 text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400">{activeFile.path}</span>
                {activeFile.isModified && (
                  <span className="text-amber-400 font-semibold">· Unsaved Changes</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-slate-500">
                <span className="tabular-nums">{lineCount} lines</span>
                <span>·</span>
                <span className="tabular-nums">{(activeFile.size / 1024).toFixed(1)} KB</span>
                <span>·</span>
                <span>UTF-8</span>
              </div>
            </div>
          )}

          {/* Code Editor Body */}
          {activeFile ? (
            <div className="flex-1 flex overflow-hidden relative">
              {/* Line Numbers Bar */}
              <div className="w-12 bg-[#02050d] py-3 text-right pr-3 select-none border-r border-cyan-950/40 text-[11px] font-mono text-slate-600 leading-6">
                {Array.from({ length: Math.min(lineCount, 600) }).map((_, i) => (
                  <div key={i} className="tabular-nums">{i + 1}</div>
                ))}
              </div>

              {/* Code TextArea */}
              <textarea
                value={activeFile.content}
                onChange={(e) => onUpdateFileContent(activeFilePath, e.target.value)}
                wrap={wordWrap ? 'on' : 'off'}
                spellCheck={false}
                className="flex-1 p-3 bg-transparent text-slate-200 font-mono text-xs leading-6 outline-none resize-none overflow-auto selection:bg-cyan-500/30"
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-mono text-xs p-8 text-center">
              <FileCode className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-slate-400">Select a file from the explorer on the left to edit.</p>
              <p className="text-slate-600 mt-1">Or upload an external ZIP to inspect any archive.</p>
            </div>
          )}
        </div>
      </div>

      {/* New File Modal */}
      {isAddingFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a1222] border border-cyan-500/40 rounded-lg p-5 shadow-2xl font-mono">
            <h3 className="text-sm font-semibold text-cyan-300 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Create New File in Zip</span>
            </h3>
            <form onSubmit={handleCreateFileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">File Path:</label>
                <input
                  type="text"
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  placeholder="JARVIS-main/new_service.py"
                  className="w-full bg-[#030712] border border-cyan-950 focus:border-cyan-400 rounded px-3 py-2 text-xs text-slate-200 outline-none"
                  autoFocus
                />
                <p className="text-[10px] text-slate-500 mt-1">Example: JARVIS-main/tests/test_new.py</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingFile(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded"
                >
                  Create File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
