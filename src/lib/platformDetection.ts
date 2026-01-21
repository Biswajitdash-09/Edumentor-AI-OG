// Platform detection utility for biometric authentication UI
export type BiometricPlatform = 'ios' | 'android' | 'windows' | 'mac' | 'other';

export interface BiometricInfo {
  platform: BiometricPlatform;
  name: string;
  description: string;
  icon: 'face-id' | 'fingerprint' | 'windows-hello' | 'touch-id';
}

export const detectPlatform = (): BiometricPlatform => {
  const ua = navigator.userAgent;
  
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac/.test(ua)) return 'mac';
  
  return 'other';
};

export const getBiometricInfo = (): BiometricInfo => {
  const platform = detectPlatform();
  
  switch (platform) {
    case 'ios':
      return {
        platform,
        name: 'Face ID',
        description: 'Use Face ID to sign in instantly',
        icon: 'face-id',
      };
    case 'android':
      return {
        platform,
        name: 'Biometrics',
        description: 'Use your fingerprint or face to sign in',
        icon: 'fingerprint',
      };
    case 'windows':
      return {
        platform,
        name: 'Windows Hello',
        description: 'Use Windows Hello (camera, fingerprint, or PIN)',
        icon: 'windows-hello',
      };
    case 'mac':
      return {
        platform,
        name: 'Touch ID',
        description: 'Use Touch ID to sign in instantly',
        icon: 'touch-id',
      };
    default:
      return {
        platform,
        name: 'Biometrics',
        description: 'Use your fingerprint or face to sign in',
        icon: 'fingerprint',
      };
  }
};

export const getBiometricActionText = (): string => {
  const platform = detectPlatform();
  
  switch (platform) {
    case 'ios':
      return 'Use Face ID';
    case 'android':
      return 'Use Fingerprint';
    case 'windows':
      return 'Use Windows Hello';
    case 'mac':
      return 'Use Touch ID';
    default:
      return 'Use Biometrics';
  }
};

export const getSetupInstructions = (): string => {
  const platform = detectPlatform();
  
  switch (platform) {
    case 'ios':
      return 'Look at your device to verify with Face ID';
    case 'android':
      return 'Touch the fingerprint sensor or look at the camera';
    case 'windows':
      return 'Use your face, fingerprint, or PIN to verify';
    case 'mac':
      return 'Touch the Touch ID sensor on your keyboard';
    default:
      return 'Follow your device\'s prompt to register your biometrics';
  }
};
