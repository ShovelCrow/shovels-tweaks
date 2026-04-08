export const extendTokenGetData = function () {
    if (game.modules.get("lib-wrapper")?.active) {
        libWrapper.register("shovels-tweaks", "CONFIG.Token.prototypeSheetClass.prototype.getData", addItemBars, "MIXED");
        if (game.modules.get("barbrawl")?.active) {
            libWrapper.register("shovels-tweaks", "CONFIG.Token.prototypeSheetClass.prototype._render", extendBarbrawlConfig, "MIXED");
        }
    }
}

const addItemBars = async function (wrapped, options = {}) {
    const context = await wrapped(options);

    // Add bars for item uses
    const actor = this.object?.actor;
    const items = actor?.items.reduce((obj, i) => {
        const { per, max } = i.system.uses ?? {};
        if (per && max) obj[i.getRelativeUUID(actor)] = i.name;
        return obj;
    }, {}) ?? {};
    if (!foundry.utils.isEmpty(items)) {
        for (const [k,v] of Object.entries(items)) {
            context.barAttributes[game.i18n.localize("TOKEN.BarAttributes")].push(k);
        }
    }
    
    return context;
}

const extendBarbrawlConfig = async function(wrapped, ...args) {
    await wrapped(...args);
    const tokenConfig = this;
    const html = this.element;

    const actor = tokenConfig.actor;
    const resourceTab = html.find("div[data-tab='resources']");
    const selector = `optgroup[label='${game.i18n.localize("TOKEN.BarAttributes")}'] option`;

    resourceTab.find(selector).each((i,e) =>{
        const attribute = $(e).attr("value");
        if ( attribute?.startsWith(".") ) {
          const item = fromUuidSync(attribute, { relative: actor });
          $(e).text(`${item.name}`);
        }
    });
}