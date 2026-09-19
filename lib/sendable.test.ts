import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { assertSendable } from "./sendable";

function freshDirs() {
  const root = mkdtempSync(join(tmpdir(), "wa-sendable-"));
  const outbox = join(root, "outbox");
  const elsewhere = join(root, "elsewhere");
  mkdirSync(outbox, { recursive: true });
  mkdirSync(elsewhere, { recursive: true });
  return { root, outbox, elsewhere };
}

describe("assertSendable", () => {
  test("allows a file directly inside the outbox", () => {
    const { outbox } = freshDirs();
    const f = join(outbox, "photo.jpg");
    writeFileSync(f, "x");
    expect(() => assertSendable(f, outbox)).not.toThrow();
  });

  test("allows a file in a subdirectory of the outbox", () => {
    const { outbox } = freshDirs();
    const sub = join(outbox, "2026-09-19");
    mkdirSync(sub, { recursive: true });
    const f = join(sub, "doc.pdf");
    writeFileSync(f, "x");
    expect(() => assertSendable(f, outbox)).not.toThrow();
  });

  test("refuses a file outside the outbox, even in a sibling directory", () => {
    const { outbox, elsewhere } = freshDirs();
    const f = join(elsewhere, "photo.jpg");
    writeFileSync(f, "x");
    expect(() => assertSendable(f, outbox)).toThrow(/outbox/);
  });

  test("refuses a file whose name is merely prefixed by the outbox path (no separator)", () => {
    // Guards the naive `real.startsWith(outbox)` bug: a sibling directory
    // like "<outbox>-evil" starts with the outbox's string but is not
    // inside it.
    const { root, outbox } = freshDirs();
    const lookalike = outbox + "-evil";
    mkdirSync(lookalike, { recursive: true });
    const f = join(lookalike, "photo.jpg");
    writeFileSync(f, "x");
    expect(() => assertSendable(f, outbox)).toThrow(/outbox/);
  });

  test("refuses ~/.ssh even though it used to be denylisted by name — allowlist covers it too", () => {
    const { outbox, elsewhere } = freshDirs();
    const fakeSsh = join(elsewhere, ".ssh");
    mkdirSync(fakeSsh, { recursive: true });
    const f = join(fakeSsh, "id_rsa");
    writeFileSync(f, "x");
    expect(() => assertSendable(f, outbox)).toThrow(/outbox/);
  });

  test("refuses an unresolvable (nonexistent) path", () => {
    const { outbox } = freshDirs();
    expect(() =>
      assertSendable(join(outbox, "does-not-exist.jpg"), outbox),
    ).toThrow(/unresolvable/);
  });

  test("a symlink inside the outbox pointing outside it is refused (resolves via realpath)", () => {
    const { outbox, elsewhere } = freshDirs();
    const secret = join(elsewhere, "secret.txt");
    writeFileSync(secret, "x");
    const link = join(outbox, "innocuous.txt");
    try {
      symlinkSync(secret, link);
    } catch {
      // Symlink creation can require elevated privileges on Windows;
      // skip rather than fail the suite on such a runner.
      return;
    }
    expect(() => assertSendable(link, outbox)).toThrow(/outbox/);
  });

  test("the outbox root itself is sendable", () => {
    const { outbox } = freshDirs();
    // Not a realistic call (outbox is a directory, not a file) but confirms
    // the boundary check treats real === outbox as inside, not just
    // startsWith(outbox + sep).
    expect(() => assertSendable(outbox, outbox)).not.toThrow();
  });
});
