/** The production origin, for absolute URLs in share previews. */
export const SITE_URL = "https://focosbr.vercel.app";
export const SITE_NAME = "FocosBR";

export const absoluteUrl = (path: string) => new URL(path, SITE_URL).href;
