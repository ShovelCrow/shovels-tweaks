import { MODULE_ID } from "../util/config.js";

let _saved = {};

export function overrideActivityChoice(toggle = true) {
    if (!game.modules.get("lib-wrapper")?.active) return;
    const prepareContext = 'game.dnd5e.applications.activity.ActivityChoiceDialog.prototype._prepareContext';
    const prepareActivityContext = 'game.dnd5e.applications.activity.ActivityChoiceDialog.prototype._prepareActivityContext';

    if (toggle) {
        // libWrapper.register(MODULE_ID, prepareContext, _prepareContext, "MIXED");
        libWrapper.register(MODULE_ID, prepareActivityContext, _prepareActivityContext, "MIXED");
        _saveTemplate();
        _overrideTemplate();
    } else {
        // libWrapper.unregister(MODULE_ID, prepareContext);
        libWrapper.unregister(MODULE_ID, prepareActivityContext);
        _resetTemplate();
    }
}


const _prepareContext = async function (wrapped, options) {
    const context = await wrapped(options);
    const charges = this.item.system.uses ?? {};
    if (charges.value && charges.max && !options.window.subtitle) {
        options.window.subtitle = `${charges.value} / ${charges.max}`;
    }
    return { ...context };
}

const _prepareActivityContext = function (wrapped, activity) {
    const context = wrapped(activity);
    const { labels, uses, item } = activity;

    const firstTarget = activity.consumption?.targets?.[0] ?? activity?.consume;
    const consumeId = firstTarget?.target;
    const consumeType = firstTarget?.type;
    let consume;

    switch (consumeType) {
        case "attribute":
            const parentId = consumeId.substr(0, consumeId.lastIndexOf("."));
            const tgtAttr = foundry.utils.getProperty(item.actor.system, parentId);
            if (tgtAttr) {
                consume = {
                    label: `${firstTarget.value} ${tgtAttr.label}`,
                    value: tgtAttr.value, max: tgtAttr.max
                };
            }
            break;
        case "charges":
        case "itemUses":
            if (!firstTarget) break;
            const tgtItem = !consumeId ? item : item.actor.items?.get(consumeId);
            if (tgtItem) {
                consume = { value: tgtItem.system.uses.value, max: tgtItem.system.uses.max };
                if (firstTarget.value > 1) consume.label = `(${firstTarget.value})`
            }
            break;
        case "spellSlots":
            if (!(parseInt(firstTarget.value) > 0)) break;
            const tgtSlot = foundry.utils.getProperty(item.actor.system, `spells.spell${consumeId}`);
            if (tgtSlot) {
                const slotLabel = game.i18n.format("DND5E.SpellLevelSlot", { level: tgtSlot.label, n: tgtSlot.value });
                consume = { label: slotLabel };
            }
            break;
        default: break;
    }

    return { ...context, labels, uses, consume };
}

function _overrideTemplate() {
    if (!game.dnd5e?.applications?.activity) return;
    const template = `modules/${MODULE_ID}/templates/activity-choices.hbs`;
    game.dnd5e.applications.activity.ActivityChoiceDialog.PARTS.activities.template = template;
}

function _saveTemplate() {
    _saved.template = game.dnd5e.applications.activity.ActivityChoiceDialog.PARTS.activities.template;
}

function _resetTemplate() {
    if (_saved.length) {
        game.dnd5e.applications.activity.ActivityChoiceDialog.PARTS.activities = _saved.template;
    }
}
