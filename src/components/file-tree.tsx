"use client";

import React, { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileTreeProps {
  appId: string;
  onFileSelect: (path: string) => void;
}

const FileNodeView: React.FC<{ node: FileNode; onFileSelect: (path: string) => void; level: number }> = ({ node, onFileSelect, level }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (node.type === 'directory') {
    return (
      <div>
        <div
          className="flex items-center p-1 rounded-md hover:bg-sidebar-accent cursor-pointer"
          style={{ paddingLeft: `${level * 12 + 4}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
          <Folder className="h-4 w-4 mr-2 text-yellow-500" />
          <span className="text-sm">{node.name}</span>
        </div>
        {isOpen && node.children && (
          <div>
            {node.children.map(child => (
              <FileNodeView key={child.path} node={child} onFileSelect={onFileSelect} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center p-1 rounded-md hover:bg-sidebar-accent cursor-pointer"
      style={{ paddingLeft: `${level * 12 + 4}px` }}
      onClick={() => onFileSelect(node.path)}
    >
      <File className="h-4 w-4 mr-2 text-blue-500" />
      <span className="text-sm">{node.name}</span>
    </div>
  );
};

export function FileTree({ appId, onFileSelect }: FileTreeProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/apps/${appId}/files`);
        if (!response.ok) throw new Error('No se pudo cargar la estructura de archivos.');
        const data = await response.json();
        setFileTree(data);
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (appId) {
      fetchFiles();
    }
  }, [appId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-2">
      {fileTree.map(node => (
        <FileNodeView key={node.path} node={node} onFileSelect={onFileSelect} level={0} />
      ))}
    </div>
  );
}