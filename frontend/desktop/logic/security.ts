import { app, shell, type BrowserWindow, type WebContents } from "electron";
import { isHttpUrl } from "../helpers/url";
import { log } from "../helpers/logger";

export function hardenWebContents(window: BrowserWindow, appOrigin: string): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, targetUrl) => {
    const targetOrigin = safeOrigin(targetUrl);
    if (!targetOrigin || targetOrigin !== appOrigin) {
      event.preventDefault();
      if (isHttpUrl(targetUrl)) {
        void shell.openExternal(targetUrl);
      }
    }
  });
}

export function registerNavigationPolicy(appOrigin: string): void {
  app.on("web-contents-created", (_, contents: WebContents) => {
    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
      log.warn("Blocked webview attach attempt");
    });

    contents.on("will-navigate", (event, targetUrl) => {
      const targetOrigin = safeOrigin(targetUrl);
      if (!targetOrigin || targetOrigin !== appOrigin) {
        event.preventDefault();
      }
    });
  });
}

function safeOrigin(input: string): string | null {
  try {
    return new URL(input).origin;
  } catch {
    return null;
  }
}
