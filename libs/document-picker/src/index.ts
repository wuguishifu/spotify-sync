import { NitroModules } from 'react-native-nitro-modules';
import { DocumentPicker } from './lib/document-picker.nitro.js';

export const documentPickerModule =
  NitroModules.createHybridObject<DocumentPicker>('DocumentPicker');
