import React from 'react';
import {
  requireNativeComponent,
  StyleSheet,
  ViewProps,
} from 'react-native';

type NativePoseOverlayProps = ViewProps & {
  enabled?: boolean;
  mirrored?: boolean;
};

const NativePoseOverlayView = requireNativeComponent<NativePoseOverlayProps>('PoseOverlayView');

export const NativePoseOverlay: React.FC<NativePoseOverlayProps> = ({
  enabled = true,
  mirrored = false,
  style,
}) => {
  return (
    <NativePoseOverlayView
      pointerEvents="none"
      enabled={enabled}
      mirrored={mirrored}
      style={StyleSheet.flatten([StyleSheet.absoluteFillObject, style])}
    />
  );
};
