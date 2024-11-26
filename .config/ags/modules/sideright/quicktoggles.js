const { GLib } = imports.gi;
import App from "resource:///com/github/Aylur/ags/app.js";
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";

import Bluetooth from "resource:///com/github/Aylur/ags/service/bluetooth.js";
import Network from "resource:///com/github/Aylur/ags/service/network.js";
const { execAsync, exec } = Utils;
import {
    BluetoothIndicator,
    NetworkIndicator,
} from "../.commonwidgets/statusicons.js";
import { setupCursorHover } from "../.widgetutils/cursorhover.js";
import { MaterialIcon } from "../.commonwidgets/materialicon.js";
import { sidebarOptionsStack } from "./sideright.js";

// Кэшируем часто используемые значения
const userOpts = userOptions.asyncGet();
const configDir = App.configDir;

export const ToggleIconWifi = (props = {}) => {
    const button = Widget.Button({
        className: "txt-small sidebar-iconbutton",
        tooltipText: getString("Wifi | Right-click to configure"),
        onClicked: Network.toggleWifi,
        onSecondaryClickRelease: () => {
            execAsync(["bash", "-c", userOpts.apps.network]).catch(print);
            closeEverything();
        },
        child: NetworkIndicator(),
        setup: (self) => {
            setupCursorHover(self);
            self.hook(Network, (button) => {
                const isConnected = [
                    Network.wifi?.internet,
                    Network.wired?.internet,
                ].includes("connected");
                button.toggleClassName("sidebar-button-active", isConnected);
                button.tooltipText = `${Network.wifi?.ssid || getString("Unknown")} | ${getString("Right-click to configure")}`;
            });
        },
        ...props,
    });
    return button;
};

export const ToggleIconBluetooth = (props = {}) => {
    const button = Widget.Button({
        className: "txt-small sidebar-iconbutton",
        tooltipText: getString("Bluetooth | Right-click to configure"),
        onClicked: () => {
            exec(
                Bluetooth?.enabled
                    ? "rfkill block bluetooth"
                    : "rfkill unblock bluetooth",
            );
        },
        onSecondaryClickRelease: () => {
            execAsync(["bash", "-c", userOpts.apps.bluetooth]).catch(print);
            closeEverything();
        },
        child: BluetoothIndicator(),
        setup: (self) => {
            setupCursorHover(self);
            self.hook(Bluetooth, (button) => {
                button.toggleClassName(
                    "sidebar-button-active",
                    Bluetooth?.enabled,
                );
            });
        },
        ...props,
    });
    return button;
};

const hyprctl = (cmd) => execAsync(["hyprctl", ...cmd.split(" ")]).catch(print);
const getHyprOption = async (opt) =>
    JSON.parse(await Utils.execAsync(`hyprctl -j getoption ${opt}`));

export const HyprToggleIcon = async (
    icon,
    name,
    hyprlandConfigValue,
    props = {},
) => {
    try {
        const button = Widget.Button({
            className: "txt-small sidebar-iconbutton",
            tooltipText: name,
            onClicked: async (button) => {
                const currentOption = (await getHyprOption(hyprlandConfigValue))
                    .int;
                await hyprctl(
                    `keyword ${hyprlandConfigValue} ${1 - currentOption}`,
                );
                button.toggleClassName(
                    "sidebar-button-active",
                    currentOption == 0,
                );
            },
            child: MaterialIcon(icon, "norm", { hpack: "center" }),
            setup: async (button) => {
                const value =
                    (await getHyprOption(hyprlandConfigValue)).int == 1;
                button.toggleClassName("sidebar-button-active", value);
                setupCursorHover(button);
            },
            ...props,
        });
        return button;
    } catch {
        return null;
    }
};

export const ModuleNightLight = async (props = {}) => {
    if (!exec(`bash -c 'command -v gammastep'`)) return null;

    const button = Widget.Button({
        attribute: { enabled: false },
        className: "txt-small sidebar-iconbutton",
        tooltipText: getString("Night Light"),
        onClicked: async (self) => {
            self.attribute.enabled = !self.attribute.enabled;
            self.toggleClassName(
                "sidebar-button-active",
                self.attribute.enabled,
            );

            if (self.attribute.enabled) {
                await execAsync("gammastep").catch(print);
            } else {
                self.sensitive = false;
                await execAsync("pkill gammastep").catch(print);
                const checkInterval = setInterval(() => {
                    execAsync("pkill -0 gammastep").catch(() => {
                        self.sensitive = true;
                        clearInterval(checkInterval);
                    });
                }, 500);
            }
        },
        child: MaterialIcon("nightlight", "norm"),
        setup: (self) => {
            setupCursorHover(self);
            self.attribute.enabled = !!exec("pidof gammastep");
            self.toggleClassName(
                "sidebar-button-active",
                self.attribute.enabled,
            );
        },
        ...props,
    });
    return button;
};

