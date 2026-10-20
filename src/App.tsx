/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  File,
  Check,
  Copy,
  Search,
  Download,
  ChevronRight,
  ChevronDown,
  Layers,
  Terminal,
  BookOpen,
  FileJson,
  Database,
  Lock,
  Archive,
  ArrowRight
} from 'lucide-react';
import { EXTRACTED_FILES, ArchiveFile } from './extractedData.ts';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  return (kb / 1024).toFixed(1) + ' MB';
}

function getFileIcon(name: string) {
  if (name.endsWith('.py')) return <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (name.endsWith('.html')) return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;
  if (name.endsWith('.css')) return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
  if (name.endsWith('.js')) return <FileCode className="w-4 h-4 text-yellow-400 shrink-0" />;
  if (name.endsWith('.sql')) return <Database className="w-4 h-4 text-purple-400 shrink-0" />;
  if (name.endsWith('.md')) return <BookOpen className="w-4 h-4 text-blue-400 shrink-0" />;
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return <FileJson className="w-4 h-4 text-rose-400 shrink-0" />;
  if (name.startsWith('.env')) return <Lock className="w-4 h-4 text-red-400 shrink-0" />;
  return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
}

function getFileLanguage(name: string): string {
  if (name.endsWith('.py')) return 'Python';
  if (name.endsWith('.html')) return 'HTML / Jinja2';
  if (name.endsWith('.css')) return 'CSS';
  if (name.endsWith('.js')) return 'JavaScript';
  if (name.endsWith('.sql')) return 'SQL';
  if (name.endsWith('.md')) return 'Markdown';
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'YAML';
  if (name.startsWith('.env') || name === '.gitignore') return 'Config';
  return 'Text';
}

interface TreeNode {
  name: string;
  fullPath: string;
  isDirectory: boolean;
  children?: TreeNode[];
  file?: ArchiveFile;
}

