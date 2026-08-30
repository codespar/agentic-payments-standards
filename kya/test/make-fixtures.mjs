// Regenerate kya/test/fixtures/. Run: node kya/test/make-fixtures.mjs
//
// The canonical string below is written from ../mandate-format-v3.md, the spec,
// NOT from ../verify.mjs. That direction is the point: the fixtures are frozen
// bytes that a conforming verifier must accept, so if verify.mjs ever drifts
// from the spec the frozen token stops verifying and CI says so.
//
// Ed25519 is deterministic (RFC 8032), which is why the spec calls for freezing
// a fixture. Each run mints fresh throwaway keys and writes only PUBLIC keys
// (inside the DID documents) plus the signed tokens. No private key is ever
// written to disk.
//
// The DIDs use the reserved `.example` TLD (RFC 6761): they resolve nowhere, so
// the fixtures can only be verified in the pinned `--did-doc` mode.

import { generateKeyPairSync, sign } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = new URL("./fixtures/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const AGENT_DID = "did:web:agent.example";
const ISSUER_DID = "did:web:issuer.example";
const AGENT_KID = `${AGENT_DID}#1`;
const ISSUER_KID = `${ISSUER_DID}#1`;

const agent = generateKeyPairSync("ed25519");
const issuer = generateKeyPairSync("ed25519");

const didDoc = (id, kid, key, { assertion = true } = {}) => ({
  "@context": ["https://www.w3.org/ns/did/v1"],
  id,
  verificationMethod: [
    { id: kid, type: "JsonWebKey2020", controller: id, publicKeyJwk: key.export({ format: "jwk" }) },
  ],
  // did:web publishes which keys may make assertions. `assertion: false` writes
  // a document where the key exists but is not authorised to sign a mandate.
  assertionMethod: assertion ? [kid] : [`${id}#unrelated`],
});

// mandate-format-v3.md, "Canonical signing string": 14 fields, 13 ":" separators,
// absent optionals as the empty string, purposes sorted then escaped (\ -> \\
// first, then , -> \,).
const escapePurpose = (s) => s.replace(/\\/g, "\\\\").replace(/,/g, "\\,");
function canonical(m) {
  return [
    m.format_version,
    m.id,
    m.agent_id,
    m.type,
    m.amount,
    m.currency,
    [...m.purposes].sort().map(escapePurpose).join(","),
    m.expires_at,
    m.max_amount ?? "",
    m.parent_id ?? "",
    m.denomination ?? "",
    m.secret_version,
    m.principal_kyc_ref ?? "",
    m.agent_kid ?? "",
  ].join(":");
}

const base = {
  format_version: 3,
  id: "mnd_fixture_v3",
  agent_id: "agt_fixture",
  type: "payment",
  amount: "500",
  currency: "BRL",
  // Deliberately unsorted, and one member carries a comma and a backslash so the
  // escaping rule is exercised rather than assumed.
  purposes: ["groceries", "a,b", "back\\slash"],
  expires_at: 7258118400, // 2200-01-01T00:00:00Z: far enough out that a frozen
  //                          fixture never expires the build.
  max_amount: null,
  parent_id: null,
  denomination: null,
  secret_version: 1,
  principal_kyc_ref: "kyc_fixture_principal",
  agent_kid: AGENT_KID,
};

function signed(mandate) {
  const msg = Buffer.from(canonical(mandate));
  return {
    ...mandate,
    agent_sig: sign(null, msg, agent.privateKey).toString("base64url"),
    issuer_sig: sign(null, msg, issuer.privateKey).toString("base64url"),
  };
}

const write = (name, data) =>
  writeFileSync(new URL(name, OUT), typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n");
const token = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url") + "\n";

write("agent-did.json", didDoc(AGENT_DID, AGENT_KID, agent.publicKey));
write("agent-did-no-assertion.json", didDoc(AGENT_DID, AGENT_KID, agent.publicKey, { assertion: false }));
write("issuer-did.json", didDoc(ISSUER_DID, ISSUER_KID, issuer.publicKey));

write("valid.token", token(signed(base)));

// Signatures are genuine; only the clock disagrees.
write("expired.token", token(signed({ ...base, expires_at: 1700000000 })));

// Signed at "500", then the amount is raised. The bytes are otherwise identical
// to valid.token, so a verifier that skips the signature would accept it.
write("tampered-amount.token", token({ ...signed(base), amount: "50000" }));

// The token names no agent key at all.
const { agent_kid, ...noKid } = signed(base);
write("no-agent-kid.token", token(noKid));

console.log("wrote fixtures to", OUT.pathname);
