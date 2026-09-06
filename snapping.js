/**
 * @typedef {{x: number, y: number, w: number, h: number}} Rect
 * @typedef {{orientation: 'vertical'|'horizontal', at: number}} SnapGuide
 */

/**
 * Computes a snapped position for a rect being dragged, against a set of candidate rects
 * (other windows/groups) and the viewport edges. Horizontal and vertical snapping are
 * resolved independently, each picking the single closest match within `threshold`.
 * @param {Rect} rect - the dragged rect's current (unsnapped) position/size
 * @param {Rect[]} candidates - other top-level rects to snap against
 * @param {{width: number, height: number}} viewport
 * @param {number} threshold - max distance in px that still counts as a snap
 * @returns {{x: number, y: number, guides: SnapGuide[]}}
 */
export function computeSnap(rect, candidates, viewport, threshold) {
    let { x, y } = rect;
    const { w, h } = rect;
    const guides = [];

    const xTargets = [
        ...candidates.map(r => r.x),
        ...candidates.map(r => r.x + r.w),
        0,
        viewport.width,
    ];
    const yTargets = [
        ...candidates.map(r => r.y),
        ...candidates.map(r => r.y + r.h),
        0,
        viewport.height,
    ];

    let bestXDist = threshold;
    let bestX = null;
    let bestXGuide = null;
    for (const target of xTargets) {
        for (const edge of [x, x + w]) {
            const dist = Math.abs(edge - target);
            if (dist < bestXDist) {
                bestXDist = dist;
                bestX = edge === x ? target : target - w;
                bestXGuide = target;
            }
        }
    }
    if (bestX !== null) {
        x = bestX;
        guides.push({ orientation: 'vertical', at: bestXGuide });
    }

    let bestYDist = threshold;
    let bestY = null;
    let bestYGuide = null;
    for (const target of yTargets) {
        for (const edge of [y, y + h]) {
            const dist = Math.abs(edge - target);
            if (dist < bestYDist) {
                bestYDist = dist;
                bestY = edge === y ? target : target - h;
                bestYGuide = target;
            }
        }
    }
    if (bestY !== null) {
        y = bestY;
        guides.push({ orientation: 'horizontal', at: bestYGuide });
    }

    return { x, y, guides };
}