export default function App() {
  const [selectedPath, setSelectedPath] = useState<string>('expense_work/README.md');
  const [searchQuery, setSearchQuery] = useState('');
  const [codeSearch, setCodeSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'expense_work': true,
    'expense_work/templates': true,
    'expense_work/static': true,
    'expense_work/database': true,
    'expense_work/docs': true,
    'expense_work/tests': true,
  });
  const [viewMode, setViewMode] = useState<'code' | 'markdown'>('markdown');

  // Build directory tree
  const fileTree = useMemo(() => {
    const root: TreeNode = {
      name: 'expense_work',
      fullPath: 'expense_work',
      isDirectory: true,
      children: [],
    };

    EXTRACTED_FILES.forEach((file) => {
      const parts = file.path.split('/');
      let current = root;

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (isLast) {
          current.children = current.children || [];
          current.children.push({
            name: part,
            fullPath: file.path,
            isDirectory: false,
            file: file,
          });
        } else {
          current.children = current.children || [];
          let dirNode = current.children.find((c) => c.name === part && c.isDirectory);
          if (!dirNode) {
            dirNode = {
              name: part,
              fullPath: currentPath,
              isDirectory: true,
              children: [],
            };
            current.children.push(dirNode);
          }
          current = dirNode;
        }
      }
    });

    // Sort folders first, then files
    const sortNodes = (node: TreeNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.isDirectory === b.isDirectory) {
            return a.name.localeCompare(b.name);
          }
          return a.isDirectory ? -1 : 1;
        });
        node.children.forEach(sortNodes);
      }
    };
    sortNodes(root);

    return root;
  }, []);

  const selectedFile = useMemo(() => {
    return EXTRACTED_FILES.find((f) => f.path === selectedPath) || EXTRACTED_FILES[0];
  }, [selectedPath]);

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return EXTRACTED_FILES.filter(
      (f) => f.path.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleCopy = () => {
    if (selectedFile) {
      navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (selectedFile) {
      const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSelectFile = (path: string) => {
    setSelectedPath(path);
    if (path.endsWith('.md')) {
      setViewMode('markdown');
    } else {
      setViewMode('code');
    }
    setCodeSearch('');
  };

  const totalLines = useMemo(() => {
    return EXTRACTED_FILES.reduce((sum, f) => sum + f.lines, 0);
  }, []);

  const totalSize = useMemo(() => {
    return EXTRACTED_FILES.reduce((sum, f) => sum + f.size, 0);
  }, []);

  // Simple Markdown renderer
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-4 text-slate-300 leading-relaxed max-w-4xl font-sans">
        {lines.map((line, idx) => {
          if (line.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-2xl font-bold text-white border-b border-slate-700/60 pb-2 mt-4">
                {line.replace('# ', '')}
              </h1>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-xl font-semibold text-emerald-400 mt-6 pb-1">
                {line.replace('## ', '')}
              </h2>
            );
          }
          if (line.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-lg font-medium text-slate-200 mt-4">
                {line.replace('### ', '')}
              </h3>
            );
          }
          if (line.startsWith('- ')) {
            return (
              <div key={idx} className="flex items-start gap-2 ml-3">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{line.replace('- ', '')}</span>
              </div>
            );
          }
          if (/^\d+\.\s/.test(line)) {
            return (
              <div key={idx} className="flex items-start gap-2 ml-3">
                <span className="text-emerald-400 font-mono text-sm">{line.split('.')[0]}.</span>
                <span>{line.replace(/^\d+\.\s/, '')}</span>
              </div>
            );
          }
          if (line.startsWith('```')) {
            return (
              <div key={idx} className="bg-slate-950 px-3 py-1 text-xs text-slate-400 font-mono rounded border border-slate-800">
                {line}
              </div>
            );
          }
          if (!line.trim()) {
            return <div key={idx} className="h-1" />;
          }
          return <p key={idx} className="text-slate-300 text-sm">{line}</p>;
        })}
      </div>
    );
  };

  // Render tree item recursively
  const renderTreeItem = (node: TreeNode, depth = 0) => {
    if (node.isDirectory) {
      const isOpen = !!openFolders[node.fullPath];
      return (
        <div key={node.fullPath}>
          <button
            onClick={() => toggleFolder(node.fullPath)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 rounded transition-colors text-left"
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
          >
            {isOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            {isOpen ? (
              <FolderOpen className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <span className="truncate font-medium">{node.name}</span>
          </button>
          {isOpen && node.children && (
            <div>{node.children.map((child) => renderTreeItem(child, depth + 1))}</div>
          )}
        </div>
      );
    }

    const isSelected = selectedPath === node.fullPath;
    return (
      <button
        key={node.fullPath}
        onClick={() => handleSelectFile(node.fullPath)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors text-left ${
          isSelected
            ? 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30'
            : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
        }`}
        style={{ paddingLeft: `${depth * 14 + 16}px` }}
      >
        {getFileIcon(node.name)}
        <span className="truncate flex-1">{node.name}</span>
        <span className="text-[10px] text-slate-500 tabular-nums">
          {formatBytes(node.file?.size || 0)}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">
                Pennywise — Student Expense Tracker
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                Opened &amp; Extracted (No Edits)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Source: <span className="text-slate-300 font-mono">student-expense-tracker-reviewed_2e93c1e1.zip</span> (19 files extracted to <span className="text-slate-300 font-mono">./expense_work</span>)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-4 text-xs text-slate-400 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div>
              <span className="text-slate-500 mr-1.5">Files:</span>
              <span className="font-medium text-slate-200">{EXTRACTED_FILES.length}</span>
            </div>
            <div className="w-px h-3 bg-slate-700" />
            <div>
              <span className="text-slate-500 mr-1.5">Total Size:</span>
              <span className="font-medium text-slate-200">{formatBytes(totalSize)}</span>
            </div>
            <div className="w-px h-3 bg-slate-700" />
            <div>
              <span className="text-slate-500 mr-1.5">Lines:</span>
              <span className="font-medium text-slate-200">{totalLines.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - File Explorer */}
        <aside className="w-80 border-r border-slate-800/80 bg-slate-900/40 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-md text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 select-none scrollbar-thin scrollbar-thumb-slate-800">
            {filteredFiles ? (
              <div className="space-y-0.5">
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Search Results ({filteredFiles.length})
                </div>
                {filteredFiles.map((file) => {
                  const isSelected = selectedPath === file.path;
                  return (
                    <button
                      key={file.path}
                      onClick={() => handleSelectFile(file.path)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded transition-colors text-left ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      {getFileIcon(file.name)}
                      <div className="truncate flex-1">
                        <div className="truncate font-medium">{file.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{file.path}</div>
                      </div>
                      <span className="text-[10px] text-slate-500 tabular-nums">
                        {formatBytes(file.size)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Explorer</span>
                  <span className="text-[10px] text-slate-500">expense_work</span>
                </div>
                {renderTreeItem(fileTree)}
              </div>
            )}
          </div>

          {/* Quick Launch / Summary Box */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/50 text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Project Stack</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded">Flask 3.0</span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded">SQLAlchemy</span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded">MySQL / SQLite</span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded">Jinja2 HTML</span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded">Chart.js</span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded">PyTest</span>
            </div>
          </div>
        </aside>

        {/* Right Content Area - File Viewer */}
        <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
          {/* File Tab / Control Header */}
          <div className="h-11 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {getFileIcon(selectedFile.name)}
                <span className="font-mono text-xs text-slate-200 font-semibold">
                  {selectedFile.path}
                </span>
              </div>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded font-medium">
                {getFileLanguage(selectedFile.name)}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {selectedFile.lines} lines • {formatBytes(selectedFile.size)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedFile.name.endsWith('.md') && (
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setViewMode('markdown')}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      viewMode === 'markdown'
                        ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Rendered
                  </button>
                  <button
                    onClick={() => setViewMode('code')}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      viewMode === 'code'
                        ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Raw Source
                  </button>
                </div>
              )}

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs rounded-md transition-colors border border-slate-700/60"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs rounded-md transition-colors border border-slate-700/60"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* Active File Content */}
          <div className="flex-1 overflow-auto bg-slate-950 p-4">
            {selectedFile.name.endsWith('.md') && viewMode === 'markdown' ? (
              <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-800/80">
                {renderMarkdown(selectedFile.content)}
              </div>
            ) : (
              <div className="font-mono text-xs leading-relaxed flex select-text">
                {/* Line numbers */}
                <div className="pr-4 mr-4 text-right text-slate-600 select-none border-r border-slate-800 shrink-0 font-mono">
                  {selectedFile.content.split('\n').map((_, index) => (
                    <div key={index} className="h-5">
                      {index + 1}
                    </div>
                  ))}
                </div>

                {/* Code content */}
                <div className="flex-1 overflow-x-auto text-slate-200">
                  {selectedFile.content.split('\n').map((line, index) => (
                    <div key={index} className="h-5 whitespace-pre">
                      {line.length === 0 ? ' ' : line}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Path & Status Bar */}
          <footer className="h-7 border-t border-slate-800/80 bg-slate-900/80 px-4 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">●</span>
              <span>Ready</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-300">{selectedFile.path}</span>
            </div>
            <div className="flex items-center gap-3">
              <span>UTF-8</span>
              <span className="text-slate-600">•</span>
              <span>{getFileLanguage(selectedFile.name)}</span>
              <span className="text-slate-600">•</span>
              <span>Unmodified Original</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
