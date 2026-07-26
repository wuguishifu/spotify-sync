import type { HybridObject } from 'react-native-nitro-modules';

export interface DocumentPicker extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  exportFilesToApp(fileUris: string[]): Promise<string[]>;
}
