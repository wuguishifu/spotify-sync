'use client';

import { open } from '@tauri-apps/plugin-dialog';
import { File, FolderOpen, X } from 'lucide-react';

import { Button } from '../../../components/ui/button';

interface FileSelectProps {
  paths: string[];
  onPathsChange: (paths: string[]) => void;
}

export function FileSelect({ paths, onPathsChange }: FileSelectProps) {
  const addPaths = (selected: string | string[] | null) => {
    if (!selected) return;
    const next = Array.isArray(selected) ? selected : [selected];
    onPathsChange(Array.from(new Set([...paths, ...next])));
  };

  const handleSelectFolders = async () => {
    const selected = await open({ directory: true, multiple: true });
    addPaths(selected);
  };

  const handleSelectFiles = async () => {
    const selected = await open({ directory: false, multiple: true });
    addPaths(selected);
  };

  const removePath = (path: string) => {
    onPathsChange(paths.filter((p) => p !== path));
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleSelectFolders}>
          <FolderOpen /> Select folders
        </Button>
        <Button variant="outline" onClick={handleSelectFiles}>
          <File /> Select files
        </Button>
      </div>

      {paths.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-border p-2">
          {paths.map((path) => (
            <li
              key={path}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
            >
              <span className="truncate" title={path}>
                {path}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => removePath(path)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
