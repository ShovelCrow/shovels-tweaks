import { MODULE_ID } from "../util/config.js";

const D20_TYPES = ["attack", "ability", "save", "skill", "tool", "death", "initiative"];
const STORED_ROLLTYPES = ["attack", "damage", "heal", "healing"];
const BASE_MODTYPES = ["ability", "prof", "base"];

export async function processChatMessage(message, html) {
    if (!message || !html) {
        return;
    }

    const rollTypes = _getMessageRollTypes(message);
    console.debug("Shovel's Tweaks | Message Rolls", message.rolls);

    if (!message.flags || Object.keys(message.flags).length === 0) {
        if (rollTypes) {
            let allStored = true;
            for (let rt of STORED_ROLLTYPES) {
                if (!rollTypes[rt]?.length) continue;
                let storedRolls = rollTypes[rt];
                const stored = await injectStored(message, storedRolls, rt, html);
                allStored = allStored && stored;
            }
            if (allStored) return;
        } else {
            return;
        }
    }

    const type = _getMessageType(message);
    if (!type) return;

    if (message.flags?.["rsr5e"] && !message.flags["rsr5e"].processed) {
        console.debug("Shovel's Tweaks | X Not processed by rsr5e");
        return;
    }

    if (game.dice3d && game.dice3d.isEnabled() && message._dice3danimating) {
        console.debug("Shovel's Tweaks | = Still animating");
        await game.dice3d.waitFor3DAnimationByMessageID(message.id);
    }

    await injectBreakdown(message, type, html);
}

async function injectStored(message, rolls, type, html) {
    if (!STORED_ROLLTYPES.includes(type)) return false;

    if (!rolls || !rolls.length || !rolls[0].options?.breakdown) return false;
    console.log(`Shovel's Tweaks | Injecting stored ${type} breakdown`);

    let modifiers;
    const first = rolls[0];
    modifiers = first.options.breakdown;

    await renderBreakdown(html, modifiers, type !== "attack");
    return true;
}

async function injectBreakdown(message, type, html) {
    switch (type) {
        case "attack":
            await injectAttackRoll(message, html);
            break;
        case "damage":
        case "healing":
            await injectDamageRolls(message, html);
            break;
        case "ability":
        case "save":
        case "skill":
        case "tool":
        case "death":
            await injectD20Roll(message, html, findCheckMods);
            break;
        case "initiative":
            await injectD20Roll(message, html, findInitMods);
            break;
        case "activity":
            if (message.flags?.["rsr5e"].renderAttack || message.flags?.["rsr5e"].renderAttack === false) {
                await injectAttackRoll(message, html);
            }
            if (message.flags?.["rsr5e"].renderDamage) {
                await injectDamageRolls(message, html);
            }
            if (message.isAuthor) await message.update({ "rolls": message.rolls })
            break;
        default:
            // console.log(`Shovel's Tweaks | No breakdown for ${type}`);
            return;
    }
}

async function injectAttackRoll(message, html) {
    let roll = message.rolls.find(r => r instanceof CONFIG.Dice.D20Roll);
    if (!roll) return;
    console.log("Shovel's Tweaks | Injecting attack breakdown");

    const actor = message.getAssociatedActor();
    const item = message.getAssociatedItem();
    const activity = message.getAssociatedActivity();

    const modifiers = findAttackMods(roll, message, actor, item, activity);
    await renderBreakdown(html, modifiers);

    roll.options.breakdown = modifiers;
}

async function injectD20Roll(message, html, modsHandler) {
    const roll = message.rolls.find(r => r instanceof CONFIG.Dice.D20Roll);
    if (!roll) return;
    console.log(`Shovel's Tweaks | Injecting d20 test breakdown`);

    const actor = message.getAssociatedActor();
    if (!actor) return;

    const modifiers = modsHandler(roll, message, actor);
    await renderBreakdown(html, modifiers);

    roll.options.breakdown = modifiers;
}

