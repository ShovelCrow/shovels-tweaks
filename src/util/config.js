import { toggleSheetSize } from "../features/compactSheet.js"
import { overrideRollEnrichers } from "../features/damageEnrichers";
import { addDamageTypeTagsV2 } from "../features/diceThemes";
import { overrideEffectLabel } from "../features/effectDuration.js";
import { updateItemFromCompendium } from "../features/updateFromCompedium.js";

export const MODULE_ID = "shovels-tweaks";

export const CSS = {
    COMPACT_SHEET: {
        id: "shovelCompactSheet",
        href: "modules/shovels-tweaks/styles/compact-sheet.css"
    },
    COMPACT_CHAT: {
        id: "shovelCompactChat",
        href: "modules/shovels-tweaks/styles/compact-chat.css"
    },
    ROLL_LINK: {
        id: "shovelRollLinkThemes",
        href: "modules/shovels-tweaks/styles/roll-link.css"
    },
    ROLL_LINK_ICON: {
        id: "shovelRollLinkIcons",
        href: "modules/shovels-tweaks/styles/roll-link-icon.css"
    },
    ROLL_LINK_DICE: {
        id: "shovelRollLinkDice",
        href: "modules/shovels-tweaks/styles/roll-link-dice.css"
    },
    FLAVOR_HIDE: {
        id: "shovelFlavorHide",
        href: "modules/shovels-tweaks/styles/flavor-hide.css"
    },
}

export const API = {
    updateItemFromCompendium
}

// Register Settings
export function registerSettings() {
    // Dice Themes - Toggle
    game.settings.register(MODULE_ID, "toggleDiceThemes", {
        name: "3D Damage Dice Themes",
        hint: "Automatically add damage tags for themed damage dice. (Dice So Nice!)",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        onChange: (value) => {
            if (value) Hooks.on("dnd5e.rollDamageV2", addDamageTypeTagsV2);
            else Hooks.off("dnd5e.rollDamageV2", addDamageTypeTagsV2);
        }
    });

    // Compact Sheet - Toggle
    game.settings.register(MODULE_ID, "toggleCompactSheet", {
        name: "Compact Character Sheet",
        hint: "Enable a more compact character sheet.",
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        onChange: value => {
            _toggleCss(CSS.COMPACT_SHEET, value);
            toggleSheetSize(value);
        }
    });

    // Compact Chat - Toggle
    game.settings.register(MODULE_ID, "toggleCompactChat", {
        name: "Compact Chat",
        hint: "Enable more compact chat cards.",
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        onChange: value => _toggleCss(CSS.COMPACT_CHAT, value)
    });

    // Effect Duration - Toggle
    game.settings.register(MODULE_ID, "toggleEffectDuration", {
        name: "Active Effect Duration Labels",
        hint: "Displays effect durations in minutes and hours.",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        onChange: value => overrideEffectLabel(value)
    });

    // Dice Icons - Toggle
    game.settings.register(MODULE_ID, "toggleInlineRollIcons", {
        name: "Inline Roll Icons",
        hint: "Changes the icons of inline rolls to their respective dice.",
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        onChange: (value) => {
            const prioTheme = value && game.settings.get(MODULE_ID, "toggleRollLinkThemes") >= 2
            if (prioTheme) _toggleCss(CSS.ROLL_LINK_ICON, false);
            _toggleCss(CSS.ROLL_LINK_DICE, value);
            if (prioTheme) _toggleCss(CSS.ROLL_LINK_ICON);
        }
    });

    // Damage Enrichers - Toggle
    game.settings.register(MODULE_ID, "toggleRollLinkThemes", {
        name: "Damage Enricher Themes",
        hint: "Apply damage colors and/or icons on damage enrichers.",
        scope: "client",
        config: true,
        type: Number,
        choices: {
            0: "Disabled",
            1: "Themed colors only",
            2: "Colors and icons"
        },
        default: 0,
        onChange: (value) => {
            _toggleCss(CSS.ROLL_LINK, value);
            _toggleCss(CSS.ROLL_LINK_ICON, value >= 2);
        }
    });

    // Healing Label - Toggle
    game.settings.register(MODULE_ID, "healingHitPoints", {
        name: "Healing Label",
        hint: "Replaces \"healing\" label with \"hit points\".",
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        requiresReload: true
    });

    // Update From Compendia - Compedia List
    game.settings.register(MODULE_ID, "updateCompendia", {
        name: "Registered Compendia",
        hint: "Compendia to update from, separated with commas (,).",
        scope: "world",
        config: true,
        type: String
    });
}

