import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

export const MODULE_NAME = 'videoPlayback';

export const defaultSettings = Object.freeze({
    defaultVolume: 80,
    defaultSpeed: 1,
    defaultLoop: false,
    snapEnabled: true,
    snapThreshold: 14,
});

/**
 * Returns the extension's persisted settings object, creating/backfilling it with defaults as needed.
 * @returns {typeof defaultSettings}
 */
export function getSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = structuredClone(defaultSettings);
    }
    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings[MODULE_NAME][key] === undefined) {
            extension_settings[MODULE_NAME][key] = defaultSettings[key];
        }
    }
    return extension_settings[MODULE_NAME];
}

export function persistSettings() {
    saveSettingsDebounced();
}
