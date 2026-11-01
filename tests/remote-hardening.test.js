// Endurecimento do acesso remoto (unidade): detecção de loopback, autorização, sessão assinada e limitador de tentativas.
process.env.HARNESS_PIN = "654321"; // config.js lê o ambiente ao ser carregado; cada arquivo de teste roda em seu processo
const test = require("node:test");
const assert = require("node:assert/strict");
const netLib = require("../tools/lib/network");
const session = require("../tools/lib/network-session");
const { createThrottle } = require("../tools/lib/network-throttle");

const PIN = "654321";
/** @returns {any} */
const fake = (remoteAddress, headers = {}) => ({ socket: remoteAddress === null ? undefined : { remoteAddress }, headers });
let n = 0;
const uniqueIp = () => `203.0.113.${++n}`;

test("isLocalhostRequest: aceita loopback direto com Host de loopback ou sem Host", () => {
  for (const addr of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
    for (const host of ["localhost:4321", "127.0.0.1:4321", "[::1]:4321", undefined]) {
      const headers = host ? { host } : {};
      assert.equal(netLib.isLocalhostRequest(fake(addr, headers)), true, `${addr} / ${host}`);
    }
  }
});

test("isLocalhostRequest: recusa loopback com qualquer cabeçalho de proxy ou túnel", () => {
  for (const h of ["x-forwarded-for", "cf-connecting-ip", "cf-ray", "forwarded", "x-real-ip", "via", "cf-visitor"]) {
    const req = fake("127.0.0.1", { host: "localhost:4321", [h]: "1.2.3.4" });
    assert.equal(netLib.isLocalhostRequest(req), false, h);
    assert.equal(netLib.isProxiedRequest(req), true, h);
  }
});

test("isLocalhostRequest: recusa Host de túnel, IP de LAN e ausência de socket", () => {
  assert.equal(netLib.isLocalhostRequest(fake("127.0.0.1", { host: "abcd.trycloudflare.com" })), false);
  assert.equal(netLib.isLocalhostRequest(fake("192.168.1.5", { host: "localhost:4321" })), false);
  assert.equal(netLib.isLocalhostRequest(fake(null)), false);
  assert.equal(netLib.isLocalhostRequest(/** @type {any} */ (undefined)), false);
});

test("authorizeRemote: local, túnel sem PIN, com PIN certo e errado", () => {
  assert.deepEqual(netLib.authorizeRemote(fake("127.0.0.1"), PIN), { ok: true, reason: "local" });
  const tunnel = (extra = {}) => fake("127.0.0.1", { host: "x.trycloudflare.com", "cf-connecting-ip": uniqueIp(), ...extra });
  const th = createThrottle();
  assert.deepEqual(netLib.authorizeRemote(tunnel(), PIN, undefined, th), { ok: false, reason: "denied" });
  assert.deepEqual(netLib.authorizeRemote(tunnel({ "x-harness-pin": PIN }), PIN, undefined, th), { ok: true, reason: "pin" });
  assert.equal(netLib.authorizeRemote(tunnel({ "x-harness-pin": "000000" }), PIN, undefined, th).ok, false);
  assert.equal(netLib.authorizeRemote(tunnel({ "x-harness-pin": "000000" }), PIN, undefined, th).reason, "denied");
});

test("authorizeRemote: sem PIN configurado, tudo que não é loopback direto é recusado", () => {
  const proxied = fake("127.0.0.1", { host: "x.trycloudflare.com", "cf-connecting-ip": "1.1.1.1" });
  assert.deepEqual(netLib.authorizeRemote(proxied, ""), { ok: false, reason: "unprotected-proxy" });
  const lan = fake("192.168.1.5", { host: "192.168.1.9:4321" });
  assert.deepEqual(netLib.authorizeRemote(lan, ""), { ok: false, reason: "unprotected-proxy" });
  // túnel que não acrescenta cabeçalhos (ssh -R, frp, socat) e usa um Host que o isAllowedHost aceita
  const bare = fake("127.0.0.1", { host: "x.trycloudflare.com" });
  assert.deepEqual(netLib.authorizeRemote(bare, ""), { ok: false, reason: "unprotected-proxy" });
  assert.deepEqual(netLib.authorizeRemote(fake("127.0.0.1", { host: "localhost:4321" }), ""), { ok: true, reason: "local" });
});

test("sessão: cookie harness_pin em texto puro não vale mais; token assinado vale", () => {
  const th = createThrottle();
  const base = { host: "x.trycloudflare.com", "cf-connecting-ip": uniqueIp() };
  const legacy = fake("127.0.0.1", { ...base, cookie: `harness_pin=${PIN}` });
  assert.equal(netLib.authorizeRemote(legacy, PIN, undefined, th).ok, false);
  const token = session.issueSessionToken(PIN);
  const ok = fake("127.0.0.1", { ...base, cookie: `a=1; harness_session=${encodeURIComponent(token)}; b=2` });
  assert.deepEqual(netLib.authorizeRemote(ok, PIN, undefined, th), { ok: true, reason: "session" });
});

