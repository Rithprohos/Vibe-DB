import { useState, useCallback } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

interface UpdateInfo {
  available: boolean;
  version?: string;
  date?: string;
  body?: string;
}

interface UpdateState {
  checking: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
  updateInfo: UpdateInfo | null;
  progress: number;
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({
    checking: false,
    downloading: false,
    downloaded: false,
    error: null,
    updateInfo: null,
    progress: 0,
  });

  const checkForUpdates = useCallback(async () => {
    setState(s => ({ ...s, checking: true, error: null }));
    console.log('Checking for updates...');

    try {
      const update = await check();

      if (update) {
        setState(s => ({
          ...s,
          checking: false,
          updateInfo: {
            available: true,
            version: update.version,
            date: update.date,
            body: update.body,
          },
        }));
        console.log(`Update available: v${update.version}`);
        return update;
      } else {
        setState(s => ({
          ...s,
          checking: false,
          updateInfo: { available: false },
        }));
        console.log('No updates available');
        return null;
      }
    } catch (e: any) {
      setState(s => ({ ...s, checking: false, error: e.message }));
      console.error('Update check failed:', e.message);
      return null;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    setState(s => ({ ...s, downloading: true, error: null, progress: 0 }));
    console.log('Downloading update...');

    try {
      const update = await check();

      if (!update) {
        throw new Error('No update available');
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            console.log(`Downloading ${Math.round(contentLength / 1024 / 1024)}MB...`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            const progress = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
            setState(s => ({ ...s, progress }));
            break;
          case 'Finished':
            console.log('Download complete, installing...');
            setState(s => ({ ...s, downloading: false, downloaded: true }));
            break;
        }
      });

      console.log('Update installed, relaunching...');
      await relaunch();
    } catch (e: any) {
      setState(s => ({ ...s, downloading: false, error: e.message }));
      console.error('Update failed:', e.message);
    }
  }, []);

  return {
    ...state,
    checkForUpdates,
    downloadAndInstall,
  };
}