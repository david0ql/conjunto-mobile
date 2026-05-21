import { useCallback, useState } from 'react';
import { LayoutChangeEvent, Platform } from 'react-native';

type ScreenLayout = {
  height: number;
  width: number;
};

export function useStableScreenLayout() {
  const [layout, setLayout] = useState<ScreenLayout>({ height: 0, width: 0 });
  const [hasMeasuredAndroidLayout, setHasMeasuredAndroidLayout] = useState(false);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height, width } = event.nativeEvent.layout;

      if (height <= 0 || width <= 0) {
        return;
      }

      if (Platform.OS === 'android') {
        if (hasMeasuredAndroidLayout) {
          return;
        }

        setLayout({ height, width });
        setHasMeasuredAndroidLayout(true);
        return;
      }

      setLayout({ height, width });
    },
    [hasMeasuredAndroidLayout],
  );

  return {
    hasLayout: layout.height > 0 && layout.width > 0,
    layout,
    onLayout,
  };
}
