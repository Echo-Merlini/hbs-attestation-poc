# HBS Attestation POC

Reference implementation for a verifiable AI inference stack built on Ethereum — ERC-8004 agent identity, ERC-8263 on-chain commitment, OCP trustless verification, and HBS pixel provenance as the persistence layer.

The attestation is encoded as pixel art directly into a carrier image using the HBS encoding primitive. The image IS the proof — it survives Twitter CDN roundtrips, platform re-encoding, and partial corruption.

---

## The Stack

| Layer | Standard | Job |
|---|---|---|
| Identity | ERC-8004 | Who is the agent? (`registry.getAgentWallet(agentId)`) |
| Commitment | ERC-8263 | What did they commit on-chain? (`anchorProof`) |
| Verification | OCP | Can anyone verify it independently? (`record(input_hash)`) |
| Persistence | HBS pixel provenance | How does the proof travel with the image forever? |

---

## Live Endpoints

All read operations are public, no authentication required.

| Resource | URL |
|---|---|
| Attestation log | `GET https://gateway.ensub.org/agent/0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d/5/attestations?limit=1` |
| Agent card (ENSIP-27) | `GET https://gateway.ensub.org/agent/0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d/5/.well-known/agent.json` |
| ERC-8004 tokenURI | `GET https://gateway.ensub.org/agent/0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d/5` |
| Provenance verifier | `GET https://gateway.ensub.org/verify/input-provenance?rawInputHash=...&sanitizationPipelineHash=...&inputHash=...` |

---

## Independent Verification (no gateway required)

```
1. GET /attestations → retrieve input_hash, l4_signature, l3_tx
2. Call registry.getAgentWallet(5) on Ethereum mainnet → signerAddress
3. Recover EIP-712 signer from l4_signature over InferenceAttestation struct → recoveredAddress
4. Assert recoveredAddress == signerAddress
5. Query Base Sepolia (chain 84532) tx 0xc3aeb16d... → confirm Recorded(input_hash) event at block 41731493
```

Steps 2–5 require only a public RPC. No API key, no gateway, no trust assumption beyond the registry contract.

---

## Scripts

Requires [Bun](https://bun.sh).

```bash
bun install
```

### `embed.ts`
Fetches the live attestation from the gateway, encodes it as HBS, embeds it in a PNG iTXt chunk, then decodes and verifies.

```bash
bun run embed.ts
```

### `decode-attest.ts`
Decodes the HIGHSCRIPT pixel-encoded carrier image (`moonbird-393-attest-encoded.png`) and prints the full attestation.

```bash
bun run decode-attest.ts
```

### `decode-twitter.ts`
Decodes two versions of the carrier image downloaded directly from Twitter — one from PBS media CDN, one from the post. Both return `valid: true`, confirming the pixel encoding survives Twitter re-encoding losslessly.

```bash
bun run decode-twitter.ts
```

---

## Attestation Schema

```json
{
  "registry":                   "0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d",
  "agent_id":                   "5",
  "action_type":                "chat",
  "raw_input_hash":             "2cf24dba...",
  "sanitization_pipeline_hash": "8116eec2...",
  "input_hash":                 "2cf24dba...",
  "output_hash":                "74b4d50e...",
  "manifest_hash":              "0a56e06b...",
  "l4_signature":               "0xd3eb6520...",
  "l3_tx":                      "0xc3aeb16d...",
  "l3_chain":                   "84532",
  "created_at":                 "1779231272"
}
```

When `sanitization_pipeline_hash` equals the IDENTITY_SENTINEL (`8116eec2...`), no sanitization was applied and `raw_input_hash === input_hash`. See the [provenance spec](https://gist.github.com/TMerlini/ffd44a7f2e2f730cf2be51993bbfcd3e) for the full invariant.

---

## Contract Addresses (Ethereum Mainnet)

| Contract | Address |
|---|---|
| Goblinarinos registry | `0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d` |
| Pixel Goblins registry | `0xe0454dfa17a57a84c3e0e2dbfda5318cbbe91e2c` |
| AgentIdentityRegistryFactory | `0xc2bb6502a7d8ee3cdb2f96508d6cdf426aa2858f` |
| FactoryFacade | `0xC939b58F3B36293D3D55993ADD6EE0C79e7AAD2f` |

---

## References

- [HBS Image Provenance Spec](https://gist.github.com/TMerlini/ffd44a7f2e2f730cf2be51993bbfcd3e) — encoding primitive by [@tunnckoCore](https://github.com/tunnckoCore), attestation schema by [@TMerlini](https://github.com/TMerlini)
- [ENSIP-27 Agent Card Schema](https://github.com/ensdomains/ensips/pull/75)
- [Ethereum Magicians — Universal AI Inference Verification Registry](https://ethereum-magicians.org/t/draft-erc-universal-ai-inference-verification-registry/28083)
- [ERC-8263 — Onchain Proof Layer for AI Agents](https://ethereum-magicians.org/t/erc-8263-onchain-proof-layer-for-ai-agents)
- [OCP — Observation Commitment Protocol](https://github.com/damonzwicker/observation-commitment-protocol)