async function injectDamageRolls(message, html) {
    let rolls = message.rolls.filter(r => r instanceof CONFIG.Dice.DamageRoll);
    if (!rolls.length) return;
    console.log("Shovel's Tweaks | Injecting damage breakdown");

    const actor = message.getAssociatedActor();
    const item = message.getAssociatedItem();
    const activity = message.getAssociatedActivity();

    const modifiers = findDamageMods(rolls, message, actor, item, activity);

    await renderBreakdown(html, modifiers, true);

    const first = rolls[0];
    first.options.breakdown = modifiers;
}

async function renderBreakdown(html, modifiers, damageMode = false, selector = ".dice-roll .dice-result") {
    const mode = game.settings.get(MODULE_ID, (damageMode ? "toggleDamageBreakdown" : "toggleRollBreakdown"));
    if (mode <= 0) return;
    const visible = modifiers.filter(m => {
        const typeFilter = new RegExp(`${BASE_MODTYPES.join("|")}`, "gmi");
        const regex = typeFilter.exec(m.type);
        return mode >= 2 || !regex
    });

    const template = `modules/${MODULE_ID}/templates/breakdown-pills.hbs`;
    const modHTML = $(await renderTemplate(template, { modifiers: visible }));
    $(html).find(selector).append(modHTML);

    return modHTML;
}

function _getMessageType(message) {
    return message.flags.dnd5e?.messageType === "usage"
        ? "activity"
        : message.flags.dnd5e?.messageType === "roll"
            ? (message.flags.dnd5e?.roll?.type ?? null)
            : message.flags.core?.initiativeRoll
                ? "initiative"
                : null;
}

function _getMessageRollTypes(message) {
    const rolls = message.rolls
        .filter(r =>
            r?.options?.rollType
            && (r instanceof CONFIG.Dice.D20Roll || r instanceof CONFIG.Dice.DamageRoll))
        .reduce((obj, r) => {
            const type = r.options.rollType;
            obj[type] = obj[type] ?? [];
            obj[type].push(r);
            return obj;
        }, {});
    return rolls;
}

function findAttackMods(roll, msg, actor, item, activity) {
    const flags = msg.flags?.dnd5e ?? {};
    return _findMods(roll, actor, { activity: activity, item: item, flags: flags }, _findAttackCandidates);
}

function findCheckMods(roll, msg, actor) {
    const flags = msg.flags?.dnd5e?.roll ?? {};
    return _findMods(roll, actor, { flags: flags }, _findCheckCandidates);
}

function findInitMods(roll, msg, actor) {
    return _findMods(roll, actor, {}, _findInitCandidates);
}

function findDamageMods(rolls, msg, actor, item, activity) {
    const first = rolls[0];

    const terms = rolls.map((r, i) => {
        r.terms.forEach(t => t.rollIndex = i);
        return r.terms;
    }).flat();

    const flags = msg.flags?.dnd5e ?? {};
    flags.isCritical = first.options?.isCritical;
    flags.critical = first.options?.critical;

    const options = rolls.map(r => r.options);

    return _findMods(
        first, actor, {
        activity: activity, item: item,
        flags: flags, options: options,
        terms: terms, skip: true
    }, _findDamageCandidates
    );
}

function _findMods(roll, actor, data, candidatesHandler) {
    const subject = data?.activity ?? data?.item ?? actor;
    const rollData = subject.getRollData();

    const unlabeledTerms = [];
    const labeledMods = [];

    const isD20 = roll?.validD20Roll;
    const rollTerms = data.terms ?? (isD20 ? roll?.terms.slice(1) : roll?.terms) ?? [];
    rollTerms.forEach((term, i) => {
        if (!term) return;
        const termType = term.constructor.name;

        if (termType === "OperatorTerm") return;

        if (termType === "NumericTerm" || termType === "Die") {
            const termSource = _getTermSource(term);
            const prevOperator = rollTerms?.[i - 1] ?? "+";
            const operator = prevOperator?.operator === "-" ? -1 : 1;
            const sign = term.total * operator >= 0 ? 1 : -1;
            if (termSource && !data.skip) {
                labeledMods.push({
                    label: termSource.titleCase(),
                    term: term,
                    sign: sign,
                    value: _formatTerm(term, sign)
                });
                return;
            }
            unlabeledTerms.push({ term: term, sign: sign });
            return;
        }
    });

    const candidates = candidatesHandler(rollData, data).slice();

    const inference = _inferUnlabeledTerms(unlabeledTerms, candidates, rollData, data);
    const inferredMods = inference.inferred;
    const unknownMods = inference.unknown;

    const breakdown = inferredMods.concat(labeledMods, unknownMods);
    console.debug("Shovel's Tweaks | Breakdown:", breakdown);
    return breakdown;
}

