export {};

// jsdom does not lay pages out, so it has no scrollIntoView. Every browser the app supports does.
if (typeof Element !== 'undefined') Element.prototype.scrollIntoView ??= () => {};
