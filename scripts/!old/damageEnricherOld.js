const enrichers = CONFIG.TextEditor.enrichers ?? CONFIG.TextEditor;

const DAMAGE_TYPE_ICONS = {
    acid: "flask",
    cold: "snowflake",
    fire: "fire",
    force: "sparkles",
    lightning: "bolt-lightning",
    necrotic: "skull",
    poison: "spider",
    psychic: "hamsa", // "brain",
    radiant: "star-christmas", // "sun",
    thunder: "signal-stream", // "waveform-lines",
    healing: "caduceus",
    temphp: "hourglass-half",
    // bludgeoning: "hammer",
    // piercing: "bow-arrow",
    // slashing: "sword",
}

const MODE = {
    diceIcon: false,
    damageTheme: false
}

let _savedEnrichers = {};

export function toggleDamageEnricherTheme(toggle = true) {
    MODE.damageTheme = toggle;
    if (MODE.damageTheme) {
        damageEnricherTheme();
    } else {
        _resetDamageEnr();
    }
}

export function toggleInlineRollIcons(toggle = true) {
    MODE.diceIcon = toggle;
    if (MODE.diceIcon) {
        overrideInlineRoll();
        if (!MODE.damageTheme) damageEnricherTheme();
    } else {
        _resetInlineRoll();
        if (!MODE.damageTheme) _resetDamageEnr();
    }
}

function damageEnricherTheme2() {
    const damageEnricher = _getRollEnricher5e();
    if (!damageEnricher) return;

    const prevEnricher = damageEnricher.enricher;
    damageEnricher.id = 'damageEnricher';

    damageEnricher.enricher = async function (match, options) {
        const formatted = await prevEnricher(match, options);
        let { type, config, label } = match.groups;
        if (['damage', 'heal', 'healing'].includes(type)) {
            const icon = formatted.querySelector('.roll-link i.fa-dice-d20');
            if (!icon) return formatted;

            const formula = formatted.dataset.formulas;

            // Dice size icons
            if (formula) {
                const diePattern = /^\d*(d\d+)/gi;
                const die = diePattern.exec(formula)?.[1];
                if (die && ["d4", "d6", "d8", "d10", "d12"].includes(die)) {
                    formatted.dataset.rollDie = die;
                }
            }
        }
        return formatted;
    }
}


function damageEnricherTheme() {
    const damageEnricher = _getRollEnricher5e();
    if (!damageEnricher) return;

    const prevEnricher = damageEnricher.enricher;
    damageEnricher.id = 'damageEnricher';
    _saveDamageEnr();

    damageEnricher.enricher = async function (match, options) {
        const formatted = await prevEnricher(match, options);
        let { type, config, label } = match.groups;
        if (['damage', 'heal', 'healing'].includes(type)) {
            const icon = formatted.querySelector('.roll-link i.fa-dice-d20');
            if (!icon) return formatted;

            const formula = formatted.dataset.formulas;
            const damageType = formatted.dataset.damageTypes;
            let newClass = "";

            // Dice size icons
            if (MODE.diceIcon && formula) {
                const diePattern = /^\d*(d\d+)/gi;
                const die = diePattern.exec(formula)?.[1];
                if (die && ["d4", "d6", "d8", "d10", "d12"].includes(die)) {
                    icon.classList.remove("fa-dice-d20");
                    newClass = `fa-dice-${die}`;
                }
            }
            // Damage theme icons (higher priority)
            if (MODE.damageTheme && damageType) {
                const iconClass = foundry.utils.getProperty(DAMAGE_TYPE_ICONS, damageType);
                if (iconClass) {
                    icon.classList.remove("fa-dice-d20");
                    newClass = `fa-${iconClass}`;
                }
            }
            if (newClass) icon.classList.add(newClass);
        }
        return formatted;
    }
}

function overrideInlineRoll2() {
    const prevCreateInlineRoll = TextEditor._createInlineRoll;

    TextEditor._createInlineRoll = async function (match, rollData, options = {}) {
        const anchor = await prevCreateInlineRoll.apply(this, [match, rollData, options]);
        const formula = anchor?.dataset.formula;
        const rollModes = ["roll", ...Object.values(CONST.DICE_ROLL_MODES)];
        if (!formula || !rollModes.includes(anchor.dataset.mode ?? "")) return anchor;

        let roll;
        try {
            roll = new Roll(formula)
        }
        catch { return anchor; }

        if (!roll) return anchor;
        const die = roll.dice.at(0);
        if (die && [4, 8, 6, 10, 12].includes(die.faces)) {
            anchor.dataset.rollDie = `d${die.faces}`;
        }
        return anchor;
    }
}

function overrideInlineRoll() {
    const prevCreateInlineRoll = TextEditor._createInlineRoll;
    _saveInlineRoll();

    TextEditor._createInlineRoll = async function (match, rollData, options = {}) {
        const anchor = await prevCreateInlineRoll.apply(this, [match, rollData, options]);
        const formula = anchor?.dataset.formula;
        const rollModes = ["roll", ...Object.values(CONST.DICE_ROLL_MODES)];
        if (!formula || !rollModes.includes(anchor.dataset.mode ?? "")) return anchor;

        let roll;
        try {
            roll = new Roll(formula)
        }
        catch { return anchor; }

        if (!roll) return anchor;
        const icon = _diceIcon(roll)
        const label = match[2] && match[2].length > 0 ? match[2] : roll.formula;

        anchor.innerHTML = `<i class="fas ${icon}" inert></i>${label}`;
        return anchor;
    }
}

function _diceIcon(roll) {
    const firstDice = roll.dice.at(0);
    const glyph = firstDice instanceof foundry.dice.terms.Die && [4, 8, 6, 10, 12].includes(firstDice.faces)
        ? `dice-d${firstDice.faces}` : "dice-d20";
    return `fa-${glyph}`;
}

function _saveDamageEnr() {
    const enricher = _getRollEnricher5e();
    if (enricher) _savedEnrichers.damage = enricher.enricher;
}

function _resetDamageEnr() {
    if (_savedEnrichers.length) {
        const enr = this.enrichers.find(e => e.id == 'damageEnricher');
        if (enr) enr.enricher = _savedEnrichers.damage;
    }
}

function _saveInlineRoll() {
    _savedEnrichers.inline = TextEditor._createInlineRoll;
}

function _resetInlineRoll() {
    if (_savedEnrichers.length) {
        TextEditor._createInlineRoll = _savedEnrichers.inline ?? TextEditor._createInlineRoll;
    }
}

function _getRollEnricher5e() {
    const stringNames = [
        "attack", "award", "check", "concentration", "damage", "heal", "healing", "item", "save", "skill", "tool"
    ];
    const pattern = new RegExp(`\\[\\[/(?<type>${stringNames.join("|")})(?<config> .*?)?]](?!])(?:{(?<label>[^}]+)})?`, "gi");
    const damageEnricher = enrichers.find(e => e.pattern.toString() == pattern.toString());
    return damageEnricher;
}

export function overrideDamageEnrTooltip() {
    const damageEnricher = _getRollEnricher5e();
    if (!damageEnricher) return;

    const prevEnricher = damageEnricher.enricher;
    damageEnricher.id = 'damageEnricher';

    damageEnricher.enricher = async function (match, options) {
        const formatted = await prevEnricher(match, options);
        let { type, config, label } = match.groups;
        if (['damage', 'heal', 'healing'].includes(type)) {
            formatted.dataset.tooltip = formatted.dataset.formulas ?? undefined;
        }
        return formatted;
    }

    overrideInlineRoll2();
    damageEnricherTheme2();
}