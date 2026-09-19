// Oliva Devs hardening: which local files a `reply`/attachment call may send.
// Split out of server.ts so the rule is testable without its
// connect-on-import side effects (server.ts talks to WhatsApp as soon as
// it's imported — see its own header comment on why ./lib exists).
//
// This replaced a denylist (a short list of known-sensitive paths — the rest
// of the machine's readable files were sendable) with an allowlist: only
// files that resolve inside a dedicated outbox directory are sendable at
// all. The outbox is meant to be populated deliberately (by Miyoia, via the
// approved-message flow for the "Comunicador"/"Aceituna" channel), not
// browsed into from arbitrary paths a compromised or confused caller might
// supply.

import { realpathSync } from "fs";
import { resolve, sep } from "path";

function realDir(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

/** Throws with a clear, non-leaky message unless `f` resolves to a path
 *  inside `outboxDir` (itself resolved through symlinks). Fails closed: an
 *  unresolvable path (doesn't exist, broken symlink, permission error) is
 *  refused rather than allowed — the one caller stats the file immediately
 *  afterwards, so a genuinely sendable file always resolves. */
export function assertSendable(f: string, outboxDir: string): void {
  let real: string;
  try {
    real = realpathSync(f);
  } catch {
    throw new Error(`refusing to send unresolvable path: ${f}`);
  }
  const outbox = realDir(outboxDir);
  if (real !== outbox && !real.startsWith(outbox + sep)) {
    throw new Error(
      `refusing to send ${f}: attachments must be inside the outbox (${outboxDir})`,
    );
  }
}
