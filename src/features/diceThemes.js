export function addDamageTypeTags(config, dialog, message) {
    const newRolls = config.rolls;

    for (let roll of newRolls) {
        // Select only [flavor tags]
        const regex = /([0-9]*d[0-9]+)(?=[\+\-\*\\\s]+|$)/g;

        for (let part of newRolls.parts) {
            let type = roll.type;
            type = (type === "bludgeoning" || type === "piercing" || type === "slashing") ? "" : type;
            if (!type) continue;

            part = part.replace(regex, `$&[${type}]`);
        }
    }

    config.rolls = newRolls;
}

export function addDamageTypeTagsV2(rolls, data) {
    const newRolls = rolls;

    for (let roll of newRolls) {
        let type = roll.options.type;
        type = (type === "bludgeoning" || type === "piercing" || type === "slashing") ? "" : type;
        if (!type) continue;

        for (let die of roll.dice) {
            die.options.flavor = type;
        }
    }

    rolls = newRolls;
}