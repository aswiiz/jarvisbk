import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { ConnectedAccessoriesHub } from './components/ConnectedAccessoriesHub';
import { ZipEditor } from './components/ZipEditor';
import { DiffInspector } from './components/DiffInspector';
import { ApiSimulator } from './components/ApiSimulator';
import { CalendarEmailStudio } from './components/CalendarEmailStudio';
import { AndroidSpecGuide } from './components/AndroidSpecGuide';
import { DeployGuide } from './components/DeployGuide';
import { GmailStudio } from './components/GmailStudio';
import { INITIAL_JARVIS_FILES } from './data/defaultJarvisProject';
import { ZipFileItem, AuthUser } from './types/zip';
import {
  loadZipFromUrl,
  loadZipFromArrayBuffer,
  exportZipBlob,
  downloadBlob,
} from './utils/zipManager';

export default function App() {
  // Authentication Gateway State: User requests "just a login and through that connect Gmail and other accessories"
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('jarvis_auth_active') === 'true';
  });

  const [activeTab, setActiveTab] = useState<string>('accessories');
  const [files, setFiles] = useState<Record<string, ZipFileItem>>(INITIAL_JARVIS_FILES);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState(false);

  // Authenticated user state across the studio
  const [currentUser, setCurrentUser] = useState<AuthUser>(() => {
    const saved = localStorage.getItem('jarvis_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      id: 'usr_raj_01',
      full_name: 'Raj Ashwin',
      email: 'rajraswin51@gmail.com',
      is_verified: true,
      is_google_connected: true,
      google_email: 'rajraswin51@gmail.com',
    };
  });

  const [accessToken, setAccessToken] = useState<string>(
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfcmFqXzAxIiwiZW1haWwiOiJyYWpyYXN3aW41MUBnbWFpbC5jb20iLCJleHAiOjE3NjI4MTM2MDB9.jarvis_signed_jwt_token'
  );
  const [refreshToken, setRefreshToken] = useState<string>('rt_f839a2bc901e4d77_token');

  // Sync user updates to localStorage
  const handleUpdateCurrentUser = (user: AuthUser) => {
    setCurrentUser(user);
    localStorage.setItem('jarvis_current_user', JSON.stringify(user));
  };

  const handleLoginSuccess = (user: AuthUser, accessTok: string, refreshTok: string) => {
    setCurrentUser(user);
    setAccessToken(accessTok);
    setRefreshToken(refreshTok);
    setIsAuthenticated(true);
    setActiveTab('accessories');
    localStorage.setItem('jarvis_auth_active', 'true');
    localStorage.setItem('jarvis_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('jarvis_auth_active');
  };

  const handleSkipLogin = () => {
    const guestUser: AuthUser = {
      id: `usr_guest_${Date.now().toString(36)}`,
      full_name: 'Guest User',
      email: '',
      is_verified: true,
      is_google_connected: false,
    };
    setCurrentUser(guestUser);
    setIsAuthenticated(true);
    setActiveTab('accessories');
    localStorage.setItem('jarvis_auth_active', 'true');
    localStorage.setItem('jarvis_current_user', JSON.stringify(guestUser));
  };

  // Attempt to load the real on-disk zip file if available via static assets
  useEffect(() => {
    async function loadInitialDiskZip() {
      try {
        const loaded = await loadZipFromUrl('/assets/aistudio/JARVIS-main_777a8304.zip');
        if (loaded && Object.keys(loaded).length > 0) {
          setFiles((prev) => ({
            ...prev,
            ...loaded,
          }));
        }
      } catch (err) {
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

  // If user is not yet logged in, render the clean Login & Account Gateway
  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onDownloadZip={handleDownloadZip}
        onSkip={handleSkipLogin}
      />
    );
  }

  // Once authenticated, render the full JARVIS Terminal & Connected Accessories Hub
  return (
    <div className="min-h-screen bg-[#050b14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
      {/* Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onDownloadZip={handleDownloadZip}
        isModifiedCount={modifiedCount}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Pane */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'accessories' && (
          <ConnectedAccessoriesHub
            currentUser={currentUser}
            setCurrentUser={handleUpdateCurrentUser}
            accessToken={accessToken}
            setAccessToken={setAccessToken}
            refreshToken={refreshToken}
            setRefreshToken={setRefreshToken}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onLogout={handleLogout}
            onDownloadZip={handleDownloadZip}
          />
        )}
        {activeTab === 'gmail' && (
          <GmailStudio
            currentUser={currentUser}
            onConnectGoogle={() => setActiveTab('accessories')}
          />
        )}
        {activeTab === 'calendar' && <CalendarEmailStudio />}
        {activeTab === 'simulator' && <ApiSimulator currentUser={currentUser} />}
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
