import { computeSnap } from './snapping.js';
import { getSettings } from './settings.js';

let guideLayer = null;

function ensureGuideLayer() {
    if (guideLayer) {
        return guideLayer;
    }
    guideLayer = document.createElement('div');
    guideLayer.id = 'vpwSnapGuides';
    document.body.appendChild(guideLayer);
    return guideLayer;
}

/** @param {import('./snapping.js').SnapGuide[]} guides */
function renderGuides(guides) {
    const layer = ensureGuideLayer();
    layer.innerHTML = '';
    for (const guide of guides) {
        const div = document.createElement('div');
        div.classList.add('vpwSnapGuide', guide.orientation);
        if (guide.orientation === 'vertical') {
            div.style.left = `${guide.at}px`;
        } else {
            div.style.top = `${guide.at}px`;
        }
        layer.appendChild(div);
    }
}

function clearGuides() {
    if (guideLayer) {
        guideLayer.innerHTML = '';
    }
}

/**
 * Wires a self-contained mousedown/mousemove/mouseup drag interaction on `grabberEl` that
 * repositions `el` via absolute `left`/`top`, with optional edge-snapping against
 * `getCandidateRects()` (evaluated once at drag-start) and the viewport.
 * Deliberately does not use ST's own `dragElement` (RossAscends-mods.js), which is gated
 * behind the global "Movable UI Panels" setting and unconditionally persists into
 * `power_user.movingUIState` - both wrong for these always-draggable, ephemeral windows.
 * @param {HTMLElement} el - the element to move
 * @param {HTMLElement} grabberEl - the drag handle
 * @param {() => import('./snapping.js').Rect[]} getCandidateRects
 * @param {() => void} [onDragStart]
 */
export function makeDraggable(el, grabberEl, getCandidateRects, onDragStart) {
    let startX = 0, startY = 0, startLeft = 0, startTop = 0, candidates = [];

    function onMouseDown(e) {
        if (e.button !== 0) {
            return;
        }
        e.preventDefault();
        onDragStart?.();
        const rect = el.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        candidates = getCandidateRects();
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp, { once: true });
    }

    function onMouseMove(e) {
        let x = startLeft + (e.clientX - startX);
        let y = startTop + (e.clientY - startY);
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const settings = getSettings();

        if (settings.snapEnabled) {
            const viewport = { width: window.innerWidth, height: window.innerHeight };
            const snap = computeSnap({ x, y, w, h }, candidates, viewport, settings.snapThreshold);
            x = snap.x;
            y = snap.y;
            renderGuides(snap.guides);
        } else {
            clearGuides();
        }

        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        clearGuides();
    }

    grabberEl.addEventListener('mousedown', onMouseDown);

    return function destroy() {
        grabberEl.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mousemove', onMouseMove);
    };
}

/**
 * Clamps an element to a minimum size while still allowing native CSS `resize: both`
 * to grow/shrink it freely above that floor.
 * @param {HTMLElement} el
 * @param {number} minWidth
 * @param {number} minHeight
 * @returns {ResizeObserver}
 */
export function makeMinSizeClamped(el, minWidth, minHeight) {
    const observer = new ResizeObserver(() => {
        if (el.offsetWidth < minWidth) {
            el.style.width = `${minWidth}px`;
        }
        if (el.offsetHeight < minHeight) {
            el.style.height = `${minHeight}px`;
        }
    });
    observer.observe(el);
    return observer;
}
