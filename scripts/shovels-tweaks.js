import { registerHooks, registerSettings, registerLibWrapper, registerEnrichers, applyCss, setupAPI } from "./util/config.js";

Hooks.once("init", () => {
    console.log("Shovel's Tweaks | Init");

    // Register Settings
    registerSettings();

    // Register Hooks
    registerHooks();

    // Override this before saving enrichers
    registerEnrichers();

    // Append Stylesheets
    applyCss();
});

Hooks.on("ready", () => {
    console.log("Shovel's Tweaks | Ready");

    // Register late wrappers
    registerLibWrapper();

    // Setup API
    setupAPI();
});