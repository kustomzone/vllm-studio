import { app, ipcMain, shell, type BrowserWindow } from "electron";
import { DESKTOP_CONFIG } from "./configs";
import type { DesktopAppState } from "./types";
import { log } from "./helpers/logger";
import { isHttpUrl } from "./helpers/url";
import { createMainWindow } from "./logic/window-manager";
import { registerNavigationPolicy } from "./logic/security";
import { startFrontendServer, stopFrontendServer, type ServerHandle } from "./logic/app-server";
import { checkForUpdates, getUpdateState, initializeAutoUpdates } from "./logic/update-manager";

let appState: DesktopAppState = "starting";
let mainWindow: BrowserWindow | null = null;
let frontendServer: ServerHandle | undefined;

async function bootstrap(): Promise<void> {
  frontendServer = await startFrontendServer();
  registerNavigationPolicy(new URL(frontendServer.runtime.url).origin);
  mainWindow = createMainWindow(frontendServer.runtime.url);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  appState = "ready";
  log.info(
    `Desktop ready (mode=${frontendServer.runtime.mode}, url=${frontendServer.runtime.url})`,
  );
}

function registerIpcHandlers(): void {
  ipcMain.handle("desktop:get-runtime", async () => ({
    platform: process.platform,
    appVersion: app.getVersion(),
    chromeVersion: process.versions.chrome,
    electronVersion: process.versions.electron,
  }));

  ipcMain.handle("desktop:open-external", async (_, url: string) => {
    if (!isHttpUrl(url)) return false;
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle("desktop:get-update-status", async () => getUpdateState());
  ipcMain.handle("desktop:check-for-updates", async () => checkForUpdates(true));
}

async function shutdown(): Promise<void> {
  if (appState === "stopping") return;
  appState = "stopping";
  await stopFrontendServer(frontendServer);
}

async function run(): Promise<void> {
  const hasLock = app.requestSingleInstanceLock();
  if (!hasLock) {
    app.quit();
    return;
  }

  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (!mainWindow) {
      void bootstrap();
    }
  });

  app.on("before-quit", () => {
    void shutdown();
  });

  process.on("uncaughtException", (error) => {
    log.error(`Uncaught exception: ${error.stack ?? String(error)}`);
  });

  process.on("unhandledRejection", (error) => {
    log.error(`Unhandled rejection: ${String(error)}`);
  });

  registerIpcHandlers();

  await app.whenReady();

  initializeAutoUpdates();

  try {
    await bootstrap();
  } catch (error) {
    log.error(`Failed to bootstrap desktop app: ${String(error)}`);
    app.quit();
  }
}

void run();
