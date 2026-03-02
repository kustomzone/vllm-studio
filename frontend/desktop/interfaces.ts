import type { DesktopUpdateSnapshot } from "./types";

export interface DesktopBridge {
  getRuntime(): Promise<{
    platform: NodeJS.Platform;
    appVersion: string;
    chromeVersion: string;
    electronVersion: string;
  }>;
  openExternal(url: string): Promise<boolean>;
  getUpdateStatus(): Promise<DesktopUpdateSnapshot>;
  checkForUpdates(): Promise<DesktopUpdateSnapshot>;
}

export interface IpcRequestMap {
  "desktop:get-runtime": () => Awaited<ReturnType<DesktopBridge["getRuntime"]>>;
  "desktop:open-external": (url: string) => Awaited<ReturnType<DesktopBridge["openExternal"]>>;
  "desktop:get-update-status": () => Awaited<ReturnType<DesktopBridge["getUpdateStatus"]>>;
  "desktop:check-for-updates": () => Awaited<ReturnType<DesktopBridge["checkForUpdates"]>>;
}
