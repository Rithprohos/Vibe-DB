import { invoke, isTauri } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import type { AppState } from '@/store/useAppStore';

import { captureViewportCanvas } from '../lib/screenshot';
import type { ScreenshotPreview } from '../lib/types';

interface UseSchemaScreenshotOptions {
  showToast: AppState['showToast'];
  viewportRef: RefObject<HTMLDivElement | null>;
}

function createPreviewId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function revokeObjectUrl(preview: ScreenshotPreview | null): void {
  if (preview?.objectUrl) {
    URL.revokeObjectURL(preview.objectUrl);
  }
}

export function useSchemaScreenshot({
  showToast,
  viewportRef,
}: UseSchemaScreenshotOptions) {
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const [copyingScreenshot, setCopyingScreenshot] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<ScreenshotPreview | null>(null);
  const screenshotPreviewRef = useRef<ScreenshotPreview | null>(null);

  const replaceScreenshotPreview = useCallback((nextPreview: ScreenshotPreview | null) => {
    setScreenshotPreview((current) => {
      if (current?.objectUrl && current.objectUrl !== nextPreview?.objectUrl) {
        URL.revokeObjectURL(current.objectUrl);
      }
      screenshotPreviewRef.current = nextPreview;
      return nextPreview;
    });
  }, []);

  const clearScreenshotPreview = useCallback(() => {
    replaceScreenshotPreview(null);
  }, [replaceScreenshotPreview]);

  const handleCaptureScreenshot = useCallback(async () => {
    if (capturingScreenshot) {
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) {
      showToast({
        type: 'error',
        message: 'Capture unavailable',
      });
      return;
    }

    setCapturingScreenshot(true);

    try {
      const canvas = await captureViewportCanvas(viewport);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });
      if (!blob) {
        throw new Error('Could not generate screenshot');
      }

      const pngBytes = new Uint8Array(await blob.arrayBuffer());
      const nextPreview: ScreenshotPreview = {
        id: createPreviewId(),
        objectUrl: URL.createObjectURL(blob),
        pngBytes,
        width: canvas.width,
        height: canvas.height,
      };

      canvas.width = 0;
      canvas.height = 0;
      replaceScreenshotPreview(nextPreview);
      setCopyingScreenshot(false);
    } catch (captureError) {
      console.error('Failed to capture schema screenshot:', captureError);
      showToast({
        type: 'error',
        message:
          captureError instanceof Error
            ? `Screenshot capture failed: ${captureError.message}`
            : 'Screenshot capture failed',
      });
    } finally {
      setCapturingScreenshot(false);
    }
  }, [capturingScreenshot, replaceScreenshotPreview, showToast, viewportRef]);

  const handleCopyScreenshot = useCallback(async () => {
    if (!screenshotPreview || copyingScreenshot) {
      return;
    }

    const isDesktopCopy = isTauri();
    setCopyingScreenshot(true);

    try {
      if (isDesktopCopy) {
        await invoke('copy_schema_screenshot', {
          input: {
            pngBytes: screenshotPreview.pngBytes,
          },
        });
      } else {
        const clipboardWrite = navigator.clipboard?.write;
        const ClipboardItemCtor = window.ClipboardItem;
        if (!clipboardWrite || !ClipboardItemCtor) {
          throw new Error('Clipboard image copy is unavailable');
        }

        const imageBlob = new Blob([screenshotPreview.pngBytes], { type: 'image/png' });
        await clipboardWrite.call(navigator.clipboard, [
          new ClipboardItemCtor({ 'image/png': imageBlob }),
        ]);
      }

      showToast({
        type: 'success',
        message: 'Screenshot copied',
      });
      clearScreenshotPreview();
    } catch (copyError) {
      const copyErrorMessage =
        copyError instanceof Error
          ? copyError.message
          : typeof copyError === 'string'
            ? copyError
            : '';
      const platformLabel = isDesktopCopy ? 'Desktop clipboard' : 'Clipboard';
      console.error('Failed to copy schema screenshot:', copyError);
      showToast({
        type: 'error',
        message: copyErrorMessage
          ? `${platformLabel} copy failed: ${copyErrorMessage}`
          : `${platformLabel} copy failed`,
      });
      clearScreenshotPreview();
    } finally {
      setCopyingScreenshot(false);
    }
  }, [clearScreenshotPreview, copyingScreenshot, screenshotPreview, showToast]);

  useEffect(() => {
    screenshotPreviewRef.current = screenshotPreview;
  }, [screenshotPreview]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(screenshotPreviewRef.current);
      screenshotPreviewRef.current = null;
    };
  }, []);

  return {
    capturingScreenshot,
    clearScreenshotPreview,
    copyingScreenshot,
    handleCaptureScreenshot,
    handleCopyScreenshot,
    screenshotPreview,
  };
}
