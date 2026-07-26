'use client';

import { useState } from 'react';

import { FileSelect } from '../modules/picker/components/file-select';
import { SyncPanel } from '../modules/sync/components/sync-panel';

export default function Index() {
  const [paths, setPaths] = useState<string[]>([]);

  return (
    <main className="w-full h-screen flex flex-col items-center justify-center gap-6">
      <FileSelect paths={paths} onPathsChange={setPaths} />
      <SyncPanel paths={paths} />
    </main>
  );
}