function _inferUnlabeledTerms(unlabeledTerms, candidates, rollData, data) {
    const inferredMods = [];
    const unknownMods = [];
    const usedModTypes = {};
    unlabeledTerms.forEach(termData => {
        const term = termData.term;
        const sign = termData.sign;
        const mod = {
            ...termData,
            label: sign >= 0 ? "Bonus" : "Penalty",
            value: _formatTerm(term, sign),
            type: undefined
        };
        const children = []

        // Search for a match
        const match = candidates.find(cand => {
            if (cand.type && usedModTypes[cand.type]) {
                const used = usedModTypes[cand.type] ?? 0;
                if (used > (cand.index ?? 0)) return false;
            }
            return _matchFormulas(term, cand, rollData, sign);
        });

        if (match) {
            // Matched to candidate
            mod.label = match.label;
            mod.type = match.type;
            candidates.splice(candidates.indexOf(match), 1);
            if (match.type) {
                usedModTypes[match.type] = match.index || 1;
            }
            // Base damage
            if (match.base) {
                mod.value = match.base;
            }
            // Damage suffixes
            if (match.damage && match.damage.length) {
                mod.suffix = _getDamageType(termData.term, match, data);
            }
            // Add child modifiers
            if (match.sub && match.sub.length) {
                const sub = match.sub.map(s => {
                    return { ...s, value: _formatTerm(s.term) };
                })
                children.push(...sub);
            }
        } else if (term.total === 0) {
            // Ignore zeroes with no match
            return;
        }
        inferredMods.push(mod);
        inferredMods.push(...children);
        return;
    });
    // console.log("Shovel's Tweaks | Pre-Aggregate:", inferredMods.slice());
    const aggregateMods = inferredMods.reduce((arr, curr) => {
        return _aggregateMods(arr, curr);
    }, []).map((mod) => {
        if (mod.terms?.length && !mod.total)
            mod.value = new Roll(mod.value).formula;
        return mod;
    });

    return { inferred: aggregateMods, unknown: unknownMods };
}

function _aggregateMods(arr, curr) {
    if (!curr.type) {
        arr.push(curr);
        return arr;
    }

    const same = arr.find(m => m.type == curr.type && (curr.suffix == m.suffix || !curr.suffix));
    if (!same) {
        arr.push(curr);
        return arr;
    }

    const composite = {
        type: curr.type,
        label: same.label,
        suffix: same.suffix
    }
    composite.terms = same.terms ?? [];
    if (same.term) composite.terms.push(same.term);
    composite.terms.push(curr.term);

    const currTotal = curr.term.total;
    const total = currTotal + (same.total ?? same.term?.total);

    const isFlat = composite.terms.every(t => t.constructor.name === "NumericTerm");
    if (typeof (total) === "number" && isFlat) {
        composite.total = total;
        composite.value = _formatTerm({ total, expression: total });
    } else {
        composite.value = [same.value, curr.value].join("");
    }
    const index = arr.indexOf(same);
    arr.splice(index, 1, composite);

    return arr;
}

function _matchFormulas(term, cand, rollData, sign = 1) {
    const candRoll = new Roll(cand.term, rollData);

    const candRollForm = _normalizeFormula(candRoll.terms?.[0]?.expression);
    const candTerm = _normalizeFormula(cand.term);
    const termFormula = _normalizeFormula(term.formula, sign);
    const termExpress = _normalizeFormula(term.expression, sign);

    console.debug("Shovel's Tweaks | Match:\n%s, %s vs.\n%s, %s",
        candRollForm, candTerm, termFormula, termExpress
    );

    return candRollForm == termFormula || candRollForm == termExpress
        || candTerm == termFormula || candTerm == termExpress;
}

