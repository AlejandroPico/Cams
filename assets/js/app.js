import { CAMERAS, CATALOG_META } from "./data/cameras.js";
import { initUI } from "./modules/ui.js";

console.info(`Cams ${CATALOG_META.version}`, CATALOG_META);
initUI(CAMERAS);
