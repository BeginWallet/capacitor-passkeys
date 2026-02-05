import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.passkeysexample',
  appName: 'Passkeys Example',
  webDir: 'www',
  server: {
    // For development, use local server
    // url: 'http://localhost:5173',
    // cleartext: true, // Allow HTTP in dev
  },
  plugins: {
    // Plugin-specific configuration can go here
  },
};

export default config;
