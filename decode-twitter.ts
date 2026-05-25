import { decodeHbsImage } from "./node_modules/@tunnckocore/hbs/dist/img/index.js";
import { HIGHSCRIPT } from "./node_modules/@tunnckocore/hbs/dist/bitmaps/highscript.js";

const downloadedOne = await Bun.file(
  "./moonbird-393-downloaded-from-pbs-media-HIzH9WjWkAEM4Y7.png",
).arrayBuffer();
const downloadedTwo = await Bun.file(
  "./moonbird-393-downloaded-from-post-HIzH9WjWkAEM4Y7.png",
).arrayBuffer();

console.log("── PBS media (CDN) ─────────────────────────────────");
const decodedOne = await decodeHbsImage(downloadedOne, { bitmap: HIGHSCRIPT });
console.log(decodedOne);

console.log("\n── Downloaded from post ────────────────────────────");
const decodedTwo = await decodeHbsImage(downloadedTwo, { bitmap: HIGHSCRIPT });
console.log(decodedTwo);
