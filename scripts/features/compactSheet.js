import { MODULE_ID } from "../util/config.js";

const SHEET_SIZES = {
    char: {
        height: 750,
        width: 750
    },
    npc: {
        height: 675,
        width: 650
    }
}
let savedDefaults = {
    char: null,
    npc: null
}

// Compact Sheet - Toggles Sheet Size
export function toggleSheetSize(value = true) {
    const isV5 = foundry.utils.isNewerVersion(dnd5e.version ?? "", "5");
    const sheetChar = isV5 ? "CharacterActorSheet" : "ActorSheet5eCharacter2";
    const sheetNpc = isV5 ? "NPCActorSheet" : "ActorSheet5eNPC2";
    const defaultOptions = isV5 ? "DEFAULT_OPTIONS" : "defaultOptions";

    if (!game.modules.get("lib-wrapper")?.active) return;
    const optionsChar = `CONFIG.Actor.sheetClasses.character["dnd5e.${sheetChar}"].cls.${defaultOptions}`;
    const optionsNpc = `CONFIG.Actor.sheetClasses.npc["dnd5e.${sheetNpc}"].cls.${defaultOptions}`;
    if (value) {
        // libWrapper.register(MODULE_ID, optionsChar, _getWrapper(SHEET_SIZES.CHAR), "MIXED");
        // libWrapper.register(MODULE_ID, optionsNpc, _getWrapper(SHEET_SIZES.NPC), "MIXED");

        const char = CONFIG.Actor.sheetClasses.character[`dnd5e.${sheetChar}`].cls[`${defaultOptions}`];
        const npc = CONFIG.Actor.sheetClasses.npc[`dnd5e.${sheetNpc}`].cls[`${defaultOptions}`];

        saveDefaults(char, npc);

        char.position.height = SHEET_SIZES.char.height;
        char.position.width = SHEET_SIZES.char.width;

        npc.position.height = SHEET_SIZES.npc.height;
        npc.position.width = SHEET_SIZES.npc.width;

    } else {
        // libWrapper.unregister(MODULE_ID, optionsChar);
        // libWrapper.unregister(MODULE_ID, optionsNpc);

        char.position.height = savedDefaults.char.height;
        char.position.width = savedDefaults.char.width;

        npc.position.height = savedDefaults.npc.height;
        npc.position.width = savedDefaults.npc.width;
    }
}

// Returns wrapper that sets appropriate defaults
function _getWrapper(sheetClass) {
    let func = function (wrapped, ...args) {
        let defaultOptions = wrapped(...args);
        if (defaultOptions.position) {
            defaultOptions.position.height = sheetClass.height;
            defaultOptions.position.width = sheetClass.width;
        } else {
            defaultOptions.height = sheetClass.height;
            defaultOptions.width = sheetClass.width;
        }
        return defaultOptions;
    }
    return func;
}

function saveDefaults(char, npc) {
    if (!saveDefaults.char) {
        savedDefaults.char = { height: char.position.height, width: char.position.width };
    }
    if (!saveDefaults.npc) {
        savedDefaults.npc = { height: npc.position.height, width: npc.position.width };
    }
}