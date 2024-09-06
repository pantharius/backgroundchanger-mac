"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMenu = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const menubar_1 = require("menubar");
const background_1 = require("./background");
// Path to your tray icon
const iconPath = path_1.default.join(__dirname, '..', 'IconTemplate.png');
let tray;
const buildMenu = () => {
    const contextMenu = electron_1.Menu.buildFromTemplate([
        { label: 'Start Service', click: () => (0, background_1.startService)(), enabled: !(0, background_1.serviceStatus)() },
        { label: 'Stop Service', click: () => (0, background_1.stopService)(), enabled: (0, background_1.serviceStatus)() },
        { type: 'separator' },
        { label: 'Quit', click: () => { electron_1.app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
};
exports.buildMenu = buildMenu;
// Create Tray Menu
electron_1.app.on('ready', () => {
    tray = new electron_1.Tray(iconPath);
    (0, exports.buildMenu)();
    const mb = (0, menubar_1.menubar)({
        tray,
    });
    mb.on('ready', () => {
        tray?.removeAllListeners(); // Prevents white screen issue on macOS
        (0, background_1.showNotification)('BG Changer is ready', `I'm up to change when you want to !`);
    });
});
