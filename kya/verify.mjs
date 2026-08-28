// verify.mjs — verify a CodeSpar V3 agent mandate with nothing but node:crypto.
//
// Usage:
//   node verify.mjs <token-file>                      resolve keys over did:web
//   node verify.mjs <token-file> --did-doc <file>...   verify fully offline, pinned keys
//   node verify.mjs <token-file> --issuer-did <did>    verify against another issuer
//
// where <token-file> contains the base64url `signed_token` a mandate carries,
// and each --did-doc is a DID document you already hold (see "Offline" below).
//
// What it proves: the mandate was signed by BOTH the agent and the issuer
// (dual Ed25519) over the canonical string, for a given cap, purpose and
// expiry, bound to an accountable principal — and that it has not expired.
//
// What it needs from the network, and what it does not:
//   - No SDK, no API key, no authenticated call, and no CodeSpar-specific
//     endpoint. Nobody asks the issuer for permission to verify.
//   - Key resolution follows the W3C did:web method: the URL is DERIVED from
//     the DID itself, so any standard did:web resolver reaches the same
//     document. `did:web:h:a:b` -> https://h/a/b/did.json, and a bare
//     `did:web:h` -> https://h/.well-known/did.json.
//   - That derived GET is the ONLY network access. Signature checking is pure
//     local computation. Pin the DID documents with --did-doc and the whole
//     verification runs with no network at all, which is the mode to use if
//     you need to prove a mandate long after the fact.
//
// Exit code is 0 only when the mandate is VALID.
//
// KNOWN LIMITATION, and it is a limitation of the FORMAT, not of this script:
// the V3/V4 canonical string has no `issuer_did` field, so a token cannot say
// who issued it. The verifier therefore cannot learn the issuer from the token
// and has to be told, which is what --issuer-did is for; it defaults to the
// CodeSpar platform issuer. Until a format version carries `issuer_did` inside
// the signed bytes, an issuer named on the command line is an assumption the
// caller makes, not a fact the signature proves. Any multi-issuer deployment
// needs that field added to the canonical string first.
//
// See ./mandate-format-v3.md for the exact canonical string this reproduces.

import { createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const pinned = [];
const positional = [];
let issuerDidArg = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--did-doc") pinned.push(argv[++i]);
  else if (argv[i] === "--issuer-did") issuerDidArg = argv[++i];
  else positional.push(argv[i]);
}
if (positional.length !== 1 || pinned.some((f) => !f) || issuerDidArg === undefined) {
  console.error("usage: node verify.mjs <token-file> [--did-doc <file>]... [--issuer-did <did>]");
  process.exit(2);
}
const offlineOnly = pinned.length > 0;

const tok = JSON.parse(Buffer.from(readFileSync(positional[0], "utf8").trim(), "base64url"));

// ------------------------------------------------------- did:web resolution
// Post-host colons become path slashes; a bare host reads from /.well-known/.
// Segments are percent-decoded per the method, then validated so a crafted DID
// cannot walk the path or smuggle a different host.
const SEGMENT_OK = /^[A-Za-z0-9._-]+$/;
const HOST_OK = /^[A-Za-z0-9.-]+(:[0-9]{1,5})?$/;

function didToUrl(did) {
  if (!did.startsWith("did:web:")) throw new Error(`not a did:web DID: ${did}`);
  const raw = did.slice("did:web:".length).split(":");
  const host = decodeURIComponent(raw[0]);
  if (!HOST_OK.test(host)) throw new Error(`bad did:web host: ${host}`);
  const segments = raw.slice(1).map(decodeURIComponent);
  for (const s of segments) {
    // "." and ".." pass the charset but would walk the path once the URL is
    // normalised, so the resolver would fetch a document the DID never named.
    if (!SEGMENT_OK.test(s) || s === "." || s === "..") {
      throw new Error(`bad did:web path segment: ${s}`);
    }
  }
  return segments.length === 0
    ? `https://${host}/.well-known/did.json`
    : `https://${host}/${segments.join("/")}/did.json`;
}

const docs = new Map();
for (const file of pinned) {
  const doc = JSON.parse(readFileSync(file, "utf8"));
  docs.set(doc.id, doc);
}

