import JSZip from 'jszip';
import { ZipFileItem, FileTreeNode, FolderNode, FileNode } from '../types/zip';

export async function loadZipFromUrl(url: string): Promise<Record<string, ZipFileItem>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch zip from ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return loadZipFromArrayBuffer(arrayBuffer);
}

export async function loadZipFromArrayBuffer(buffer: ArrayBuffer): Promise<Record<string, ZipFileItem>> {
  const zip = await JSZip.loadAsync(buffer);
  const files: Record<string, ZipFileItem> = {};

  const entries = Object.keys(zip.files);
  for (const filename of entries) {
    const entry = zip.files[filename];
    if (entry.dir) continue;

    // Read file text
    try {
      const text = await entry.async('string');
      const name = filename.split('/').pop() || filename;
      files[filename] = {
        path: filename,
        name,
        content: text,
        size: text.length,
        originalContent: text,
        isModified: false,
      };
    } catch {
      // Binary files or skip
    }
  }

  return files;
}

export async function exportZipBlob(files: Record<string, ZipFileItem>): Promise<Blob> {
  const zip = new JSZip();
  for (const [path, item] of Object.entries(files)) {
    zip.file(path, item.content);
  }
  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildFileTree(files: Record<string, ZipFileItem>): FileTreeNode[] {
  const rootNodes: (FolderNode | FileNode)[] = [];

  const getOrCreateFolder = (parts: string[], currentLevel: (FolderNode | FileNode)[]): FolderNode => {
    let currentPath = '';
    let currentList = currentLevel;

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let existing = currentList.find((node) => node.isFolder && node.name === part) as FolderNode | undefined;
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          isFolder: true,
          children: [],
        };
        currentList.push(existing);
      }
      currentList = existing.children;
    }

    return currentList as unknown as FolderNode;
  };

  const sortedPaths = Object.keys(files).sort();

  for (const path of sortedPaths) {
    const item = files[path];
    const parts = path.split('/');
    const fileName = parts.pop()!;

    if (parts.length === 0) {
      rootNodes.push({
        name: fileName,
        path,
        isFolder: false,
        size: item.size,
        isModified: item.isModified,
      });
    } else {
      let currentList = rootNodes;
      let currentPath = '';
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        let folder = currentList.find((node) => node.isFolder && node.name === part) as FolderNode | undefined;
        if (!folder) {
          folder = {
            name: part,
            path: currentPath,
            isFolder: true,
            children: [],
          };
          currentList.push(folder);
        }
        currentList = folder.children;
      }
      currentList.push({
        name: fileName,
        path,
        isFolder: false,
        size: item.size,
        isModified: item.isModified,
      });
    }
  }

  // Sort nodes: folders first, then files alphabetically
  const sortRecursive = (nodes: (FolderNode | FileNode)[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.isFolder) {
        sortRecursive(node.children);
      }
    }
  };

  sortRecursive(rootNodes);
  return rootNodes;
}
