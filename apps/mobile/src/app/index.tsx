import { documentPickerModule } from '@ss/document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Text,
  View,
} from 'react-native';

type Status =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'downloading'
  | 'exporting'
  | 'done'
  | 'error';

type FileStatus = 'pending' | 'downloading' | 'done' | 'error';

interface ManifestFile {
  id: number;
  name: string;
  size: number;
}

interface Manifest {
  files: ManifestFile[];
}

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Idle',
  scanning: 'Scanning',
  connecting: 'Connecting to desktop app…',
  downloading: 'Downloading files',
  exporting: 'Preparing export…',
  done: 'Done',
  error: 'Something went wrong',
};

const FILE_STATUS_LABEL: Record<FileStatus, string> = {
  pending: 'Waiting…',
  downloading: 'Downloading…',
  done: 'Done',
  error: 'Failed',
};

export default function Index() {
  const [status, setStatus] = useState<Status>('idle');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [files, setFiles] = useState<ManifestFile[]>([]);
  const [fileStatuses, setFileStatuses] = useState<Record<number, FileStatus>>(
    {},
  );

  function setFileStatus(id: number, fileStatus: FileStatus) {
    setFileStatuses((prev) => ({ ...prev, [id]: fileStatus }));
  }

  async function handleScanQrCode() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera permission required',
          "Enable camera access to scan the desktop app's QR code.",
        );
        return;
      }
    }
    setScanned(false);
    setFiles([]);
    setFileStatuses({});
    setStatus('scanning');
  }

  async function handleBarcodeScanned({ data }: BarcodeScanningResult) {
    if (scanned) return;
    setScanned(true);
    const serverUrl = data;

    try {
      setStatus('connecting');
      const manifest = await fetchManifest(serverUrl);
      setFiles(manifest.files);
      const initialStatuses: Record<number, FileStatus> = {};
      for (const file of manifest.files) {
        initialStatuses[file.id] = 'pending';
      }
      setFileStatuses(initialStatuses);

      setStatus('downloading');
      const stagedUris = await downloadFiles(serverUrl, manifest);

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
      Alert.alert('Sync failed', String(err?.message ?? err));
    }
  }

  async function fetchManifest(serverUrl: string): Promise<Manifest> {
    const response = await fetch(`${serverUrl}/manifest`);
    if (!response.ok) {
      throw new Error(
        `Failed to reach desktop app (status ${response.status})`,
      );
    }
    return response.json();
  }

  // Downloads every file in the manifest into a scratch folder in our own
  // sandbox -- these are the files that arrived over the LAN sync transport.
  async function downloadFiles(
    serverUrl: string,
    manifest: Manifest,
  ): Promise<string[]> {
    const stagingDir = `${FileSystem.cacheDirectory}sync-staging/`;
    await FileSystem.makeDirectoryAsync(stagingDir, {
      intermediates: true,
    }).catch(() => undefined);

    const uris: string[] = [];
    for (const file of manifest.files) {
      setFileStatus(file.id, 'downloading');
      const destination = `${stagingDir}${file.name}`;
      try {
        const result = await FileSystem.downloadAsync(
          `${serverUrl}/files/${file.id}`,
          destination,
        );
        if (result.status !== 200) {
          throw new Error(`Failed to download ${file.name}`);
        }
        setFileStatus(file.id, 'done');
        uris.push(destination);
      } catch (err) {
        setFileStatus(file.id, 'error');
        throw err;
      }
    }
    return uris;
  }

  if (status === 'scanning') {
    return (
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View style={{ position: 'absolute', bottom: 40, alignSelf: 'center' }}>
          <Button title="Cancel" onPress={() => setStatus('idle')} />
        </View>
      </View>
    );
  }

  if (
    status === 'connecting' ||
    status === 'downloading' ||
    status === 'exporting'
  ) {
    return (
      <View
        style={{
          flex: 1,
          paddingTop: 80,
          paddingHorizontal: 20,
          gap: 16,
          backgroundColor: 'white',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator />
          <Text style={{ fontSize: 16, fontWeight: '600' }}>
            {STATUS_LABEL[status]}
          </Text>
        </View>
        <FlatList
          data={files}
          keyExtractor={(file) => String(file.id)}
          renderItem={({ item }) => {
            const fileStatus = fileStatuses[item.id] ?? 'pending';
            return (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: '#e5e5e5',
                }}
              >
                <Text numberOfLines={1} style={{ flex: 1, marginRight: 8 }}>
                  {item.name}
                </Text>
                <Text
                  style={{
                    color:
                      fileStatus === 'done'
                        ? '#1a9d4b'
                        : fileStatus === 'error'
                          ? '#d1373f'
                          : '#666',
                  }}
                >
                  {FILE_STATUS_LABEL[fileStatus]}
                </Text>
              </View>
            );
          }}
        />
      </View>
    );
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
      <Button title="Scan QR code to sync" onPress={handleScanQrCode} />
    </View>
  );
}