export const ModuleCloudflareWarp = async (props = {}) => {
    if (!exec(`bash -c 'command -v warp-cli'`)) return null;

    const button = Widget.Button({
        attribute: { enabled: false },
        className: "txt-small sidebar-iconbutton",
        tooltipText: getString("Cloudflare WARP"),
        onClicked: async (self) => {
            self.attribute.enabled = !self.attribute.enabled;
            self.toggleClassName(
                "sidebar-button-active",
                self.attribute.enabled,
            );
            await execAsync(
                `warp-cli ${self.attribute.enabled ? "connect" : "disconnect"}`,
            ).catch(print);
        },
        child: Widget.Icon({
            icon: "cloudflare-dns-symbolic",
            className: "txt-norm",
        }),
        setup: (self) => {
            setupCursorHover(self);
            self.attribute.enabled = !exec(
                `bash -c 'warp-cli status | grep Disconnected'`,
            );
            self.toggleClassName(
                "sidebar-button-active",
                self.attribute.enabled,
            );
        },
        ...props,
    });
    return button;
};

export const ModuleInvertColors = async (props = {}) => {
    try {
        const Hyprland = (
            await import("resource:///com/github/Aylur/ags/service/hyprland.js")
        ).default;
        const shaderPath = `${GLib.get_user_config_dir()}/hypr/shaders/invert.frag`;

        return Widget.Button({
            className: "txt-small sidebar-iconbutton",
            tooltipText: getString("Color inversion"),
            onClicked: async (button) => {
                const output = await Hyprland.messageAsync(
                    "j/getoption decoration:screen_shader",
                );
                const currentShader = JSON.parse(output)["str"].trim();
                const newShader =
                    currentShader != "[[EMPTY]]" && currentShader != ""
                        ? "[[EMPTY]]"
                        : shaderPath;

                await Hyprland.messageAsync(
                    `j/keyword decoration:screen_shader ${newShader}`,
                ).catch(print);
                button.toggleClassName(
                    "sidebar-button-active",
                    newShader !== "[[EMPTY]]",
                );
            },
            child: MaterialIcon("invert_colors", "norm"),
            setup: setupCursorHover,
            ...props,
        });
    } catch {
        return null;
    }
};

export const ModuleRawInput = async (props = {}) => {
    try {
        const Hyprland = (
            await import("resource:///com/github/Aylur/ags/service/hyprland.js")
        ).default;

        return Widget.Button({
            className: "txt-small sidebar-iconbutton",
            tooltipText: "Raw input",
            onClicked: async (button) => {
                const output = await Hyprland.messageAsync(
                    "j/getoption input:accel_profile",
                );
                const value = JSON.parse(output)["str"].trim();
                const newValue =
                    value != "[[EMPTY]]" && value != "" ? "[[EMPTY]]" : "flat";

                await Hyprland.messageAsync(
                    `j/keyword input:accel_profile ${newValue}`,
                ).catch(print);
                button.toggleClassName(
                    "sidebar-button-active",
                    newValue !== "[[EMPTY]]",
                );
            },
            child: MaterialIcon("mouse", "norm"),
            setup: setupCursorHover,
            ...props,
        });
    } catch {
        return null;
    }
};

export const ModuleIdleInhibitor = (props = {}) => {
    const scriptPath = `${configDir}/scripts/wayland-idle-inhibitor.py`;

    return Widget.Button({
        attribute: { enabled: false },
        className: "txt-small sidebar-iconbutton",
        tooltipText: getString("Keep system awake"),
        onClicked: async (self) => {
            self.attribute.enabled = !self.attribute.enabled;
            self.toggleClassName(
                "sidebar-button-active",
                self.attribute.enabled,
            );

            if (self.attribute.enabled) {
                await execAsync([
                    "bash",
                    "-c",
                    `pidof wayland-idle-inhibitor.py || ${scriptPath}`,
                ]).catch(print);
            } else {
                await execAsync("pkill -f wayland-idle-inhibitor.py").catch(
                    print,
                );
            }
        },
        child: MaterialIcon("coffee", "norm"),
        setup: (self) => {
            setupCursorHover(self);
            self.attribute.enabled = !!exec("pidof wayland-idle-inhibitor.py");
            self.toggleClassName(
                "sidebar-button-active",
                self.attribute.enabled,
            );
        },
        ...props,
    });
};