function _normalizeFormula(formula, sign = 0) {
    const first = formula.charAt(0);
    let clean = formula
    if (first == "+") clean = formula.slice(1);
    if (sign < 0 && first !== "-") {
        return `-${clean}`
    }
    return clean;
}

function _findAttackCandidates(rollData, { activity, item, flags }) {
    const candidates = [];
    const atkType = rollData?.activity?.attack.type.value === "ranged" ? "r" : "m";
    const atkClass = rollData?.activity?.attack.type.classification === "spell" ? "s" : "w";
    const atkKey = atkType ? `${atkType}${atkClass}ak` : null;
    const isFlat = rollData?.activity?.attack?.flat === true;

    if (!isFlat) {
        // Ability Mod
        if (typeof (rollData.mod) === "number") {
            const actAbility = activity?.ability ?? rollData?.activity?.ability ?? item?.ability;
            if (actAbility) {
                // Ability is accessible via activity/item data
                const abilityLabel = CONFIG.DND5E.abilities[actAbility].label;
                const abilityMod = rollData.abilities[actAbility].mod;
                candidates.push({ label: abilityLabel, term: `${abilityMod}`, type: "ability" });
            } else if (rollData.abilities) {
                // No activity/item data, try to estimate based on item type
                const itemType = flags?.item?.type ?? "";
                const weighted = _weighAttackAbilities(itemType, rollData)
                    .filter(a => a == rollData.mod);
                weighted.forEach(a => {
                    const aLabel = CONFIG.DND5E.abilities[a].label;
                    const aMod = rollData.abilities[a].mod;
                    candidates.push({ label: aLabel, term: `${aMod}`, type: "ability" });
                });
            }
        }
        // Proficiency
        if (rollData.item?.prof) {
            const profLabel = CONFIG.DND5E.proficiencyLevels[rollData.prof.multiplier];
            candidates.push({ label: profLabel, term: rollData.prof.term, type: "prof" });
        }
    }
    // Activity Bonus
    if (rollData.activity?.attack?.bonus) {
        const itemLabel = isFlat ? "Flat" : (rollData.item?.name ?? "Item");
        candidates.push({ "label": itemLabel, "term": rollData.activity.attack.bonus });
    }
    // Magic Item Bonus
    if (rollData.item?.magicalBonus) {
        candidates.push({ "label": "Magic", "term": `${rollData.item.magicalBonus}` });
    }
    // Active Effects
    const applicable = [];
    if (atkKey) {
        applicable.push(`system.bonuses.${atkKey}.attack`);
    } else {
        applicable.push(...[
            `system.bonuses.mwak.attack`,
            `system.bonuses.rwak.attack`,
            `system.bonuses.msak.attack`,
            `system.bonuses.rsak.attack`
        ]);
    }
    if (rollData.effects) {
        const effects = _findCandidateEffects(rollData, applicable, ["system.bonuses.All-Attacks"]);
        candidates.push(...effects);
    }
    return candidates;
}

function _weighAttackAbilities(itemType, rollData) {
    const abils = Object.keys(CONFIG.DND5E.abilities);
    abils.push(...abils.splice(abils.indexOf("con"), 1));

    const abilData = rollData.abilities ?? {};
    let weighted = [];

    if (itemType === "weapon") {
        const wak = ["str", "dex"].sort((a, b) => (abilData[b]?.value ?? 0) - (abilData[a]?.value ?? 0));
        weighted.push(...wak);
    }
    if (itemType === "spell") {
        const spellMod = rollData.attributes.spellcasting;
        const sak = ["cha", "int", "wis"].sort((a, b) => {
            const aWeight = (abilData[a]?.value ?? 0) + (spellMod == a ? 20 : 0);
            const bWeight = (abilData[b]?.value ?? 0) + (spellMod == b ? 20 : 0);
            return bWeight - aWeight;
        });
        weighted.push(...sak);
    }

    abils.forEach(a => { if (!weighted.includes(a)) weighted.push(a); });

    return weighted;
}

