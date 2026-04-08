import { MODULE_ID } from "../util/config";

function replaceEffectDurationLabel(wrapped, ...args) {
    const duration = wrapped(args);

    if (duration.type == "seconds") {
        let newLabel = duration.label;
        let seconds = duration.remaining;

        let minutes = Math.floor(seconds / 60);
        newLabel = minutes > 0 && seconds > 60 ? `${minutes} ${game.i18n.localize("DND5E.TimeMinute")}` : newLabel;

        let hours = Math.floor(minutes / 60);
        newLabel = hours > 0 && minutes > 60 ? `${hours} ${game.i18n.localize("DND5E.TimeHour")}` : newLabel;

        duration.label = newLabel;
    }

    return duration;
}

export function overrideEffectLabel(value = true) {
    const target = "CONFIG.ActiveEffect.documentClass.prototype._prepareDuration";
    if (value) {
        libWrapper.register(MODULE_ID, target, replaceEffectDurationLabel, "MIXED");
    } else {
        libWrapper.unregister(MODULE_ID, target);
    }
}