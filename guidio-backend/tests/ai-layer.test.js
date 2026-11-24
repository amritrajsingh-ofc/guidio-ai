/*
 * Tests for the AI provider layer.
 *
 *   npm test
 *
 * No real API keys and no internet are needed: Gemini, Groq and Ollama are
 * simulated by small local HTTP servers that speak their real wire formats.
 * These tests prove the adapters, failover, cooldowns, timeouts, validation
 * and streaming logic. They do NOT prove that your real keys and models work;
 * use the live check in the README for that.
 */

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "mongodb://localhost:27017/test";
process.env.CLERK_SECRET_KEY ||= "sk_test_dummy";
process.env.CLERK_PUBLISHABLE_KEY ||= "pk_test_dummy";
process.env.GROQ_API_KEY ||= "gsk_dummy"; // satisfies "at least one provider"
process.env.LOG_LEVEL = "error";

import assert from "node:assert/strict";
import http from "node:http";
import { after, describe, test } from "node:test";
import { z } from "zod";

const { AI_ERROR, AiError } = await import("../src/ai/ai-errors.js");
const { createProviderManager } =
  await import("../src/ai/ai-provider-manager.js");
const { createGeminiProvider } =
  await import("../src/ai/providers/gemini-provider.js");
const { createGroqProvider } =
  await import("../src/ai/providers/groq-provider.js");
const { createLocalProvider } =
  await import("../src/ai/providers/local-provider.js");
const { normalizeMessages, parseJsonText } =
  await import("../src/ai/ai-response.js");

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */

const silent = { debug() {}, info() {}, warn() {}, error() {} };

const testConfig = {
  providerOrder: ["gemini", "groq", "ollama"],
  defaultMaxOutputTokens: 512,
  streamIdleTimeoutMs: 300,
  maxRetries: 1,
  retryBaseDelayMs: 1,
  cooldown: {
    defaultRateLimitMs: 60_000,
    maxMs: 900_000,
    transientThreshold: 3,
    transientMs: 30_000,
    configurationMs: 900_000,
  },
};

/** A scripted provider. `behaviour` is called for every generate/stream call. */
function fakeProvider(name, behaviour, { timeoutMs = 500 } = {}) {
  const calls = { generate: 0, stream: 0 };

  return {
    name,
    model: `${name}-model`,
    timeoutMs,
    calls,
    isConfigured: () => true,
    async generate(request) {
      calls.generate += 1;
      return behaviour(request, calls.generate);
    },
    async *stream(request) {
      calls.stream += 1;
      yield* behaviour(request, calls.stream);
    },
  };
}

function managerWith(providers, overrides = {}, clock = Date.now) {
  return createProviderManager({
    providers,
    config: { ...testConfig, ...overrides },
    log: silent,
    now: clock,
    wait: async () => {},
  });
}

const ok = (text) => async () => ({ text, finishReason: "stop" });
const fail =
  (code, extra = {}) =>
  async () => {
    throw new AiError(code, extra);
  };
const request = (extra = {}) => ({
  feature: "test",
  messages: [{ role: "user", content: "hi" }],
  ...extra,
});

