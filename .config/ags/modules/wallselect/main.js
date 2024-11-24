import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import App from "resource:///com/github/Aylur/ags/app.js";
const { GLib } = imports.gi;
const { Box, EventBox, Scrollable, Label } = Widget;

let cachedContent = null;
let wallpaperPaths = [];
let visiblePaths = [];
let isLoading = false;

// Read bar position from config
const getBarPosition = () => {
    try {
        const configPath = GLib.get_home_dir() + "/.ags/config.json";
        const config = JSON.parse(Utils.readFile(configPath));
        return config.bar?.position || "top";
    } catch (error) {
        console.error("Error reading config:", error);
        return "top";
    }
};

const WallpaperButton = (path) =>
    Widget.Button({
        child: Box({
            className: "preview-box",
            css: `background-image: url("${path}");`,
        }),
        onClicked: () => {
            Utils.execAsync(
                `sh ${GLib.get_home_dir()}/.config/ags/scripts/color_generation/switchwall.sh "${path}"`,
            );
            App.closeWindow("wallselect");
        },
    });

const getWallpaperPaths = async (directory) => {
    try {
        const files = await Utils.execAsync(
            `find ${GLib.shell_quote(directory)} -type f \\( -iname "*.jpg" -o -iname "*.png" \\)`,
        );
        return files.split("\n").filter((file) => file);
    } catch (error) {
        console.error("Error discovering wallpapers:", error);
        return [];
    }
};

// Debounced scroll event handler
const debouncedScroll = (scroll, delay = 150) => {
    let timeoutId;
    return () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            const adj = scroll.get_hadjustment();
            const scrollValue = adj.get_value();
            // Trigger load more if needed (e.g., near the end of the current list)
            if (scrollValue + adj.get_page_size() >= adj.get_upper()) {
                loadMoreWallpapers();
            }
        }, delay);
    };
};

// Lazy load more wallpapers
const loadMoreWallpapers = () => {
    if (isLoading || visiblePaths.length === wallpaperPaths.length) return;
    isLoading = true;

    const loadChunk = 20; // Load 20 wallpapers at a time
    const newPaths = wallpaperPaths.slice(
        visiblePaths.length,
        visiblePaths.length + loadChunk,
    );
    visiblePaths = [...visiblePaths, ...newPaths];

    cachedContent = EventBox({
        child: Box({
            className: "wallpaper-list",
            children: visiblePaths.map(WallpaperButton),
        }),
    });

    isLoading = false;
};

const createContent = async () => {
    if (cachedContent) return cachedContent;

    const wallpaperDir = GLib.build_filenamev([
        GLib.get_home_dir(),
        "Pictures",
        "Wallpapers",
    ]);
    try {
        wallpaperPaths = await getWallpaperPaths(wallpaperDir);

        if (wallpaperPaths.length === 0) {
            return Box({
                className: "wallpaper-placeholder",
                children: [
                    Label({
                        label: "No wallpapers found in ~/Pictures/Wallpapers.",
                        className: "fallback-label",
                    }),
                ],
            });
        }

        // Initially load a small batch of wallpapers
        visiblePaths = wallpaperPaths.slice(0, 20);
        loadMoreWallpapers();

        const scroll = Scrollable({
            hexpand: false,
            vexpand: false,
            hscroll: "always",
            vscroll: "never",
            child: Box({
                className: "wallpaper-list",
                children: visiblePaths.map(WallpaperButton),
            }),
        });

        // Debounced scroll
        const handleScroll = debouncedScroll(scroll);

        cachedContent = EventBox({
            onScrollUp: handleScroll,
            onScrollDown: handleScroll,
            child: scroll,
        });

        return cachedContent;
    } catch (error) {
        console.error("Error loading wallpapers:", error);
        return Box({
            className: "wallpaper-placeholder",
            children: [
                Label({
                    label: "Error loading wallpapers.",
                    className: "fallback-label",
                }),
            ],
        });
    }
};

createContent();

export default () =>
    Widget.Window({
        name: "wallselect",
        anchor:
            getBarPosition() === "top"
                ? ["top", "left", "right"]
                : ["bottom", "left", "right"],
        visible: false,
        child: Box({
            vertical: true,
            children: [
                EventBox({
                    onPrimaryClick: () => App.closeWindow("wallselect"),
                    onSecondaryClick: () => App.closeWindow("wallselect"),
                    onMiddleClick: () => App.closeWindow("wallselect"),
                }),
                Box({
                    vertical: true,
                    className: "sidebar-right spacing-v-15",
                    children: [
                        Box({
                            vertical: true,
                            className: "sidebar-module",
                            setup: (self) =>
                                self.hook(
                                    App,
                                    async (_, name, visible) => {
                                        if (name === "wallselect" && visible) {
                                            const content =
                                                await createContent();
                                            self.children = [content];
                                        }
                                    },
                                    "window-toggled",
                                ),
                        }),
                    ],
                }),
            ],
        }),
    });