function _findCheckCandidates(rollData, { flags }) {
    const candidates = [];
    const rollType = flags?.type;
    const skill = flags?.skillId;
    const tool = flags?.toolId;
    const isSave = ["save", "death"].includes(rollType);
    const checkSave = isSave ? "save" : "check";

    const skillAbility = rollData.skills[skill]?.ability ?? CONFIG.DND5E.skills[skill]?.ability;
    const toolAbility = rollData.tools[tool]?.ability ?? CONFIG.DND5E.tools[tool]?.ability;
    const ability = flags?.ability ?? skillAbility ?? toolAbility ?? null;

    const abilityData = rollData.abilities?.[ability];

    // Ability Mod
    if (ability !== null) {
        const abilityLabel = CONFIG.DND5E.abilities[ability].label;
        const abilityMod = abilityData.mod;
        candidates.push({ "label": abilityLabel, "term": `${abilityMod}`, type: "ability" });
    }

    // Proficiency
    const rollTypes = {
        "save": abilityData.saveProf,
        "skill": rollData.skills[skill]?.prof,
        "tool": rollData.tools[tool]?.prof
    };
    let profData = { multiplier: 0, term: "0" };
    if (ability && !isSave) {
        const checkProf = abilityData.checkProf;
        if (checkProf.multiplier > profData.multiplier) profData = checkProf;
    }
    const roleTypeProf = rollTypes[rollType];
    if (roleTypeProf && roleTypeProf.multiplier > profData.multiplier) {
        profData = roleTypeProf;
    }
    if (profData.multiplier) {
        const profMod = profData.term;
        const profLabel = CONFIG.DND5E.proficiencyLevels[profData.multiplier];
        candidates.push({ "label": profLabel, "term": profMod, type: "prof" });
    }

    // Active Effects
    const applicable = [];
    applicable.push(`system.abilities.${ability}.bonuses.${checkSave}`);
    applicable.push(`system.bonuses.abilities.${checkSave}`);
    if (skill) applicable.push(`system.skills.${skill}.bonuses.check`);
    if (tool) applicable.push(`system.skills.${tool}.bonuses.check`);
    if (rollType == "death") applicable.push(`system.attributes.death.bonuses.save`);

    if (rollData.effects) {
        const effects = _findCandidateEffects(rollData, applicable);
        candidates.push(...effects);
    }
    return candidates;
}

function _findInitCandidates(rollData) {
    const candidates = [];

    const initData = rollData.attributes.init;
    const ability = initData?.ability || CONFIG.DND5E.defaultAbilities.initiative;

    // Ability Mod
    const abilityData = rollData.abilities?.[ability];
    if (ability !== null) {
        const abilityLabel = CONFIG.DND5E.abilities[ability].label;
        const abilityMod = abilityData.mod;
        candidates.push({ "label": abilityLabel, "term": `${abilityMod}`, type: "ability" });
    }

    // Proficiency
    const profData = initData?.prof;
    if (profData && profData.multiplier) {
        const profMod = profData.term;
        const profLabel = CONFIG.DND5E.proficiencyLevels[profData.multiplier];
        candidates.push({ "label": profLabel, "term": profMod, type: "prof" });
    }

    // Active Effects
    const applicable = [
        `system.attributes.init.bonus`,
        `system.abilities.${ability}.bonuses.check`
    ];
    if (rollData.effects) {
        const effects = _findCandidateEffects(rollData, applicable);
        candidates.push(...effects);
    }

    return candidates;
}