/* ---------------------------------------------------------
   Mock servers
   --------------------------------------------------------- */

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      req.json = body ? JSON.parse(body) : null;
      handler(req, res);
    });
    server.listen(0, "127.0.0.1", () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` }),
    );
  });
}

const servers = [];
async function mock(handler) {
  const started = await startServer(handler);
  servers.push(started.server);
  return started.url;
}

after(() => {
  for (const server of servers) {
    server.closeAllConnections?.();
    server.close();
  }
});

/* =========================================================
   Pure helpers
   ========================================================= */

describe("response helpers", () => {
  test("normalizeMessages merges roles, drops empties and a leading assistant message", () => {
    const result = normalizeMessages([
      { role: "assistant", content: "stray" },
      { role: "user", content: " a " },
      { role: "user", content: "b" },
      { role: "assistant", content: "  " },
      { role: "assistant", content: "c" },
    ]);

    assert.deepEqual(result, [
      { role: "user", content: "a\n\nb" },
      { role: "assistant", content: "c" },
    ]);
  });

  test("normalizeMessages rejects an empty history", () => {
    assert.throws(
      () => normalizeMessages([]),
      (e) => e.code === AI_ERROR.INVALID_REQUEST,
    );
  });

  test("parseJsonText accepts plain JSON, fenced JSON and JSON inside text", () => {
    assert.deepEqual(parseJsonText('{"a":1}'), { a: 1 });
    assert.deepEqual(parseJsonText('```json\n{"a":2}\n```'), { a: 2 });
    assert.deepEqual(parseJsonText('Sure! Here it is: {"a":3} Hope it helps'), {
      a: 3,
    });
    assert.throws(
      () => parseJsonText("not json"),
      (e) => e.code === AI_ERROR.INVALID_OUTPUT,
    );
    assert.throws(
      () => parseJsonText(""),
      (e) => e.code === AI_ERROR.INVALID_OUTPUT,
    );
  });
});

/* =========================================================
   Manager: failover, retries, cooldowns
   ========================================================= */

describe("provider manager", () => {
  test("uses the first provider and does not touch the others", async () => {
    const a = fakeProvider("gemini", ok("from gemini"));
    const b = fakeProvider("groq", ok("from groq"));
    const result = await managerWith([a, b]).generate(request());

    assert.equal(result.text, "from gemini");
    assert.equal(result.provider, "gemini");
    assert.equal(result.fallbackUsed, false);
    assert.equal(b.calls.generate, 0);
  });

  test("429 fails over immediately and pauses the limited provider (no retry on it)", async () => {
    const a = fakeProvider(
      "gemini",
      fail(AI_ERROR.RATE_LIMITED, { retryAfterSeconds: 30 }),
    );
    const b = fakeProvider("groq", ok("from groq"));
    const manager = managerWith([a, b]);

    const first = await manager.generate(request());
    assert.equal(first.provider, "groq");
    assert.equal(first.fallbackUsed, true);
    assert.equal(a.calls.generate, 1);

    // Second request: Gemini is paused, so it is not even called.
    await manager.generate(request());
    assert.equal(a.calls.generate, 1);

    const status = manager
      .getStatus()
      .find((item) => item.provider === "gemini");
    assert.equal(status.available, false);
    assert.equal(status.pausedSeconds, 30);
  });

  test("a paused provider is used again after its Retry-After time", async () => {
    let time = 1_000_000;
    const a = fakeProvider("gemini", async (_r, n) => {
      if (n === 1)
        throw new AiError(AI_ERROR.RATE_LIMITED, { retryAfterSeconds: 10 });
      return { text: "back", finishReason: "stop" };
    });
    const b = fakeProvider("groq", ok("from groq"));
    const manager = managerWith([a, b], {}, () => time);

    assert.equal((await manager.generate(request())).provider, "groq");
    time += 5_000;
    assert.equal((await manager.generate(request())).provider, "groq");
    time += 6_000; // 11 s after the 429
    assert.equal((await manager.generate(request())).provider, "gemini");
  });

  test("does NOT fail over on invalid requests or safety refusals", async () => {
    for (const code of [AI_ERROR.INVALID_REQUEST, AI_ERROR.SAFETY]) {
      const a = fakeProvider("gemini", fail(code));
      const b = fakeProvider("groq", ok("x"));

      await assert.rejects(
        managerWith([a, b]).generate(request()),
        (e) => e.code === code,
      );
      assert.equal(b.calls.generate, 0, `${code} must not reach the fallback`);
      assert.equal(a.calls.generate, 1, `${code} must not be retried`);
    }
  });

  test("bad API key fails over without retry and pauses the provider for a long time", async () => {
    const a = fakeProvider(
      "gemini",
      fail(AI_ERROR.AUTH, { providerStatus: 403 }),
    );
    const b = fakeProvider("groq", ok("ok"));
    const manager = managerWith([a, b]);

    assert.equal((await manager.generate(request())).provider, "groq");
    assert.equal(a.calls.generate, 1);
    assert.ok(manager.getStatus()[0].pausedSeconds > 600);
  });

  test("5xx is NOT retried when another provider exists (lower latency)", async () => {
    const a = fakeProvider(
      "gemini",
      fail(AI_ERROR.UNAVAILABLE, { providerStatus: 503 }),
    );
    const b = fakeProvider("groq", ok("ok"));

    await managerWith([a, b]).generate(request());
    assert.equal(a.calls.generate, 1);
  });

  test("5xx IS retried once when it is the last provider", async () => {
    const a = fakeProvider("gemini", async (_r, n) => {
      if (n === 1)
        throw new AiError(AI_ERROR.UNAVAILABLE, { providerStatus: 503 });
      return { text: "second try", finishReason: "stop" };
    });

    const result = await managerWith([a]).generate(request());
    assert.equal(result.text, "second try");
    assert.equal(a.calls.generate, 2);
  });

  test("a rate-limited last provider is never retried", async () => {
    const a = fakeProvider(
      "gemini",
      fail(AI_ERROR.RATE_LIMITED, { retryAfterSeconds: 20 }),
    );

    await assert.rejects(managerWith([a]).generate(request()), (e) => {
      assert.equal(e.code, AI_ERROR.RATE_LIMITED);
      assert.equal(e.statusCode, 429);
      assert.equal(e.retryAfterSeconds, 20);
      return true;
    });
    assert.equal(a.calls.generate, 1);
  });

  test("all providers rate limited -> 429 with the shortest wait; later calls do not hit them", async () => {
    const a = fakeProvider(
      "gemini",
      fail(AI_ERROR.RATE_LIMITED, { retryAfterSeconds: 40 }),
    );
    const b = fakeProvider(
      "groq",
      fail(AI_ERROR.RATE_LIMITED, { retryAfterSeconds: 15 }),
    );
    const manager = managerWith([a, b]);

    await assert.rejects(manager.generate(request()), (e) => {
      assert.equal(e.code, AI_ERROR.RATE_LIMITED);
      assert.equal(e.retryAfterSeconds, 15);
      assert.match(e.message, /limit has been reached/i);
      return true;
    });

    await assert.rejects(
      manager.generate(request()),
      (e) => e.code === AI_ERROR.RATE_LIMITED,
    );
    assert.equal(a.calls.generate, 1);
    assert.equal(b.calls.generate, 1);
  });

  test("all providers down -> useful 503, never a crash", async () => {
    const a = fakeProvider("gemini", fail(AI_ERROR.UNAVAILABLE));
    const b = fakeProvider("groq", fail(AI_ERROR.TIMEOUT));

    await assert.rejects(managerWith([a, b]).generate(request()), (e) => {
      assert.equal(e.code, AI_ERROR.UNAVAILABLE);
      assert.equal(e.statusCode, 503);
      assert.equal(e.attempts.length, 2);
      return true;
    });
  });

  test("three transient failures pause a provider for a short time", async () => {
    let time = 0;
    const a = fakeProvider("gemini", fail(AI_ERROR.UNAVAILABLE));
    const b = fakeProvider("groq", ok("ok"));
    const manager = managerWith([a, b], {}, () => time);

    for (let i = 0; i < 3; i += 1) await manager.generate(request());
    assert.equal(a.calls.generate, 3);

    await manager.generate(request());
    assert.equal(a.calls.generate, 3, "paused after 3 failures");

    time += 31_000;
    await manager.generate(request());
    assert.equal(a.calls.generate, 4, "tried again after the pause");
  });

  test("a provider that never answers times out and the fallback answers", async () => {
    const slow = fakeProvider("gemini", () => new Promise(() => {}), {
      timeoutMs: 50,
    });
    const b = fakeProvider("groq", ok("fast"));
    const started = Date.now();
    const result = await managerWith([slow, b]).generate(request());

    assert.equal(result.provider, "groq");
    assert.ok(Date.now() - started < 1000);
  });

  test("timeout on the only provider -> 504", async () => {
    const slow = fakeProvider("gemini", () => new Promise(() => {}), {
      timeoutMs: 50,
    });

    await assert.rejects(managerWith([slow]).generate(request()), (e) => {
      assert.equal(e.code, AI_ERROR.TIMEOUT);
      assert.equal(e.statusCode, 504);
      return true;
    });
  });

  test("a caller abort cancels the work and is not retried or failed over", async () => {
    const a = fakeProvider("gemini", () => new Promise(() => {}), {
      timeoutMs: 5000,
    });
    const b = fakeProvider("groq", ok("x"));
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);

    await assert.rejects(
      managerWith([a, b]).generate(request({ signal: controller.signal })),
      (e) => e.code === AI_ERROR.CANCELLED,
    );
    assert.equal(b.calls.generate, 0);
  });

  test("no configured provider -> ai_not_configured", async () => {
    await assert.rejects(
      managerWith([]).generate(request()),
      (e) => e.code === AI_ERROR.NOT_CONFIGURED,
    );
  });

  test("provider order follows AI_PROVIDER_ORDER", async () => {
    const a = fakeProvider("gemini", ok("gemini"));
    const b = fakeProvider("groq", ok("groq"));
    const result = await managerWith([a, b], {
      providerOrder: ["groq", "gemini"],
    }).generate(request());

    assert.equal(result.provider, "groq");
  });
});

describe("JSON validation inside the manager", () => {
  const schema = z.object({ title: z.string().min(3) });
  const parse = (text) => {
    const value = JSON.parse(text);
    const result = schema.safeParse(value);
    if (!result.success) throw new AiError(AI_ERROR.INVALID_OUTPUT);
    return result.data;
  };

  test("invalid JSON from the first provider falls over to the next one", async () => {
    const a = fakeProvider("gemini", ok('{"title":"x"}')); // too short
    const b = fakeProvider("groq", ok('{"title":"Good"}'));
    const result = await managerWith([a, b]).generate(request({ parse }));

    assert.deepEqual(result.data, { title: "Good" });
    assert.equal(result.provider, "groq");
  });

  test("invalid output does not pause the provider", async () => {
    const a = fakeProvider("gemini", ok('{"title":"x"}'));
    const b = fakeProvider("groq", ok('{"title":"Good"}'));
    const manager = managerWith([a, b]);

    await manager.generate(request({ parse }));
    assert.equal(manager.getStatus()[0].available, true);
  });

  test("the last provider gets exactly one extra try for invalid output", async () => {
    const a = fakeProvider("gemini", async (_r, n) => ({
      text: n === 1 ? "garbage" : '{"title":"Fine"}',
      finishReason: "stop",
    }));
    const result = await managerWith([a]).generate(request({ parse }));

    assert.equal(a.calls.generate, 2);
    assert.deepEqual(result.data, { title: "Fine" });
  });

  test("everything invalid -> ai_invalid_output (502)", async () => {
    const a = fakeProvider("gemini", ok("garbage"));

    await assert.rejects(managerWith([a]).generate(request({ parse })), (e) => {
      assert.equal(e.code, AI_ERROR.INVALID_OUTPUT);
      assert.equal(e.statusCode, 502);
      return true;
    });
  });
});

describe("streaming in the manager", () => {
  test("streams chunks and returns the full text", async () => {
    const a = fakeProvider("gemini", async function* () {
      yield "Hel";
      yield "lo";
    });
    const chunks = [];
    const result = await managerWith([a]).stream(
      request({ onChunk: (c) => chunks.push(c) }),
    );

    assert.deepEqual(chunks, ["Hel", "lo"]);
    assert.equal(result.text, "Hello");
  });

  test("fails over BEFORE the first chunk", async () => {
    const a = fakeProvider("gemini", async function* () {
      throw new AiError(AI_ERROR.RATE_LIMITED, { retryAfterSeconds: 10 });
    });
    const b = fakeProvider("groq", async function* () {
      yield "fallback answer";
    });
    const chunks = [];
    const result = await managerWith([a, b]).stream(
      request({ onChunk: (c) => chunks.push(c) }),
    );

    assert.equal(result.provider, "groq");
    assert.deepEqual(chunks, ["fallback answer"]);
  });

  test("does NOT fail over after text was sent; keeps the partial text", async () => {
    const a = fakeProvider("gemini", async function* () {
      yield "partial ";
      throw new AiError(AI_ERROR.UNAVAILABLE);
    });
    const b = fakeProvider("groq", async function* () {
      yield "must not be used";
    });
    const chunks = [];

    await assert.rejects(
      managerWith([a, b]).stream(request({ onChunk: (c) => chunks.push(c) })),
      (e) => {
        assert.equal(e.partialText, "partial ");
        assert.equal(e.midStream, true);
        return true;
      },
    );
    assert.deepEqual(chunks, ["partial "]);
    assert.equal(b.calls.stream, 0);
  });

  test("a stream that goes silent is cut by the idle timeout", async () => {
    const a = fakeProvider("gemini", async function* () {
      yield "start";
      await new Promise(() => {});
    });

    await assert.rejects(managerWith([a]).stream(request()), (e) => {
      assert.equal(e.code, AI_ERROR.TIMEOUT);
      assert.equal(e.partialText, "start");
      return true;
    });
  });

  test("an empty stream counts as invalid output", async () => {
    const a = fakeProvider("gemini", async function* () {});

    await assert.rejects(
      managerWith([a]).stream(request()),
      (e) => e.code === AI_ERROR.INVALID_OUTPUT,
    );
  });

  test("aborting the caller signal stops the stream", async () => {
    const a = fakeProvider("gemini", async function* () {
      yield "one";
      await new Promise(() => {});
    });
    const controller = new AbortController();

    await assert.rejects(
      managerWith([a]).stream(
        request({
          signal: controller.signal,
          onChunk: () => controller.abort(),
        }),
      ),
      (e) => e.code === AI_ERROR.CANCELLED,
    );
  });
});

/* =========================================================
   Adapters against simulated HTTP APIs
   ========================================================= */

describe("Groq adapter", () => {
  const baseRequest = {
    system: "You are helpful.",
    messages: [{ role: "user", content: "hello" }],
    signal: new AbortController().signal,
  };

  test("sends the right request and reads a normal answer", async () => {
    let seen;
    const url = await mock((req, res) => {
      seen = { url: req.url, auth: req.headers.authorization, body: req.json };
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          choices: [
            { message: { content: "hi there" }, finish_reason: "stop" },
          ],
        }),
      );
    });

    const provider = createGroqProvider({
      enabled: true,
      apiKey: "gsk_test",
      model: "m1",
      baseUrl: `${url}/openai/v1`,
      timeoutMs: 2000,
      defaultMaxOutputTokens: 777,
    });
    const result = await provider.generate(baseRequest);

    assert.equal(result.text, "hi there");
    assert.equal(seen.url, "/openai/v1/chat/completions");
    assert.equal(seen.auth, "Bearer gsk_test");
    assert.equal(seen.body.model, "m1");
    assert.equal(seen.body.max_completion_tokens, 777);
    assert.equal(seen.body.messages[0].role, "system");
    assert.equal(seen.body.response_format, undefined);
  });

  test("JSON mode: sets json_object and puts the schema in the system prompt", async () => {
    let body;
    const url = await mock((req, res) => {
      body = req.json;
      res.end(
        JSON.stringify({ choices: [{ message: { content: '{"a":1}' } }] }),
      );
    });
    const provider = createGroqProvider({
      enabled: true,
      apiKey: "k",
      model: "m",
      baseUrl: url,
      timeoutMs: 2000,
      defaultMaxOutputTokens: 100,
    });

    await provider.generate({
      ...baseRequest,
      jsonSchema: { type: "object", properties: { a: { type: "integer" } } },
    });

    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.match(body.messages[0].content, /valid JSON/);
    assert.match(body.messages[0].content, /"properties"/);
  });

  test("429 + Retry-After header becomes rate_limited with that wait", async () => {
    const url = await mock((_req, res) => {
      res.statusCode = 429;
      res.setHeader("retry-after", "17");
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: {
            message: "Rate limit reached",
            type: "tokens",
            code: "rate_limit_exceeded",
          },
        }),
      );
    });
    const provider = createGroqProvider({
      enabled: true,
      apiKey: "k",
      model: "m",
      baseUrl: url,
      timeoutMs: 2000,
      defaultMaxOutputTokens: 100,
    });

    await assert.rejects(provider.generate(baseRequest), (e) => {
      assert.equal(e.code, AI_ERROR.RATE_LIMITED);
      assert.equal(e.retryAfterSeconds, 17);
      assert.equal(e.providerStatus, 429);
      return true;
    });
  });

  test("status mapping: 401 auth, 404 model, 400 invalid request, 413 short pause, 500 unavailable, json_validate_failed", async () => {
    const cases = [
      [401, null, AI_ERROR.AUTH],
      [404, null, AI_ERROR.MODEL_NOT_FOUND],
      [
        400,
        { error: { message: "bad", code: "invalid" } },
        AI_ERROR.INVALID_REQUEST,
      ],
      [
        400,
        {
          error: {
            message: "Failed to generate JSON",
            code: "json_validate_failed",
          },
        },
        AI_ERROR.INVALID_OUTPUT,
      ],
      [413, null, AI_ERROR.RATE_LIMITED],
      [500, null, AI_ERROR.UNAVAILABLE],
    ];

    for (const [status, payload, expected] of cases) {
      const url = await mock((_req, res) => {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(payload ?? { error: { message: "x" } }));
      });
      const provider = createGroqProvider({
        enabled: true,
        apiKey: "k",
        model: "m",
        baseUrl: url,
        timeoutMs: 2000,
        defaultMaxOutputTokens: 100,
      });

      await assert.rejects(
        provider.generate(baseRequest),
        (e) => e.code === expected,
        `status ${status}`,
      );
    }
  });

  test("streams server-sent events until [DONE]", async () => {
    const url = await mock((_req, res) => {
      res.setHeader("Content-Type", "text/event-stream");
      const send = (text) =>
        res.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
        );
      send("Hel");
      send("lo ");
      res.write(`data: ${JSON.stringify({ choices: [{ delta: {} }] })}\n\n`);
      send("world");
      res.write("data: [DONE]\n\n");
      res.end();
    });
    const provider = createGroqProvider({
      enabled: true,
      apiKey: "k",
      model: "m",
      baseUrl: url,
      timeoutMs: 2000,
      defaultMaxOutputTokens: 100,
    });
    const parts = [];

    for await (const text of provider.stream(baseRequest)) parts.push(text);

    assert.deepEqual(parts, ["Hel", "lo ", "world"]);
  });

  test("strips <think> reasoning from JSON answers", async () => {
    const url = await mock((_req, res) => {
      res.end(
        JSON.stringify({
          choices: [{ message: { content: '<think>hmm</think>{"a":1}' } }],
        }),
      );
    });
    const provider = createGroqProvider({
      enabled: true,
      apiKey: "k",
      model: "m",
      baseUrl: url,
      timeoutMs: 2000,
      defaultMaxOutputTokens: 100,
    });

    assert.equal((await provider.generate(baseRequest)).text, '{"a":1}');
  });

  test("connection refused becomes ai_unavailable", async () => {
    const provider = createGroqProvider({
      enabled: true,
      apiKey: "k",
      model: "m",
      baseUrl: "http://127.0.0.1:1",
      timeoutMs: 2000,
      defaultMaxOutputTokens: 100,
    });

    await assert.rejects(
      provider.generate(baseRequest),
      (e) => e.code === AI_ERROR.UNAVAILABLE,
    );
  });
});

describe("Ollama adapter", () => {
  const baseRequest = {
    system: "sys",
    messages: [{ role: "user", content: "hello" }],
    signal: new AbortController().signal,
  };

  test("sends format (JSON schema), options and reads the answer", async () => {
    let seen;
    const url = await mock((req, res) => {
      seen = { url: req.url, body: req.json };
      res.end(
        JSON.stringify({
          message: { content: '{"ok":true}' },
          done: true,
          done_reason: "stop",
        }),
      );
    });
    const provider = createLocalProvider({
      enabled: true,
      baseUrl: url,
      model: "llama3.2",
      numCtx: 4096,
      timeoutMs: 2000,
      defaultMaxOutputTokens: 300,
    });
    const schema = { type: "object", properties: { ok: { type: "boolean" } } };
    const result = await provider.generate({
      ...baseRequest,
      jsonSchema: schema,
    });

    assert.equal(result.text, '{"ok":true}');
    assert.equal(seen.url, "/api/chat");
    assert.deepEqual(seen.body.format, schema);
    assert.equal(seen.body.stream, false);
    assert.equal(seen.body.options.num_ctx, 4096);
    assert.equal(seen.body.options.num_predict, 300);
    assert.equal(seen.body.options.temperature, 0.2);
  });

  test("model not pulled (404) -> model_not_found", async () => {
    const url = await mock((_req, res) => {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "model 'x' not found" }));
    });
    const provider = createLocalProvider({
      enabled: true,
      baseUrl: url,
      model: "x",
      numCtx: 4096,
      timeoutMs: 2000,
      defaultMaxOutputTokens: 300,
    });

    await assert.rejects(
      provider.generate(baseRequest),
      (e) => e.code === AI_ERROR.MODEL_NOT_FOUND,
    );
  });

  test("streams newline-delimited JSON", async () => {
    const url = await mock((_req, res) => {
      res.write(
        JSON.stringify({ message: { content: "Hi " }, done: false }) + "\n",
      );
      res.write(
        JSON.stringify({ message: { content: "there" }, done: false }) + "\n",
      );
      res.end(JSON.stringify({ message: { content: "" }, done: true }) + "\n");
    });
    const provider = createLocalProvider({
      enabled: true,
      baseUrl: url,
      model: "m",
      numCtx: 4096,
      timeoutMs: 2000,
      defaultMaxOutputTokens: 300,
    });
    const parts = [];

    for await (const text of provider.stream(baseRequest)) parts.push(text);

    assert.deepEqual(parts, ["Hi ", "there"]);
  });

  test("Ollama not running -> ai_unavailable", async () => {
    const provider = createLocalProvider({
      enabled: true,
      baseUrl: "http://127.0.0.1:1",
      model: "m",
      numCtx: 4096,
      timeoutMs: 2000,
      defaultMaxOutputTokens: 300,
    });

    await assert.rejects(
      provider.generate(baseRequest),
      (e) => e.code === AI_ERROR.UNAVAILABLE,
    );
  });
});

describe("Gemini adapter (real SDK against a simulated Gemini API)", () => {
  const baseRequest = {
    system: "sys",
    messages: [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ],
    signal: new AbortController().signal,
  };

  const candidate = (text, finishReason = "STOP") => ({
    candidates: [
      { content: { role: "model", parts: [{ text }] }, finishReason },
    ],
  });

  function geminiProvider(url) {
    return createGeminiProvider({
      enabled: true,
      apiKey: "test-key",
      model: "gem-test",
      baseUrl: url,
      timeoutMs: 3000,
    });
  }

  test("maps roles, system prompt and JSON schema into the request", async () => {
    let seen;
    const url = await mock((req, res) => {
      seen = { url: req.url, body: req.json };
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(candidate('{"x":1}')));
    });
    const schema = { type: "object", properties: { x: { type: "integer" } } };
    const result = await geminiProvider(url).generate({
      ...baseRequest,
      jsonSchema: schema,
      temperature: 0.3,
      maxOutputTokens: 900,
    });

    assert.equal(result.text, '{"x":1}');
    assert.match(seen.url, /gem-test:generateContent/);
    assert.deepEqual(
      seen.body.contents.map((c) => c.role),
      ["user", "model", "user"],
    );
    assert.equal(seen.body.systemInstruction.parts[0].text, "sys");
    assert.equal(
      seen.body.generationConfig.responseMimeType,
      "application/json",
    );
    assert.deepEqual(seen.body.generationConfig.responseJsonSchema, schema);
    assert.equal(seen.body.generationConfig.temperature, 0.3);
    assert.equal(seen.body.generationConfig.maxOutputTokens, 900);
  });

  test("429 RESOURCE_EXHAUSTED with RetryInfo -> rate_limited with the delay", async () => {
    const url = await mock((_req, res) => {
      res.statusCode = 429;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: {
            code: 429,
            message: "Quota exceeded",
            status: "RESOURCE_EXHAUSTED",
            details: [
              {
                "@type": "type.googleapis.com/google.rpc.RetryInfo",
                retryDelay: "33s",
              },
            ],
          },
        }),
      );
    });

    await assert.rejects(geminiProvider(url).generate(baseRequest), (e) => {
      assert.equal(e.code, AI_ERROR.RATE_LIMITED);
      assert.equal(e.retryAfterSeconds, 33);
      return true;
    });
  });

  test("invalid key (HTTP 400 API_KEY_INVALID) -> auth failure, not invalid request", async () => {
    const url = await mock((_req, res) => {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: {
            code: 400,
            message: "API key not valid. Please pass a valid API key.",
            status: "INVALID_ARGUMENT",
          },
        }),
      );
    });

    await assert.rejects(
      geminiProvider(url).generate(baseRequest),
      (e) => e.code === AI_ERROR.AUTH,
    );
  });

  test("503 overloaded -> unavailable; 404 -> model_not_found", async () => {
    for (const [status, expected] of [
      [503, AI_ERROR.UNAVAILABLE],
      [404, AI_ERROR.MODEL_NOT_FOUND],
    ]) {
      const url = await mock((_req, res) => {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: { code: status, message: "x", status: "UNAVAILABLE" },
          }),
        );
      });

      await assert.rejects(
        geminiProvider(url).generate(baseRequest),
        (e) => e.code === expected,
      );
    }
  });

  test("blocked prompt -> safety (never retried or failed over)", async () => {
    const url = await mock((_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }));
    });

    await assert.rejects(
      geminiProvider(url).generate(baseRequest),
      (e) => e.code === AI_ERROR.SAFETY,
    );
  });

  test("streams server-sent events", async () => {
    const url = await mock((req, res) => {
      assert.match(req.url, /streamGenerateContent/);
      res.setHeader("Content-Type", "text/event-stream");
      res.write(`data: ${JSON.stringify(candidate("Hello ", ""))}\n\n`);
      res.write(`data: ${JSON.stringify(candidate("world"))}\n\n`);
      res.end();
    });
    const parts = [];

    for await (const text of geminiProvider(url).stream(baseRequest))
      parts.push(text);

    assert.equal(parts.join(""), "Hello world");
  });

  test("end-to-end: Gemini 429 -> manager falls back to Groq with correct text", async () => {
    const geminiUrl = await mock((_req, res) => {
      res.statusCode = 429;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: {
            code: 429,
            message: "Quota exceeded",
            status: "RESOURCE_EXHAUSTED",
          },
        }),
      );
    });
    const groqUrl = await mock((_req, res) => {
      res.end(
        JSON.stringify({ choices: [{ message: { content: "groq answer" } }] }),
      );
    });

    const manager = managerWith([
      geminiProvider(geminiUrl),
      createGroqProvider({
        enabled: true,
        apiKey: "k",
        model: "m",
        baseUrl: groqUrl,
        timeoutMs: 2000,
        defaultMaxOutputTokens: 100,
      }),
    ]);
    const result = await manager.generate(request());

    assert.equal(result.text, "groq answer");
    assert.equal(result.fallbackUsed, true);
    assert.equal(manager.getStatus()[0].available, false);
  });
});

describe("secrets", () => {
  test("getStatus() contains no API keys", async () => {
    const manager = managerWith([fakeProvider("gemini", ok("x"))]);
    const text = JSON.stringify(manager.getStatus());

    assert.doesNotMatch(text, /key|secret|token/i);
  });
});
