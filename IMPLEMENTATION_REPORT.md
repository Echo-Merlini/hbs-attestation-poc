## Implementation Report — ERC-8004 + ERC-8263 + OCP Stack
**dinamic.eth / TMerlini — May 25, 2026**

---

### Live Endpoints

All endpoints below are live, public, and require no authentication for read operations.

| Resource | URL |
|---|---|
| Attestation log | `GET https://gateway.ensub.org/agent/0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d/5/attestations?limit=1` |
| Agent card (ENSIP-27) | `GET https://gateway.ensub.org/agent/0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d/5/.well-known/agent.json` |
| ERC-8004 tokenURI | `GET https://gateway.ensub.org/agent/0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d/5` |
| Provenance verifier | `GET https://gateway.ensub.org/verify/input-provenance?rawInputHash=...&sanitizationPipelineHash=...&inputHash=...` |

---

### Live Attestation

```json
{
  "registry":                   "0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d",
  "agent_id":                   "5",
  "action_type":                "chat",
  "raw_input_hash":             "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  "sanitization_pipeline_hash": "8116eec29078e8f57c07077d5e8080a35bde73036581df3abb93755d1b1a16ea",
  "input_hash":                 "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  "output_hash":                "74b4d50e1b13e3a8ef9492c34f5c0af2d3a46dda11bb59378026207eea9b434b",
  "manifest_hash":              "0a56e06bbff01de7c1955dc902fadcd4f7b893bc6fc260f9253d779c220a569e",
  "l4_signature":               "0xd3eb65203317d3775ef25dc22328ea4bd82624b8836d590706f4ad578efb43006ba4cdc4df3686ca9f0960b033306696ae0adcc85f7034dec9781e4e227d45681b",
  "l3_tx":                      "0xc3aeb16d0aef167e2ebc6d4afc9333fcd13a71b8c02e5485bc6be7491e393319",
  "l3_chain":                   "84532",
  "created_at":                 "1779231272"
}
```

**L3 commitment:** Base Sepolia (chain 84532), block 41731493
**L4 signer:** resolved via `registry.getAgentWallet(5)` on Ethereum mainnet

---

### Identity Sentinel Verification

`sanitization_pipeline_hash` is the IDENTITY_SENTINEL — no sanitization transformation was applied on this execution. Verified via the provenance endpoint:

```
GET /verify/input-provenance
  ?rawInputHash=2cf24dba...
  &sanitizationPipelineHash=8116eec2...
  &inputHash=2cf24dba...
```

Response:
```json
{
  "valid": true,
  "transformation": "identity",
  "sentinelSpec": "ipfs://QmTst97dG8i9tFrutdetqMbVhSHqJGJaxMmPzWCcVVTWDU",
  "reason": "Identity pipeline: raw === input, no transformation applied"
}
```

When `sanitization_pipeline_hash` equals the IDENTITY_SENTINEL, `raw_input_hash === input_hash` and verifiers skip sanitization verification. This is a hard invariant — any mismatch between the sentinel and equal hashes is a protocol violation.

---

### CAIP-19 Identity Reference (Agent Card)

The `/.well-known/agent.json` response now includes a `registrations` field aligned with ERC-8263 and ENSIP-64:

```json
"registrations": [
  {
    "agentId":       "5",
    "agentRegistry": "eip155:1/erc8004:0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d/5",
    "agentURI":      "https://gateway.ensub.org/agent/0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d/5"
  }
]
```

---

### Feedback on Post #32 (Damon + Vincent)

**1. Accuracy of identity layer description** ✅

`registry.getAgentWallet(agentId)` is the correct and complete resolution path. No additional steps required. The returned address is the EIP-712 signing key for that agent — resolve it, recover the signer from `l4_signature`, assert equality.

**2. Compatibility of agentIdScheme 0x01 / REGISTRY with ERC-8004** ✅

Confirmed compatible. One encoding note for implementers: ERC-8263 uses `bytes32 agentId`, ERC-8004 uses `uint256`. The bridge is `bytes32(uint256(agentId))`. This is trivial but should be one explicit line in the composition guide — it will otherwise cause silent mismatches in at least a few implementations.

**3. Implementer ambiguities**

The `proofHash` field in ERC-8263's `anchorProof(agentId, proofHash)` should be clearly specified as `input_hash` — SHA-256 of the **sanitized** input (post-pipeline), not `raw_input_hash`. If an implementer hashes the raw input instead, OCP verification will fail without an obvious error. Recommend adding one sentence to the spec: _"proofHash MUST be the SHA-256 digest of the input after any declared sanitization pipeline has been applied."_

---

### Independent Verification Steps (No Gateway Trust Required)

```
1. GET /attestations → retrieve input_hash, l4_signature, l3_tx
2. Call registry.getAgentWallet(5) on mainnet → signerAddress
3. Recover EIP-712 signer from l4_signature → recoveredAddress
4. Assert recoveredAddress == signerAddress
5. Query Base Sepolia (chain 84532) tx 0xc3aeb16d... → confirm Recorded(input_hash) event at block 41731493
```

Steps 2–5 require only a public RPC endpoint. No API key, no gateway, no trust assumption beyond the registry contract.

---

### ERC-8004 Factory — Reference Registries (Ethereum Mainnet)

| Registry | Collection |
|---|---|
| `0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d` | Goblinarinos |
| `0xe0454dfa17a57a84c3e0e2dbfda5318cbbe91e2c` | Pixel Goblins |
| Factory: `0xc2bb6502a7d8ee3cdb2f96508d6cdf426aa2858f` | AgentIdentityRegistryFactory |
| FactoryFacade: `0xC939b58F3B36293D3D55993ADD6EE0C79e7AAD2f` | Public deploy interface |

All verified on Etherscan. Factory deploys per-collection registries — each collection owns its own registry, agents are `uint256` token IDs within that registry.

---

*Reference implementation: https://github.com/Echo-Merlini/hbs-attestation-poc*
*Agent card spec (ENSIP-27): https://github.com/ensdomains/ensips/pull/75*
*HBS image provenance: https://gist.github.com/TMerlini/ffd44a7f2e2f730cf2be51993bbfcd3e*
