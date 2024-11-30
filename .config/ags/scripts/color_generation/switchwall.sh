#!/usr/bin/env bash

XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
CONFIG_DIR="$XDG_CONFIG_HOME/ags"

# Function to set the wallpaper
switch() {
    local imgpath=$1

    read scale screenx screeny screensizey < <(hyprctl monitors -j | jq '.[] | select(.focused) | .scale, .x, .y, .height' | xargs)

    # Get cursor position and adjust for screen scaling
    cursorposx=$(hyprctl cursorpos -j | jq '.x' 2>/dev/null || echo 960)
    cursorposx=$(bc <<< "scale=0; ($cursorposx - $screenx) * $scale / 1")
    cursorposy=$(hyprctl cursorpos -j | jq '.y' 2>/dev/null || echo 540)
    cursorposy=$(bc <<< "scale=0; ($cursorposy - $screeny) * $scale / 1")
    cursorposy_inverted=$((screensizey - cursorposy))

    [ -z "$imgpath" ] && exit 1

    # Set wallpaper silently
    swww img "$imgpath" --transition-step 100 --transition-fps 120 \
        --transition-type grow --transition-angle 30 --transition-duration 1 \
        --transition-pos "$cursorposx,$cursorposy_inverted" >/dev/null 2>&1
}

# Function to generate and apply colors
generate_colors() {
    local imgpath=$1
    [ -z "$imgpath" ] && return 1

    # Silent execution of color generation commands
    "$CONFIG_DIR"/scripts/color_generation/colorgen.sh "$imgpath" --apply --smart >/dev/null 2>&1
    wal -i "$imgpath" --saturate 0.8 >/dev/null 2>&1

    # Refresh applications asynchronously
    (pywal-discord -p ~/.config/vesktop/themes >/dev/null 2>&1 &)
    (wal-telegram >/dev/null 2>&1 &)
    (pywalfox update >/dev/null 2>&1 &)
    (pywal-spicetify "default" >/dev/null 2>&1 &)
}

# Main Script Logic
if [ "$1" == "--noswitch" ]; then
    imgpath=$(swww query | awk -F 'image: ' '{print $2}')
    [ -z "$imgpath" ] && exit 1
elif [ -n "$1" ]; then
    switch "$1"
    generate_colors "$1"
else
    # Prompt user to select an image
    cd "$(xdg-user-dir PICTURES)" || exit 1
    imgpath=$(yad --width 1200 --height 800 --file --add-preview --large-preview --title="Choose wallpaper")
    [ -n "$imgpath" ] && switch "$imgpath" && generate_colors "$imgpath"
fi
