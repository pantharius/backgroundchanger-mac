import { app, Menu, Tray } from "electron";
import path from "path";
import { menubar } from "menubar";
import {
  serviceStatus,
  showNotification,
  startService,
  stopService,
} from "./background";

// Path to your tray icon
const iconPath = path.join(__dirname, "..", "IconTemplate.png");
let tray: Tray;

export const buildMenu = () => {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Start Service",
      click: () => startService(),
      enabled: !serviceStatus(),
    },
    {
      label: "Stop Service",
      click: () => stopService(),
      enabled: serviceStatus(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
};
// Create Tray Menu
app.on("ready", () => {
  tray = new Tray(iconPath);
  buildMenu();

  const mb = menubar({
    tray,
  });

  mb.on("ready", () => {
    tray?.removeAllListeners(); // Prevents white screen issue on macOS
    showNotification(
      "BG Changer is ready",
      `I'm up to change when you want to !`
    );
  });
});
