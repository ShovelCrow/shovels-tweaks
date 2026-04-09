import { MODULE_ID } from "../util/config.js";

const SHEET_SIZES = {
    CHAR: {
        height: 750,
        width: 750
    },
    NPC: {
        height: 675,
        width: 650
    }
}

// Compact Sheet - Toggles Sheet Size
export function toggleSheetSize(value = true) {
    if (!game.modules.get("lib-wrapper")?.active) return;
    const optionsChar = 'CONFIG.Actor.sheetClasses.character["dnd5e.ActorSheet5eCharacter2"].cls.defaultOptions';
    const optionsNpc = 'CONFIG.Actor.sheetClasses.npc["dnd5e.ActorSheet5eNPC2"].cls.defaultOptions';
    if (value) {
        libWrapper.register(MODULE_ID, optionsChar, _getWrapper(SHEET_SIZES.CHAR), "MIXED");
        libWrapper.register(MODULE_ID, optionsNpc, _getWrapper(SHEET_SIZES.NPC), "MIXED");
    } else {
        libWrapper.unregister(MODULE_ID, optionsChar);
        libWrapper.unregister(MODULE_ID, optionsNpc);
    }
}

// Returns wrapper that sets appropriate defaults
function _getWrapper(sheetClass) {
    let func = function (wrapped, ...args) {
        let defaultOptions = wrapped(...args);
        defaultOptions.height = sheetClass.height;
        defaultOptions.width = sheetClass.width;
        return defaultOptions;
    }
    return func;
}