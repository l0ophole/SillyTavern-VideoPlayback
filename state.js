/**
 * Shared in-memory registries for open video windows and groups. Nothing here is persisted -
 * open windows/groups do not survive a page reload (see settings.js for what IS persisted).
 */

/** @type {Map<string, import('./window.js').VideoWindow>} */
export const windows = new Map();

/** @type {Map<string, import('./groups.js').VideoWindowGroup>} */
export const groups = new Map();

let windowCounter = 0;
let groupCounter = 0;
let zIndexCounter = 30; // stock .draggable elements sit at z-index: 29

function uniqueId(prefix, counter) {
    let id = `${prefix}_${counter}`;
    let suffix = 0;
    while (document.getElementById(id)) {
        suffix++;
        id = `${prefix}_${counter}_${suffix}`;
    }
    return id;
}

export function nextWindowId() {
    windowCounter++;
    return uniqueId('vpw_win', windowCounter);
}

export function nextGroupId() {
    groupCounter++;
    return uniqueId('vpw_grp', groupCounter);
}

export function nextZIndex() {
    return ++zIndexCounter;
}

/**
 * Returns the bounding rects of every top-level entity (ungrouped windows + groups),
 * excluding the one currently being dragged, for use as snap candidates.
 * @param {string} excludeId - id of the window or group currently being dragged
 * @returns {{x: number, y: number, w: number, h: number}[]}
 */
export function getTopLevelRects(excludeId) {
    const rects = [];
    for (const [id, win] of windows) {
        if (id === excludeId) continue;
        if (win.groupId) continue; // grouped windows move with their group, not independently
        rects.push(win.getRect());
    }
    for (const [id, grp] of groups) {
        if (id === excludeId) continue;
        rects.push(grp.getRect());
    }
    return rects;
}

export function closeAllVideoWindows() {
    for (const win of Array.from(windows.values())) {
        win.destroy();
    }
    for (const grp of Array.from(groups.values())) {
        grp.destroy();
    }
}
