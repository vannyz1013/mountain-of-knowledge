/** Landscape phones have no room for words under the cake, so they sit beside it. Matches scenes.css. */
export const isShortScreen = (): boolean => window.matchMedia("(max-height: 520px)").matches;