async function resolve(did) {
  if (docs.has(did)) return docs.get(did);
  if (offlineOnly) throw new Error(`no pinned document for ${did}`);
  const url = didToUrl(did);
  const res = await fetch(url, { headers: { accept: "application/did+json, application/json" } });
  if (!res.ok) throw new Error(`did:web resolution failed: ${url} -> HTTP ${res.status}`);
  const doc = await res.json();
  // The document must claim the DID we asked for, or the host is answering
  // for somebody else.
  if (doc.id !== did) throw new Error(`document id ${doc.id} does not match ${did}`);
  docs.set(did, doc);
  return doc;
}

// The signing key must be the exact kid the token names — never "some key from
// that document". A missing kid is a failure, not a reason to try another key.
function publicKeyFor(doc, kid) {
  const vm = (doc.verificationMethod ?? []).find((m) => m.id === kid);
  if (!vm) throw new Error(`no verificationMethod with id ${kid} in ${doc.id}`);
  // did:web publishes which keys may make assertions; a key that is present but
  // not an assertionMethod is not authorised to sign a mandate.
  const assertion = doc.assertionMethod ?? [];
  if (assertion.length && !assertion.some((a) => (typeof a === "string" ? a : a?.id) === kid)) {
    throw new Error(`${kid} is not an assertionMethod in ${doc.id}`);
  }
  return createPublicKey({ key: vm.publicKeyJwk, format: "jwk" });
}

// ------------------------------------------------------- canonical string
// 14 fields joined by ":", exactly as the issuer produces. `purposes` are
// sorted and escaped (\ -> \\, then , -> \,).
const encP = (s) => s.replace(/\\/g, "\\\\").replace(/,/g, "\\,");
const signing = [
  tok.format_version, tok.id, tok.agent_id, tok.type, tok.amount, tok.currency,
  [...tok.purposes].sort().map(encP).join(","), tok.expires_at,
  tok.max_amount ?? "", tok.parent_id ?? "", tok.denomination ?? "",
  tok.secret_version, tok.principal_kyc_ref ?? "", tok.agent_kid ?? "",
].join(":");
const msg = Buffer.from(signing);

// ---------------------------------------------------------------- verify
if (typeof tok.agent_kid !== "string" || !tok.agent_kid.includes("#")) {
  console.error("INVALID\nreason:      token carries no agent_kid");
  process.exit(1);
}
const agentDid = tok.agent_kid.split("#")[0];
// Not carried by the token (see the format limitation at the top), so it comes
// from the caller, defaulting to the CodeSpar platform issuer.
const issuerDid = issuerDidArg ?? "did:web:id.codespar.dev";

let agentOk, issuerOk;
try {
  agentOk = verify(null, msg, await publicKeyFor(await resolve(agentDid), tok.agent_kid),
    Buffer.from(tok.agent_sig, "base64url"));
  issuerOk = verify(null, msg, await publicKeyFor(await resolve(issuerDid), `${issuerDid}#1`),
    Buffer.from(tok.issuer_sig, "base64url"));
} catch (err) {
  console.error(`INVALID\nreason:      ${err.message}`);
  process.exit(1);
}

// An expired mandate is not a valid mandate, however good its signatures are.
const now = Math.floor(Date.now() / 1000);
const expired = !Number.isFinite(tok.expires_at) || tok.expires_at <= now;
const secondsLeft = tok.expires_at - now;
const valid = agentOk && issuerOk && !expired;

const reason = valid
  ? null
  : !agentOk || !issuerOk
    ? "signature does not verify"
    : `expired ${Math.abs(Math.round(secondsLeft / 86400))}d ago`;

console.log(valid ? "VERIFIED" : "INVALID");
if (reason) console.log(`reason:      ${reason}`);
console.log(`agent:       ${tok.agent_id}`);
console.log(`principal:   ${tok.principal_kyc_ref ?? "none"}`);
console.log(`signatures:  agent ${agentOk ? "ok" : "X"} + issuer ${issuerOk ? "ok" : "X"}`);
console.log(`issuer:      ${issuerDid}${issuerDidArg ? "" : " (default, not asserted by the token)"}`);
console.log(`keys:        ${offlineOnly ? "pinned (no network)" : "resolved over did:web"}`);
console.log(
  `cap:         ${tok.currency} ${tok.amount} | purposes: ${tok.purposes.join(", ")} | ` +
  (expired ? "EXPIRED" : `expires in: ${Math.round(secondsLeft / 86400)}d`),
);

process.exit(valid ? 0 : 1);
