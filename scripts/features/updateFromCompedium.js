import { MODULE_ID } from "../util/config.js";

// Update a single item
export async function updateItemFromCompendium(item) {
    const packsIds = game.settings.get(MODULE_ID, "updateCompendia").split(",").map(c => c.trim());
    const docs = (await Promise.all(packsIds.map(async p => await game.packs.get(p).getDocuments()))).flat();

    const updated = docs.find(doc => {
        return doc.system.identifier === item.system.identifier
            && doc.type === item.type
            && item?.flags?.plutonium?.page !== "monsterAction";
    });
    if (!updated) return ui.notifications.info(`Update From Compendium | No updates from compendia.`);
    item.update(getItemUpdate(item, updated));
    ui.notifications.info(`Update From Compendium | Updated item: ${item.name} ${item.name !== updated.name ? `(${updated.name})` : ""}`);
}

// Get an update object from compedium source.
export function getItemUpdate(item, updated) {
    const currentSource = item.toObject();
    const latestSource = updated.toObject();
    let update = {
        _id: item.id,
        img: latestSource.img,
        system: foundry.utils.deepClone(latestSource.system),
        effects: foundry.utils.deepClone(latestSource.effects)
    }

    // Preserve enchants
    const enchants = currentSource.effects.filter(effect => {
        return item.allApplicableEffects().some(applied => effect._id === applied._id);
    });
    // Preserve item quantity/equip/preparation/uses
    foundry.utils.mergeObject(update, {
        "system.attuned": currentSource.system.attuned,
        "system.preparation": currentSource.system.preparation,
        "system.sourceClass": currentSource.system.sourceClass,
        "system.effects": enchants,
        "_stats.compendiumSource": updated.uuid
    });
    if (item.type != "spell") {
        foundry.utils.mergeObject(update, {
            "system.container": currentSource.system.container,
            "system.equipped": currentSource.system.equipped,
            "system.quantity": currentSource.system.quantity,
            "system.uses.spent": currentSource.system.uses?.spent
        });
    } else {
        foundry.utils.mergeObject(update, {
            "system.container": currentSource.system.container,
            "system.equipped": currentSource.system.equipped,
            "system.uses": currentSource.system.uses
        });
    }

    return update;
}