export const ModuleReloadIcon = (props = {}) =>
    Widget.Button({
        ...props,
        className: "txt-small sidebar-iconbutton",
        tooltipText: getString("Reload Environment config"),
        onClicked: async () => {
            await execAsync([
                "bash",
                "-c",
                "hyprctl reload || swaymsg reload &",
            ]);
            App.closeWindow("sideright");
        },
        child: MaterialIcon("refresh", "norm"),
        setup: setupCursorHover,
    });

export const ModuleSettingsIcon = ({ hpack = "center" } = {}) =>
    Widget.Button({
        hpack: hpack,
        className: "txt-norm icon-material sidebar-iconbutton",
        tooltipText: "AGS Settings",
        label: "settings",
        onClicked: () => {
            App.closeWindow("sideright");
            Utils.execAsync([
                "bash",
                "-c",
                `${GLib.get_home_dir()}/.local/bin/ags-tweaks`,
            ]);
        },
    });

export const ModulePowerIcon = (props = {}) =>
    Widget.Button({
        ...props,
        className: "txt-small sidebar-iconbutton",
        tooltipText: getString("Session"),
        onClicked: () => {
            closeEverything();
            Utils.timeout(1, () => openWindowOnAllMonitors("session"));
        },
        child: MaterialIcon("power_settings_new", "norm"),
        setup: setupCursorHover,
    });
export const ModuleGithub = (props = {}) =>
    Widget.Button({
        ...props,
        className: "txt-small sidebar-iconbutton",
        tooltipText: getString("Session"),
        onClicked: async () => {
            await execAsync([
                "bash",
                "-c",
                "xdg-open --new-window https://www.github.com",
            ]);
            App.closeWindow("sideright");
        },
        onSecondaryClickRelease: async () => {
            await execAsync(["bash", "-c", "github-desktop"]);
            App.closeWindow("sideright");
        },
        child: MaterialIcon("commit", "norm"),
        setup: setupCursorHover,
    });
export const ModuleGtkModeToggle = async (props = {}) => {
    const button = Widget.Button({
        attribute: { enabled: false },
        className: "txt-small sidebar-iconbutton",
        tooltipText: getString("Toggle GTK Mode"),
        onClicked: async (self) => {
            self.attribute.enabled = !self.attribute.enabled;
            self.toggleClassName(
                "sidebar-button-active",
                self.attribute.enabled,
            );

            const mode = self.attribute.enabled ? "dark" : "light";

            // Set the GTK mode
            await execAsync(
                `gsettings set org.gnome.desktop.interface gtk-theme '${mode}-theme'`,
            ).catch(print);

            // Optional: Set additional adjustments for terminal, etc.
            // await execAsync(`command-for-terminal-adjustments-${mode}`).catch(print);
        },
        child: MaterialIcon("brightness_medium", "norm"),
        setup: (self) => {
            setupCursorHover(self);

            // Detect the current GTK mode
            const currentMode = exec(
                `gsettings get org.gnome.desktop.interface gtk-theme`,
            );
            self.attribute.enabled = currentMode.includes("dark");
            self.toggleClassName(
                "sidebar-button-active",
                self.attribute.enabled,
            );
        },
        ...props,
    });
    return button;
};
export const ModuleVM = (props = {}) =>
    Widget.Button({
        ...props,
        className: "txt-small sidebar-iconbutton",
        tooltipText: getString("Session"),
        onClicked: async () => {
            await execAsync([
                "bash",
                "-c",
                "gnome-boxes --open-uuid f034ed73-2018-4287-bbfa-ddf2a563b67d",
            ]);
            App.closeWindow("sideright");
        },
        onSecondaryClickRelease: async () => {
            await execAsync(["bash", "-c", "obsidian"]);
            App.closeWindow("sideright");
        },
        child: MaterialIcon("window", "norm"),
        setup: setupCursorHover,
    });
