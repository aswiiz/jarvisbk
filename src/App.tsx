import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ZipEditor } from './components/ZipEditor';
import { DiffInspector } from './components/DiffInspector';
import { ApiSimulator } from './components/ApiSimulator';
import { CalendarEmailStudio } from './components/CalendarEmailStudio';
import { AndroidSpecGuide } from './components/AndroidSpecGuide';
import { DeployGuide } from './components/DeployGuide';
import { INITIAL_JARVIS_FILES } from './data/defaultJarvisProject';
import { ZipFileItem } from './types/zip';
import {
  loadZipFromUrl,
  loadZipFromArrayBuffer,
  exportZipBlob,
  downloadBlob,
} from './utils/zipManager';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('editor');
  const [files, setFiles] = useState<Record<string, ZipFileItem>>(INITIAL_JARVIS_FILES);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState(false);

  // Attempt to load the real on-disk zip file if available via static assets
  useEffect(() => {
    async function loadInitialDiskZip() {
      try {
        const loaded = await loadZipFromUrl('/assets/aistudio/JARVIS-main_777a8304.zip');
        if (loaded && Object.keys(loaded).length > 0) {
          // Merge with any initial meta
          setFiles((prev) => ({
            ...prev,
            ...loaded,
          }));
        }
      } catch (err) {
        // Fall back gracefully to bundled virtual files
        console.log('Using bundled upgraded JARVIS virtual files:', err);
      }
    }
    loadInitialDiskZip();
  }, []);

  const handleUpdateFileContent = (path: string, newContent: string) => {
    setFiles((prev) => {
      const item = prev[path];
      if (!item) return prev;
      return {
        ...prev,
        [path]: {
          ...item,
          content: newContent,
          isModified: newContent !== (item.originalContent ?? item.content),
        },
      };
    });
  };

  const handleSaveFile = (path: string) => {
    setFiles((prev) => {
      const item = prev[path];
      if (!item) return prev;
      return {
        ...prev,
        [path]: {
          ...item,
          size: item.content.length,
          originalContent: item.content,
          isModified: false,
        },
      };
    });
  };

  const handleAddFile = (path: string, initialContent = '') => {
    const name = path.split('/').pop() || path;
    setFiles((prev) => ({
      ...prev,
      [path]: {
        path,
        name,
        content: initialContent,
        size: initialContent.length,
        isModified: true,
        isNew: true,
      },
    }));
  };

  const handleDeleteFile = (path: string) => {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const handleUploadZip = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const loaded = await loadZipFromArrayBuffer(buffer);
      if (Object.keys(loaded).length > 0) {
        setFiles(loaded);
      }
    } catch (err) {
      alert(`Failed to load ZIP: ${err}`);
    }
  };

  const handleDownloadZip = async () => {
    try {
      const blob = await exportZipBlob(files);
      downloadBlob(blob, 'JARVIS-main-upgraded.zip');
      setDownloadSuccessToast(true);
      setTimeout(() => setDownloadSuccessToast(false), 4000);
    } catch (err) {
      console.error('Failed to export zip:', err);
    }
  };

  const handleResetZip = () => {
    if (confirm('Reset archive back to default upgraded JARVIS files?')) {
      setFiles(INITIAL_JARVIS_FILES);
    }
  };

  const modifiedCount = Object.values(files).filter((f) => f.isModified).length;

  return (
    <div className="min-h-screen bg-[#050b14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
      {/* Top Bar Contract (3 zones) */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onDownloadZip={handleDownloadZip}
        isModifiedCount={modifiedCount}
      />

      {/* Main Content Pane */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'editor' && (
          <ZipEditor
            files={files}
            onUpdateFileContent={handleUpdateFileContent}
            onSaveFile={handleSaveFile}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
            onUploadZip={handleUploadZip}
            onDownloadZip={handleDownloadZip}
            onResetZip={handleResetZip}
          />
        )}
        {activeTab === 'diff' && <DiffInspector files={files} />}
        {activeTab === 'simulator' && <ApiSimulator />}
        {activeTab === 'services' && <CalendarEmailStudio />}
        {activeTab === 'android' && <AndroidSpecGuide />}
        {activeTab === 'deploy' && <DeployGuide />}
      </main>

      {/* Download Toast Notification */}
      {downloadSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-cyan-950 border border-cyan-400/80 rounded-lg shadow-2xl flex items-center gap-3 text-xs font-mono text-cyan-200 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span>ZIP Archive successfully bundled and downloaded!</span>
        </div>
      )}
    </div>
  );
}
