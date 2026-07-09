// verify.mjs — verify a CodeSpar V3 agent mandate offline, with no SDK and no API key.
//
// Usage: node verify.mjs <token-file>
//   where <token-file> contains the base64url `signed_token` a mandate carries.
//
// What it proves: the mandate was signed by BOTH the agent and the issuer
// (dual Ed25519), for a given cap, purpose and expiry, bound to an accountable
// principal. The only network call is an unauthenticated GET of the public
// did:web documents to fetch the two public keys.
//
// See ../kya/mandate-format-v3.md for the exact canonical string this reproduces.

import { createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";

const tok = JSON.parse(Buffer.from(readFileSync(process.argv[2], "utf8").trim(), "base64url"));

// The DID is inside the token: agent_kid = "<agent-did>#<n>". The verifier needs
// only the token: no org, no env, no API key, no authenticated call.
const agentDid = tok.agent_kid.split("#")[0];
const issuerDid = "did:web:id.codespar.dev"; // platform issuer (well-known)

// Canonical signed string: 14 fields joined by ":", exactly as the issuer
// produces. `purposes` are sorted and escaped (\ -> \\, then , -> \,).
const encP = (s) => s.replace(/\\/g, "\\\\").replace(/,/g, "\\,");
const signing = [
  tok.format_version, tok.id, tok.agent_id, tok.type, tok.amount, tok.currency,
  [...tok.purposes].sort().map(encP).join(","), tok.expires_at,
  tok.max_amount ?? "", tok.parent_id ?? "", tok.denomination ?? "",
  tok.secret_version, tok.principal_kyc_ref ?? "", tok.agent_kid ?? "",
].join(":");
const msg = Buffer.from(signing);

async function pubkey(did, kid) {
  const doc = await (await fetch(`https://api.codespar.dev/v1/agents/${did}/did.json`)).json();
  const vm = doc.verificationMethod.find((m) => m.id === kid) ?? doc.verificationMethod[0];
  return createPublicKey({ key: vm.publicKeyJwk, format: "jwk" });
}

const agentOk = verify(null, msg, await pubkey(agentDid, tok.agent_kid), Buffer.from(tok.agent_sig, "base64url"));
const issuerOk = verify(null, msg, await pubkey(issuerDid, issuerDid + "#1"), Buffer.from(tok.issuer_sig, "base64url"));

const days = Math.round((tok.expires_at * 1000 - Date.now()) / 86400000);
console.log(agentOk && issuerOk ? "VERIFIED" : "INVALID");
console.log(`agent:       ${tok.agent_id}`);
console.log(`principal:   ${tok.principal_kyc_ref ?? "none"}`);
console.log(`signatures:  agent ${agentOk ? "ok" : "X"} + issuer ${issuerOk ? "ok" : "X"}`);
console.log(`cap:         ${tok.currency} ${tok.amount} | purposes: ${tok.purposes.join(", ")} | expires in: ${days}d`);