function _findDamageCandidates(rollData, { activity, item, flags }) {
    const candidates = [];
    console.debug("Shovel's Tweaks | DamageCandidate Data:", rollData, flags);
    if (!rollData) return [];

    const actType = rollData.activity?.type ?? flags.activity?.type ?? flags.roll?.type;
    const itemType = flags?.item?.type ?? "";

    const ability = activity?.ability ?? rollData.activity?.ability ?? item?.ability;

    const damageData = rollData.activity?.damage ?? rollData.activity?.healing;

    const scaling = flags.scaling ?? rollData.scaling?.increase ?? 0;
    const _baseCrit = flags?.isCritical ? 1 : 0;
    const _extraCrit = flags?.critical.bonusDice ?? 0;
    const critical = _baseCrit ? _baseCrit + _extraCrit : 0;
    const versatile = rollData.item?.damage?.versatile;

    // Damage Parts
    if (damageData) {
        const includeBase = damageData?.includeBase || false;
        const parts = damageData.parts ?? [damageData].slice();
        parts.forEach((part, index) => {
            const isBase = index == 0 || includeBase && part.base;
            const types = Array.from(part.types);
            const config = { index, isBase, scaling, critical, types };
            const dmgs = _findCandidateDamagePart(part, rollData, itemType, config);
            candidates.push(...dmgs);

            if (isBase && versatile) {
                const verPart = versatile;
                const vers = _findCandidateDamagePart(verPart, rollData, itemType,
                    { ...config, isVersatile: true });
                candidates.push(...vers);
            }
        });
    }

    // Ability Modifier
    if (ability) {
        const abilityLabel = CONFIG.DND5E.abilities[ability].label;
        const abilityMod = rollData.abilities[ability].mod;
        candidates.push({ label: abilityLabel, term: `${abilityMod}`, type: "ability" });
    }
    else if (rollData.abilities) {
        let weighted = _weighAttackAbilities(itemType, rollData);
        if (typeof (rollData.mod) === "number") {
            weighted = weighted.filter(a => a == rollData.mod);
        }
        weighted.forEach(a => {
            const aLabel = CONFIG.DND5E.abilities[a].label;
            const aMod = rollData.abilities[a].mod;
            candidates.push({ label: aLabel, term: `${aMod}`, type: "ability" });
        });
    }

    // Active Effects
    const applicable = [];
    const any = [];
    if (actType === "attack") {
        // Attacks
        const atkType = rollData.activity?.attack.type.value === "ranged" ? "r" : "m";
        const atkClass = rollData.activity?.attack.type.classification === "spell" ? "s" : "w";
        const atkKey = atkType ? `${atkType}${atkClass}ak` : null;
        if (atkKey) {
            applicable.push(`system.bonuses.${atkKey}.damage`);
        } else {
            applicable.push(...[
                `system.bonuses.mwak.damage`,
                `system.bonuses.rwak.damage`,
                `system.bonuses.msak.damage`,
                `system.bonuses.rsak.damage`
            ]);
        }
    } else {
        // Saves, Checks, and Damage
        if (actType) applicable.push(`system.bonuses.${actType}.damage`)
    }
    if (rollData.effects) {
        const effects = _findCandidateEffects(rollData, applicable, any);
        candidates.push(...effects);
    }

    // Magic Item Bonus
    if (rollData.item?.magicalBonus) {
        candidates.push({ "label": "Magic", "term": `${rollData.item.magicalBonus}` });
    }

    console.debug("Shovel's Tweaks | DamageCandidate:", candidates);
    return candidates;
}