// Register Hooks
export function registerHooks() {
    // Dice Themes - Add Damage Tags
    if (game.settings.get(MODULE_ID, "toggleDiceThemes")) {
        Hooks.on("dnd5e.rollDamageV2", addDamageTypeTagsV2);
    }
    // Dice Themes - Override Label
    if (game.settings.get(MODULE_ID, "toggleEffectDuration")) {
        overrideEffectLabel();
    }

    // Update from Compedia - Add header buttons on item sheets
    Hooks.on("getItemSheetHeaderButtons", (app, buttons) => {
        if (!game.user.isGM) return;
        buttons.unshift({
            label: 'Update From Compedium',
            icon: 'fas fa-rotate',
            onclick: () => {
                updateItemFromCompendium(app.document);
            }
        });
    });
    Hooks.once("tidy5e-sheet.ready", (api) => {
        if (!game.user.isGM) return;
        api.registerItemHeaderControls?.({
            controls: [{
                label: "Update From Compedium",
                icon: 'fas fa-rotate',
                async onClickAction() {
                    updateItemFromCompendium(this.document);
                }
            }]
        });
    });
}

// Register LibWrapper Overrides before onReady
export function registerEnrichers() {
    // Damage Enrichers
    overrideRollEnrichers();

    // Standard CONFIG mods
    if (game.settings.get(MODULE_ID, "healingHitPoints")) {
        CONFIG.DND5E.healingTypes.healing.label = "Hit Points";
    }
}

// Append CSS stylesheets
export function applyCss() {
    if (game.settings.get(MODULE_ID, "toggleCompactSheet")) {
        _toggleCss(CSS.COMPACT_SHEET);
    }
    if (game.settings.get(MODULE_ID, "toggleCompactChat")) {
        _toggleCss(CSS.COMPACT_CHAT);
    }
    if (game.settings.get(MODULE_ID, "toggleInlineRollIcons")) {
        _toggleCss(CSS.ROLL_LINK_DICE);
    }
    
    // Damage Enrichers - Theme Logic
    const rollLinkTheme = game.settings.get(MODULE_ID, "toggleRollLinkThemes");
    if (rollLinkTheme) {
        _toggleCss(CSS.ROLL_LINK);
        _toggleCss(CSS.ROLL_LINK_ICON, rollLinkTheme >= 2);
    }

    // Default Tweak - Hide flavor text
     _toggleCss(CSS.FLAVOR_HIDE);
}

// Register LibWrapper Overrides during onReady
export function registerLibWrapper() {
    // Compact Sheet Resize Override
    if (game.settings.get(MODULE_ID, "toggleCompactSheet")) {
        toggleSheetSize();
    }
    // Default Tweak
    _overrideEnrichRollTooltip();
    _overrideScaleAdvancementConfigPrepareContext();
}

export function setupAPI() {
    const data = game.modules?.get(MODULE_ID);
    data.api = API;
    globalThis.shovelsTweaks = game.modules?.get(MODULE_ID)?.api;
}

// ============================================================================
// Helpers
// ============================================================================

// Appends or removes a stylesheet
function _toggleCss(css, value = true) {
    const style = $(`#${css.id}`);
    if (value) {
        if (style.length) return;
        $("head").append(`<link id='${css.id}' href='${css.href}' rel='stylesheet' type='text/css' media='all'>`);
    } else {
        style.remove();
    }
}

// ============================================================================
// Helpers: Default Tweaks
// ============================================================================

// Default Tweak - Allow negative numbers in damage cards
export function _overrideEnrichRollTooltip() {
    const target = 'CONFIG.ChatMessage.documentClass.prototype._enrichRollTooltip';
    libWrapper.register(
        MODULE_ID,
        target,
        function (roll, html) {
            const constantSimplified = dnd5e.dice.simplifyRollFormula(roll._formula, { deterministic: true });
            const constant = Number(constantSimplified?.replace(/ /g, ''));
            if (!constant) return;
            const sign = constant < 0 ? "-" : "+";
            const part = document.createElement("section");
            part.classList.add("tooltip-part", "constant");
            part.innerHTML = `
            <div class="dice">
                <ol class="dice-rolls"></ol>
                <div class="total">
                <span class="value"><span class="sign">${sign}</span>${Math.abs(constant)}</span>
                </div>
            </div>
            `;
            html.appendChild(part);
        }, "OVERRIDE"
    );
}

// Default Tweak - Properly display units in scaling advancements
export function _overrideScaleAdvancementConfigPrepareContext() {
    const target = "CONFIG.DND5E.advancementTypes.ScaleValue.documentClass.metadata.apps.config.prototype._prepareContext";
    libWrapper.register(
        MODULE_ID,
        target,
        async function (wrapped, ...args) {
            const context = await wrapped(...args);
            context.distanceOptions = Object.entries(CONFIG.DND5E.movementUnits).map(([value, { label }]) => ({ value, label }));
            return context;
        }, "MIXED"
    );
}

