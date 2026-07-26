'use client';

import { invoke } from '@tauri-apps/api/core';
import { Loader2, Radio, Smartphone, Square } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { Button } from '../../../components/ui/button';

interface ServerInfo {
  url: string;
  file_count: number;
}

interface ClientStatus {
  ip: string;
  files_received: number;
  total_files: number;
  seconds_since_last_seen: number;
}

interface SyncPanelProps {
  paths: string[];
}

const POLL_INTERVAL_MS = 1500;

function describeClient(client: ClientStatus): string {
  if (client.total_files > 0 && client.files_received >= client.total_files) {
    return 'Synced';
  }
  if (client.seconds_since_last_seen < 5) {
    return `Syncing ${client.files_received}/${client.total_files}`;
  }
  return `Idle · ${client.files_received}/${client.total_files}`;
}

export function SyncPanel({ paths }: SyncPanelProps) {
  const [status, setStatus] = useState<'idle' | 'starting' | 'serving'>('idle');
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientStatus[]>([]);

  useEffect(() => {
    if (status !== 'serving') return;

    let cancelled = false;
    const poll = async () => {
      try {
        const result = await invoke<ClientStatus[]>('get_sync_clients');
        if (!cancelled) setClients(result);
      } catch {
        // Server may have just been stopped; ignore transient poll failures.
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status]);

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
    setClients([]);
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

        {clients.length > 0 && (
          <ul className="flex w-full flex-col gap-1 rounded-lg border border-border p-2">
            {clients.map((client) => (
              <li
                key={client.ip}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm"
              >
                <span className="flex items-center gap-1.5">
                  <Smartphone className="size-3.5" /> {client.ip}
                </span>
                <span className="text-muted-foreground">
                  {describeClient(client)}
                </span>
              </li>
            ))}
          </ul>
        )}

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
        {status === 'starting' ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Radio />
        )}
        Start sync
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
