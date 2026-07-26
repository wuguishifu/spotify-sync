'use client';

import { invoke } from '@tauri-apps/api/core';
import { Loader2, Radio, Square } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

import { Button } from '../../../components/ui/button';

interface ServerInfo {
  url: string;
  file_count: number;
}

interface SyncPanelProps {
  paths: string[];
}

export function SyncPanel({ paths }: SyncPanelProps) {
  const [status, setStatus] = useState<'idle' | 'starting' | 'serving'>('idle');
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setStatus('starting');
    setError(null);
    try {
      const info = await invoke<ServerInfo>('start_sync_server', { paths });
      setServer(info);
      setStatus('serving');
    } catch (err) {
      setError(String(err));
      setStatus('idle');
    }
  };

  const handleStop = async () => {
    await invoke('stop_sync_server');
    setServer(null);
    setStatus('idle');
  };

  if (status === 'serving' && server) {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-border p-4">
        <div className="rounded-lg bg-white p-3">
          <QRCodeSVG value={server.url} size={192} />
        </div>
        <p className="text-sm text-muted-foreground">
          Scan this QR code from the mobile app on the same Wi-Fi network
        </p>
        <p className="text-xs text-muted-foreground">
          {server.url} · {server.file_count} file
          {server.file_count === 1 ? '' : 's'}
        </p>
        <Button variant="outline" onClick={handleStop}>
          <Square /> Stop sync
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <Button
        onClick={handleStart}
        disabled={paths.length === 0 || status === 'starting'}
      >
        {status === 'starting' ? <Loader2 className="animate-spin" /> : <Radio />}
        Start sync
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
