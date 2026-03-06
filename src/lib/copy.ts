import { useAppStore } from "@/store/useAppStore";

interface CopyOptions {
  successMessage?: string;
  errorMessage?: string;
}

export async function copyToClipboard(
  value: string,
  options?: CopyOptions,
): Promise<boolean> {
  const { showToast } = useAppStore.getState();

  try {
    await navigator.clipboard.writeText(value);
    showToast({
      type: "success",
      message: options?.successMessage ?? "Copied",
    });
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    showToast({
      type: "error",
      message: options?.errorMessage ?? "Copy failed",
    });
    return false;
  }
}
