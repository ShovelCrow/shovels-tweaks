const enrichers = CONFIG.TextEditor.enrichers ?? CONFIG.TextEditor;

const DIE_SIZES = ["d4", "d6", "d8", "d10", "d12"];

export function overrideRollEnrichers() {
    addDamageEnricherTooltip();
    inlineRollDieSize();
    damageEnricherDieSize();
}

function addDamageEnricherTooltip() {
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
    };
}

function damageEnricherDieSize() {
    const damageEnricher = _getRollEnricher5e();
    if (!damageEnricher) return;

    const prevEnricher = damageEnricher.enricher;
    damageEnricher.id = 'damageEnricher';

    damageEnricher.enricher = async function (match, options) {
        const formatted = await prevEnricher(match, options);
        let { type, config, label } = match.groups;
        if (['damage', 'heal', 'healing'].includes(type)) {
            const formula = formatted.dataset.formulas;
            if (formula) {
                const diePattern = /^[\+\-\d]*(d\d+)/gi;
                const die = diePattern.exec(formula)?.[1];
                if (die && DIE_SIZES.includes(die)) {
                    formatted.dataset.rollDie = die;
                }
            }
        }
        return formatted;
    }
}

function inlineRollDieSize() {
    const prevCreateInlineRoll = TextEditor._createInlineRoll;

    TextEditor._createInlineRoll = async function (match, rollData, options = {}) {
        const anchor = await prevCreateInlineRoll.apply(this, [match, rollData, options]);
        const formula = anchor?.dataset.formula;
        if (formula) {
            const diePattern = /^[\+\-\d]*(d\d+)/gi;
            const die = diePattern.exec(formula)?.[1];
            if (die && DIE_SIZES.includes(die)) {
                anchor.dataset.rollDie = die;
            }
        }
        return anchor;
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