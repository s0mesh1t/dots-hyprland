import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import App from "resource:///com/github/Aylur/ags/app.js";
const { GLib } = imports.gi;
const { Box, EventBox, Scrollable, Label } = Widget;

let cachedContent = null;
let wallpaperPaths = [];
let visiblePaths = [];
let isLoading = true;

// Constants
const THUMBNAIL_DIR = GLib.build_filenamev([
    GLib.get_home_dir(),
    "Pictures",
    "Wallpapers",
    "thumbnails",
]);
const WALLPAPER_DIR = GLib.build_filenamev([
    GLib.get_home_dir(),
    "Pictures",
    "Wallpapers",
]);

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

// Wallpaper Button
const WallpaperButton = (path) =>
    Widget.Button({
        child: Box({
            className: "preview-box",
            css: `background-image: url("${path}");`,
        }),
        onClicked: () => {
            Utils.execAsync(
                `sh ${GLib.get_home_dir()}/.config/ags/scripts/color_generation/switchwall.sh "${path.replace(
                    "thumbnails",
                    "",
                )}"`,
            );
            App.closeWindow("wallselect");
        },
    });

// Get Wallpaper Paths
const getWallpaperPaths = async () => {
    try {
        const files = await Utils.execAsync(
            `find ${GLib.shell_quote(THUMBNAIL_DIR)} -type f \\( -iname "*.jpg" -o -iname "*.png" \\)`,
        );
        return files.split("\n").filter((file) => file);
    } catch (error) {
        console.error("Error discovering thumbnails:", error);
        return [];
    }
};

// Debounced Scroll Event
const debouncedScroll = (scroll, delay = 150) => {
    let timeoutId;
    return () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            const adj = scroll.get_hadjustment();
            const scrollValue = adj.get_value();
            if (scrollValue + adj.get_page_size() >= adj.get_upper()) {
                loadMoreWallpapers();
            }
        }, delay);
    };
};

// Lazy Load Wallpapers
const loadMoreWallpapers = () => {
    if (isLoading || visiblePaths.length === wallpaperPaths.length) return;
    isLoading = true;

    const loadChunk = 5000; // Load smaller batches for smoother scrolling
    const newPaths = wallpaperPaths.slice(
        visiblePaths.length,
        visiblePaths.length + loadChunk,
    );
    visiblePaths = [...visiblePaths, ...newPaths];

    cachedContent.child.children = visiblePaths.map(WallpaperButton);
    isLoading = false;
};

// Create Content
const createContent = async () => {
    if (cachedContent) return cachedContent;

    try {
        wallpaperPaths = await getWallpaperPaths();

        if (wallpaperPaths.length === 0) {
            return Box({
                className: "wallpaper-placeholder",
                children: [
                    Label({
                        label: "No wallpapers found. Run the thumbnail generator script.",
                        className: "fallback-label",
                    }),
                ],
            });
        }

        // Load initial wallpapers
        visiblePaths = wallpaperPaths.slice(0, 5000);

        const scroll = Scrollable({
            hexpand: true,
            vexpand: false,
            hscroll: "always",
            vscroll: "never",
            child: Box({
                className: "wallpaper-list",
                children: visiblePaths.map(WallpaperButton),
            }),
        });

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
                    label: "Error loading wallpapers. Check the console for details.",
                    className: "error-label",
                }),
            ],
        });
    }
};

// Main Window
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
