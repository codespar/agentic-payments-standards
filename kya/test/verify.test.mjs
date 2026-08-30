// Conformance tests for the published KYA verifier.
//
// The fixtures are frozen token bytes built from ../mandate-format-v3.md by
// ./make-fixtures.mjs, so this file never reproduces the canonical string or any
// other part of verify.mjs's logic. It runs the script as a reader would and
// checks the two things a verifier is for: it says VERIFIED (exit 0) for a
// mandate that is genuinely signed and in date, and it fails closed, with a
// non-zero exit, for every mandate that is not.
//
// Everything runs in pinned `--did-doc` mode against DIDs under the reserved
// .example TLD, so no test here touches the network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const verify = fileURLToPath(new URL("../verify.mjs", import.meta.url));
const fx = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

const ISSUER_DID = "did:web:issuer.example";

async function run(token, { agentDoc = "agent-did.json", issuerDid = ISSUER_DID } = {}) {
  const args = [
    verify,
    fx(token),
    "--did-doc", fx(agentDoc),
    "--did-doc", fx("issuer-did.json"),
    "--issuer-did", issuerDid,
  ];
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, { timeout: 30_000 });
    return { code: 0, out: `${stdout}${stderr}` };
  } catch (err) {
    return { code: err.code ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

test("a genuinely signed, in-date mandate verifies", async () => {
  // The positive control for every negative below: same script, same pinned
  // documents, exit 0. A verifier that rejected everything would fail here.
  const r = await run("valid.token");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^VERIFIED$/m, r.out);
  assert.match(r.out, /signatures: +agent ok \+ issuer ok/, r.out);
  assert.match(r.out, /keys: +pinned \(no network\)/, r.out);
});

test("an expired mandate is rejected even though both signatures are good", async () => {
  const r = await run("expired.token");
  assert.notEqual(r.code, 0, `an expired mandate must not exit 0\n${r.out}`);
  assert.match(r.out, /^INVALID$/m, r.out);
  assert.match(r.out, /expired/, r.out);
});

test("raising the amount after signing is rejected", async () => {
  const r = await run("tampered-amount.token");
  assert.notEqual(r.code, 0, `a tampered mandate must not exit 0\n${r.out}`);
  assert.match(r.out, /^INVALID$/m, r.out);
  assert.match(r.out, /signature does not verify/, r.out);
});

test("a token that names no agent key is rejected", async () => {
  const r = await run("no-agent-kid.token");
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /INVALID/, r.out);
  assert.match(r.out, /agent_kid/, r.out);
});

test("a key that is published but not an assertionMethod cannot sign a mandate", async () => {
  // Same token, same key bytes, same signatures as valid.token. The only
  // difference is that the DID document does not authorise that key to make
  // assertions, so a verifier that only matched the kid would say VERIFIED.
  const r = await run("valid.token", { agentDoc: "agent-did-no-assertion.json" });
  assert.notEqual(r.code, 0, `an unauthorised key must not verify\n${r.out}`);
  assert.match(r.out, /INVALID/, r.out);
  assert.match(r.out, /assertionMethod/, r.out);
});

test("the issuer is the one the caller names, not one the token can claim", async () => {
  // --issuer-did is an assumption the caller makes (the format carries no
  // issuer_did). Pointed at the wrong DID, verification must fail rather than
  // fall back to any key it can find.
  const r = await run("valid.token", { issuerDid: "did:web:agent.example" });
  assert.notEqual(r.code, 0, `the wrong issuer must not verify\n${r.out}`);
  assert.match(r.out, /INVALID/, r.out);
});
