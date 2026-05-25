import { decodeHbsImage } from "./node_modules/@tunnckocore/hbs/dist/img/index.js";
import { HIGHSCRIPT } from "./node_modules/@tunnckocore/hbs/dist/bitmaps/highscript.js";

const image = await Bun.file("./moonbird-393-attest-encoded.png").arrayBuffer();
const decoded = await decodeHbsImage(image, {
  bitmap: HIGHSCRIPT,
});

console.log(decoded);