function _findCandidateDamagePart(part, rollData, itemType, config) {
    const { index, isBase, types, scaling, critical, isVersatile } = config
    // Calculate extra scaling dice
    let fullNum = part.number;
    const scaled = scaling * (part.scaling?.number ?? 0);
    if (scaling && part.denomination) {
        fullNum = part.number + scaled;
    }
    // Calculate extra crit dice
    let critBonus = 0;
    if (critical) {
        critBonus = fullNum * critical;
        fullNum += critBonus;
    }

    // Reconstruct roll formula
    const die = fullNum && part.denomination ? `${fullNum}d${part.denomination}` : "";

    const existing = ["@mod", "@prof"];
    const existFilter = new RegExp(`(?:${existing.join("|")})`, "gi");
    const isExist = existFilter.exec(part.bonus);
    const bonus = !isExist ? part.bonus : "";

    const fullForm = [die, bonus].filter(p => p).join(" + ");
    const formula = part.custom?.enabled ? part.formula : fullForm;
    const fullRoll = new Roll(formula, rollData);

    // Split terms of reconstructed roll
    const dmgLabel = rollData?.item.name;
    const partMods = fullRoll.terms
        .filter(term => term.constructor.name !== "OperatorTerm")
        .map((term, j) => {
            const dmg = { label: dmgLabel, term: term.formula };

            // Determine label based on if base or not
            if (isBase) {
                const versLabel = CONFIG.DND5E.itemProperties.ver.label;
                // const baseLabel = isVersatile ? versLabel
                // : (itemType == "weapon" ? "TYPES.Item.weapon" : "Base");
                // const baseLabel = isVersatile ? versLabel : "";
                const baseLabel = "";
                dmg.label = game.i18n.localize(baseLabel);
                dmg.type = `base-${index}`;
                dmg.index = j;
                dmg.base = term.faces ? `${part.number ?? 1}d${term.faces}` : false;
            }
            if (term.faces) {
                dmg.damage = types;
            }

            // Scaling and Crits
            const children = [];
            if (term.faces && scaled) {
                const scaleRoll = new Roll(`${scaled}d${term.faces}`, rollData);
                const spellLevel = rollData.item?.level > 0 ? rollData?.item.level : 0;
                const spellLabel = CONFIG.DND5E.spellLevels[spellLevel];
                const scaleLabel = itemType == "spell" && spellLevel ? spellLabel : `+${scaling} Level`
                children.push({ label: scaleLabel, term: scaleRoll.terms[0] });
            }
            if (term.faces && critBonus) {
                const critRoll = new Roll(`${critBonus}d${term.faces}`, rollData);
                const critLabel = game.i18n.localize("DND5E.Critical");
                children.push({ label: critLabel, term: critRoll.terms[0] });
            }
            if (children.length) dmg.sub = children;

            return dmg;
        });
    return partMods;
}

function _findCandidateEffects(rollData, applicable, any = []) {
    const effects = rollData.effects.reduce((arr, ae) => {
        const change = ae.changes.find(ch => (ch.mode == 2 && applicable.includes(ch.key)) || any.includes(ch.key));
        if (change) {
            const useSource = ae.transfer && ae.sourceName && ae.name.match(/bonus/gmi); // Prefer unique names
            const aeLabel = useSource ? ae.sourceName : ae.name;
            const aeRoll = new Roll(change.value, rollData);
            const parts = aeRoll.terms.filter(term => term.constructor.name !== "OperatorTerm");
            const type = parts.length > 1 ? aeLabel : undefined;
            aeRoll.terms.forEach((t, i) => {
                const index = type ? i : undefined;
                if (t.constructor.name === "OperatorTerm") return;
                const prevOperator = aeRoll.terms?.[i - 1] ?? "+";
                const operator = prevOperator?.operator === "-" ? -1 : 1;
                const total = typeof (t.total) === "number" ? t.total : 1;
                const sign = total * operator >= 0 ? 1 : -1;
                const pTerm = _normalizeFormula(t.expression, sign)
                arr.push({ label: aeLabel, term: pTerm, type: type, index: index });
            });
        }
        // console.log("Shovel's Tweaks | AE:", arr);
        return arr;
    }, []);
    return effects;
}

function _getDamageType(term, match, data) {
    const dmgType = _getDamageId(term, match, data);
    return CONFIG.DND5E.damageTypes[dmgType]?.label
        ?? CONFIG.DND5E.healingTypes[dmgType]?.label ?? "damage"
}

function _getDamageId(term, match, data) {
    const opt = data.options?.[term.rollIndex] ?? {};
    const explicitType = opt?.type;
    if (explicitType) return explicitType;
    const matchedType = match.damage?.[0];
    return matchedType;
}

function _formatTerm(term, sign = 1) {
    const result = term.total;
    return sign >= 0 ? `+${term.expression}` : `-${term.expression}`;
}

function _getTermSource(term) {
    const candidates = [
        term?.flavor,
        term?.label,
        term?.options?.flavor,
        term?.options?.label,
        term?.options?.source,
        term?.options?.name,
        term?.roll?.options?.flavor,
        term?.roll?.options?.label,
        term?.roll?.options?.source,
        term?.roll?.options?.name
    ];

    for (const candidate of candidates) {
        if (typeof candidate !== "string") continue;
        const normalized = candidate.trim();
        if (normalized) return normalized;
    }

    return null;
}