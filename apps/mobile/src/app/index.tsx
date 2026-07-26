import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1, width: '100%' }}>
      <Text>Hello World</Text>
    </SafeAreaView>
  );
}