test("sessão: token de outro PIN, assinatura adulterada, malformado e expirado são recusados", () => {
  const now = Date.now();
  const token = session.issueSessionToken(PIN, now);
  assert.equal(session.verifySessionToken(token, PIN, now), true);
  assert.equal(session.verifySessionToken(session.issueSessionToken("111111", now), PIN, now), false);
  const [exp, sig] = token.split(".");
  const flipped = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
  assert.equal(session.verifySessionToken(`${exp}.${flipped}`, PIN, now), false);
  assert.equal(session.verifySessionToken(`${Number(exp) + 100}.${sig}`, PIN, now), false);
  for (const bad of ["", "abc", "123.zz", `${exp}.${sig.slice(2)}`, undefined, null, 42]) {
    assert.equal(session.verifySessionToken(bad, PIN, now), false, String(bad));
  }
  assert.equal(session.verifySessionToken(token, PIN, now + (session.TTL_SEC + 5) * 1000), false);
});

test("sessão: buildSessionCookie é HttpOnly/SameSite=Strict e só é Secure sob HTTPS anunciado", () => {
  const token = session.issueSessionToken(PIN);
  const plain = netLib.buildSessionCookie(fake("127.0.0.1"), token);
  assert.match(plain, /^harness_session=/);
  assert.match(plain, /HttpOnly/);
  assert.match(plain, /SameSite=Strict/);
  assert.doesNotMatch(plain, /Secure/);
  assert.match(netLib.buildSessionCookie(fake("127.0.0.1", { "x-forwarded-proto": "https" }), token), /Secure/);
  assert.match(netLib.buildSessionCookie(fake("127.0.0.1", { "cf-visitor": '{"scheme":"https"}' }), token), /Secure/);
  assert.doesNotMatch(netLib.buildSessionCookie(fake("127.0.0.1", { "x-forwarded-proto": "http" }), token), /Secure/);
});

test("throttle: 5 falhas travam a chave, outra segue livre, o bloqueio expira e o sucesso zera", () => {
  let t = 1_000_000;
  const th = createThrottle({ now: () => t, lockMs: 60_000 });
  for (let i = 0; i < 4; i++) th.recordFailure("a");
  assert.equal(th.retryAfterSec("a"), 0);
  th.recordFailure("a");
  assert.ok(th.retryAfterSec("a") > 0);
  assert.equal(th.retryAfterSec("b"), 0);
  t += 61_000;
  assert.equal(th.retryAfterSec("a"), 0);
  for (let i = 0; i < 4; i++) th.recordFailure("c");
  th.recordSuccess("c");
  th.recordFailure("c");
  assert.equal(th.retryAfterSec("c"), 0, "contagem recomeçou do zero");
});

test("throttle: 40 falhas em chaves distintas travam todos (global) e o mapa respeita maxTracked", () => {
  const th = createThrottle({ now: () => 5_000_000 });
  for (let i = 0; i < 40; i++) th.recordFailure(`k${i}`);
  assert.ok(th.retryAfterSec("nunca-visto") > 0);

  // maxTracked: a chave mais antiga é descartada; ela volta a contar do zero em vez de manter o histórico
  const small = createThrottle({ now: () => 1, maxTracked: 3, maxGlobal: 1000 });
  for (let i = 0; i < 4; i++) small.recordFailure("old");
  for (const k of ["x", "y", "z", "w"]) small.recordFailure(k);
  small.recordFailure("old");
  assert.equal(small.retryAfterSec("old"), 0, "histórico antigo foi descartado ao passar do limite");
});

test("checkPinAttempt: trava na falha que cruza o limite e não compara durante o bloqueio", () => {
  let t = 10_000_000;
  const th = createThrottle({ now: () => t });
  const req = fake("127.0.0.1", { "cf-connecting-ip": "198.51.100.7" });
  for (let i = 0; i < 4; i++) assert.deepEqual(netLib.checkPinAttempt(req, "000000", PIN, th), { ok: false, reason: "denied" });
  const fifth = netLib.checkPinAttempt(req, "000000", PIN, th);
  assert.equal(fifth.reason, "locked");
  assert.ok((fifth.retryAfterSec || 0) > 0);
  const right = netLib.checkPinAttempt(req, PIN, PIN, th);
  assert.equal(right.ok, false, "PIN certo recusado durante o bloqueio");
  assert.equal(right.reason, "locked");
  t += 16 * 60 * 1000;
  assert.deepEqual(netLib.checkPinAttempt(req, PIN, PIN, th), { ok: true, reason: "pin" });
});

test("safeEqual: compara textos de tamanhos diferentes sem lançar", () => {
  assert.equal(netLib.safeEqual("654321", "654321"), true);
  assert.equal(netLib.safeEqual("654321", "65432"), false);
  assert.equal(netLib.safeEqual("", PIN), false);
});
