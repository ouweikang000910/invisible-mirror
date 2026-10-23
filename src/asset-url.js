import { assetPath } from './asset-path.mjs';
export const assetUrl = path => new URL(assetPath(path, import.meta.env.BASE_URL), window.location.origin).href;
