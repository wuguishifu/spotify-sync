import { documentPickerModule } from '@ss/document-picker';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { useState } from 'react';
import { Alert, Button, Text, View } from 'react-native';

const TEST_TRACKS = [require('../../assets/test-tracks/test.mp3')];

type Status = 'idle' | 'preparing' | 'exporting' | 'done' | 'error';

export default function Index() {
  const [status, setStatus] = useState<Status>('idle');

  async function handleExport() {
    try {
      setStatus('preparing');
      const stagedUris = await stageBundledTracks();

      setStatus('exporting');
      const savedUris = await documentPickerModule.exportFilesToApp(stagedUris);

      setStatus('done');
      Alert.alert(
        'Export complete',
        `Saved ${savedUris.length} file(s). Now open Spotify > Your Library > ` +
          `Local Files to check whether they show up. If not, try toggling ` +
          `"Show Local Files" off/on or relaunching Spotify.`,
      );
    } catch (err: any) {
      setStatus('error');
      if (err?.code === 'ERR_CANCELLED') {
        setStatus('idle');
        return;
      }
      Alert.alert('Export failed', String(err?.message ?? err));
    }
  }

  // Copies bundled test assets into a scratch folder in our own sandbox,
  // standing in for "files that arrived over the LAN sync transport."
  async function stageBundledTracks(): Promise<string[]> {
    const stagingDir = `${FileSystem.cacheDirectory}export-staging/`;
    await FileSystem.makeDirectoryAsync(stagingDir, {
      intermediates: true,
    }).catch(() => {});

    const uris: string[] = [];
    for (const mod of TEST_TRACKS) {
      const asset = Asset.fromModule(mod);
      await asset.downloadAsync();

      const destination = `${stagingDir}${asset.name}.${asset.type}`;
      await FileSystem.copyAsync({ from: asset.localUri!, to: destination });
      uris.push(destination);
    }
    return uris;
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <Text style={{ fontSize: 16 }}>Status: {status}</Text>
      <Button title="Export test tracks to Files" onPress={handleExport} />
    </View>
  );
}
