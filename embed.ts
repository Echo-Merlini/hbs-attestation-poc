/**
 * HBS Attestation POC
 * Fetches a live ERC-8004 agent attestation, encodes it as HBS,
 * embeds it in a PNG iTXt chunk, then decodes and verifies.
 */

import { encodeHbs, decodeHbs } from "./node_modules/@tunnckocore/hbs/dist/index.js";
import extract from "png-chunks-extract";
import encode from "png-chunks-encode";
import { readFileSync, writeFileSync } from "fs";
import { PNG } from "pngjs";

const ATTESTATION_URL =
  "https://gateway.ensub.org/agent/0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d/5/attestations?limit=1";

// iTXt chunk: keyword\0[compression_flag][compression_method][language]\0[translated_keyword]\0[text_utf8]
function encodeITXt(keyword: string, text: string): { name: string; data: Buffer } {
  const data = Buffer.concat([
    Buffer.from(keyword, "latin1"),
    Buffer.from([0, 0, 0, 0, 0]), // null, compression_flag=0, compression_method=0, lang null, translated_keyword null
    Buffer.from(text, "utf8"),
  ]);
  return { name: "iTXt", data };
}

function decodeITXt(raw: Uint8Array): { keyword: string; text: string } {
  const buf = Buffer.from(raw);
  const keyEnd = buf.indexOf(0);
  const keyword = buf.subarray(0, keyEnd).toString("latin1");
  // skip: null + compression_flag + compression_method + language_tag null + translated_keyword null = 5 bytes
  const text = buf.subarray(keyEnd + 5).toString("utf8");
  return { keyword, text };
}

// ── 1. Fetch live attestation ─────────────────────────────────────────────────
console.log("Fetching live attestation...");
const res  = await fetch(ATTESTATION_URL);
const [raw] = await res.json() as any[];

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

console.log("\n── Attestation fields ──────────────────────────────");
console.log(JSON.stringify(attestation, null, 2));

// ── 2. Encode as HBS ─────────────────────────────────────────────────────────
console.log("\nEncoding as HBS...");
const encoded = encodeHbs(attestation);
console.log("\n── HBS encoded ─────────────────────────────────────");
console.log(encoded.slice(0, 120) + "...");
console.log(`Total length: ${encoded.length} chars`);

// ── 3. Create a valid base PNG ────────────────────────────────────────────────
console.log("\nCreating base PNG...");
const pngBuffer: Buffer = await new Promise((resolve) => {
  const png = new PNG({ width: 1, height: 1 });
  png.data[0] = 0; png.data[1] = 0; png.data[2] = 0; png.data[3] = 255;
  const chunks: Buffer[] = [];
  const stream = png.pack();
  stream.on("data", (c: Buffer) => chunks.push(c));
  stream.on("end", () => resolve(Buffer.concat(chunks)));
});
console.log(`Base PNG: ${pngBuffer.length} bytes`);

// ── 4. Embed HBS into PNG iTXt chunk ─────────────────────────────────────────
console.log("\nEmbedding HBS into PNG iTXt chunk...");
const chunks  = extract(pngBuffer);
const keyword = "erc8004:attestation";

const iend = chunks.pop()!;
chunks.push(encodeITXt(keyword, encoded));
chunks.push(iend);

const outputPng = Buffer.from(encode(chunks));
writeFileSync("attestation.png", outputPng);
console.log(`Written: attestation.png (${outputPng.length} bytes)`);

// ── 5. Decode and verify ──────────────────────────────────────────────────────
console.log("\nDecoding and verifying...");
const readBack  = readFileSync("attestation.png");
const extracted = extract(readBack);

const attestChunk = extracted.find((c: any) => c.name === "iTXt");

if (!attestChunk) {
  console.error("❌ No attestation chunk found in PNG");
  process.exit(1);
}

const { keyword: kw, text } = decodeITXt(attestChunk.data);
const result = decodeHbs(text);

console.log("\n── Decoded result ───────────────────────────────────");
console.log(`Keyword:   ${kw}`);
console.log(`Valid:     ${result.valid}`);
console.log(`Truncated: ${result.truncated}`);

if (result.valid && result.payload) {
  console.log("\n── Verified fields ──────────────────────────────────");
  const p = result.payload as any;
  console.log(`registry:     ${p.registry}`);
  console.log(`agent_id:     ${p.agent_id}`);
  console.log(`input_hash:   ${p.input_hash}`);
  console.log(`l4_signature: ${p.l4_signature?.slice(0, 30)}...`);
  console.log(`l3_tx:        ${p.l3_tx}`);
  console.log(`l3_chain:     ${p.l3_chain}`);

  const isIdentity = p.input_hash === p.raw_input_hash;
  console.log(`\nSanitization: ${isIdentity ? "identity (no transformation)" : "transformed"}`);
  console.log(`Sentinel:     ${p.sanitization_pipeline_hash?.slice(0, 16)}...`);

  console.log("\n✅ Attestation embedded, extracted, and verified.");
} else {
  console.error("❌ HBS verification failed");
}
