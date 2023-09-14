const { Widget } = ags;
import { RoundedCorner } from "../modules/lib/roundedcorner.js";

export const corner_topleft = Widget.Window({
    name: 'cornertl',
    // layer: 'overlay',
    anchor: ['top', 'left'],
    exclusive: false,
    child: RoundedCorner('topleft', {className: 'corner',}),
});
export const corner_topright = Widget.Window({
    name: 'cornertr',
    // layer: 'overlay',
    anchor: ['top', 'right'],
    exclusive: false,
    child: RoundedCorner('topright', {className: 'corner',}),
});
export const corner_bottomleft = Widget.Window({
    name: 'cornerbl',
    // layer: 'overlay',
    anchor: ['bottom', 'left'],
    exclusive: false,
    layer: 'overlay',
    child: RoundedCorner('bottomleft', {className: 'corner-black',}),
});
export const corner_bottomright = Widget.Window({
    name: 'cornerbr',
    // layer: 'overlay',
    anchor: ['bottom', 'right'],
    exclusive: false,
    child: RoundedCorner('bottomright', {className: 'corner-black',}),
});

