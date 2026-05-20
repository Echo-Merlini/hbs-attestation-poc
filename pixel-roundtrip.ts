/**
 * HBS pixel encoding round-trip test
 * Encodes ERC-8004 attestation as pixel art, decodes back, verifies valid: true
 */

import { encodeHbsImage, decodeHbsImage } from "./node_modules/@tunnckocore/hbs/dist/img/index.js";
import { writeFileSync } from "fs";
import { LOWSCRIPT } from "./glyphs-lowscript.js";

const ATTESTATION_URL =
  "https://gateway.ensub.org/agent/0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d/5/attestations?limit=1";

const ETHSCRIPTION_URL =
  "https://mainnet.api.calldata.space/ethscriptions/6169177/content";

// ── 1. Fetch live attestation ─────────────────────────────────────────────────
console.log("Fetching live attestation...");
const res = await fetch(ATTESTATION_URL);
const [raw] = (await res.json()) as any[];

const attestation = {
  registry:                   raw.registry,
  agent_id:                   raw.agent_id,
  action_type:                raw.action_type,
  raw_input_hash:             raw.raw_input_hash,
  sanitization_pipeline_hash: raw.sanitization_pipeline_hash,
  input_hash:                 raw.input_hash,
  output_hash:                raw.output_hash,
  manifest_hash:              raw.manifest_hash,
  l4_signature:               raw.l4_signature,
  l3_tx:                      raw.l3_tx,
  l3_chain:                   "84532",
  created_at:                 String(raw.created_at),
};

// ── 2. Fetch ethscription base image ──────────────────────────────────────────
console.log("Fetching ethscription base image...");
const baseImageBuffer = await fetch(ETHSCRIPTION_URL).then((r) => r.arrayBuffer());
const baseImage = Buffer.from(baseImageBuffer);
console.log(`Base image: ${baseImage.length} bytes`);

// ── 3. Encode as pixel art ────────────────────────────────────────────────────
// 32×32 ethscription source @ scale 1.0 → 1,024 char capacity
// Our attestation is ~817 chars — fits comfortably
console.log("\nEncoding as pixel art (bitmap: LOWSCRIPT, size: 2, gap: 3)...");
const encoded = await encodeHbsImage(attestation, {
  baseImage,
  bitmap: LOWSCRIPT,
  size: 2,
  gap: 3,
});

const imageBuffer = Buffer.from(encoded.image);
writeFileSync("attestation-pixel.png", imageBuffer);
console.log(
  `Written: attestation-pixel.png (${imageBuffer.length} bytes, ${encoded.outputWidth}×${encoded.outputHeight}px)`
);

// ── 4. Decode from pixels ─────────────────────────────────────────────────────
console.log("\nDecoding from pixel art...");
const result = await decodeHbsImage(encoded.image, {
  bitmap: LOWSCRIPT,
  size: 2,
  gap: 3,
});

console.log("\n── Decode result ────────────────────────────────────");
console.log(`Valid:     ${result.valid}`);
console.log(`Truncated: ${result.truncated}`);

if (result.valid && result.payload) {
  const p = result.payload as any;
  console.log("\n── Verified fields ──────────────────────────────────");
  console.log(`registry:     ${p.registry}`);
  console.log(`agent_id:     ${p.agent_id}`);
  console.log(`input_hash:   ${p.input_hash}`);
  console.log(`l3_chain:     ${p.l3_chain}`);
  console.log(`l4_signature: ${p.l4_signature?.slice(0, 30)}...`);

  const keysMatch =
    p.agent_id === attestation.agent_id &&
    p.input_hash === attestation.input_hash &&
    p.l3_chain === attestation.l3_chain &&
    p.registry === attestation.registry;

  console.log(`\nKeys intact: ${keysMatch ? "✅ yes" : "❌ no (underscores corrupted?)"}`);
  console.log("\n✅ Pixel round-trip complete — valid: true");
} else {
  console.error(`\n❌ Decode failed — valid: ${result.valid}, truncated: ${result.truncated}`);
  if (result.payload) {
    const p = result.payload as any;
    console.log("Recovered keys:", Object.keys(p));
  }
}
