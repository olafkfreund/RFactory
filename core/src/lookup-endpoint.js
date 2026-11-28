'use strict';
const http = require('node:http');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const refused = (text = 'lookup-refused') => ({ isError: true, content: [{ type: 'text', text }] });
const LOOKUP_LIMIT = 8;
function createLookupEndpoint({ lookups }) {
  const contexts = new Map();
  const sockets = new Map();
  let server;
  function find(header) {
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
    const candidate = Buffer.from(header.slice(7));
    for (const [token, ctx] of contexts) {
      const expected = Buffer.from(token);
      if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return [token, ctx];
    }
    return null;
  }
  function toolsFor(ctx) {
    return !ctx || ctx.signal.aborted ? [] : lookups.tools(ctx).filter((x) => ctx.tools.includes(x.name));
  }
  async function invoke(ctx, name, args) {
    if (!ctx || ctx.controller.signal.aborted || !ctx.tools.includes(name)) return { error: 'lookup-refused' };
    if (ctx.rounds >= LOOKUP_LIMIT) { ctx.roundLimited = true; return { error: 'round-limit' }; }
    ctx.rounds++;
    return lookups.call(ctx, name, args);
  }
  return {
    async start() {
      server = http.createServer(async (req, res) => {
        const found = find(req.headers.authorization);
        if (!found) { res.writeHead(401).end(); return; }
        const [token, ctx] = found;
        sockets.get(token).add(req.socket);
        const mcp = new Server({ name: 'rfactory', version: '1' }, { capabilities: { tools: {} } });
        mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolsFor(ctx) }));
        mcp.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
          const result = await invoke(ctx, params.name, params.arguments || {});
          return result.error ? refused(result.error) : { content: [{ type: 'text', text: JSON.stringify(result) }] };
        });
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        try { await mcp.connect(transport); await transport.handleRequest(req, res); }
        catch { if (!res.headersSent) res.writeHead(500).end(); }
        finally { await mcp.close().catch(() => {}); }
      });
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      return `http://127.0.0.1:${server.address().port}/mcp`;
    },
    register(ctx) {
      const token = randomBytes(32).toString('hex');
      contexts.set(token, ctx);
      sockets.set(token, new Set());
      return token;
    },
    toolsFor: (token) => toolsFor(contexts.get(token)),
    call: (token, name, args) => invoke(contexts.get(token), name, args),
    remaining: (token) => LOOKUP_LIMIT - (contexts.get(token)?.rounds ?? LOOKUP_LIMIT),
    revoke(token) {
      const ctx = contexts.get(token);
      if (!ctx) return;
      ctx.controller.abort();
      for (const socket of sockets.get(token)) socket.destroy();
      sockets.delete(token);
      contexts.delete(token);
    },
    async close() {
      for (const token of contexts.keys()) this.revoke(token);
      if (server) await new Promise((resolve) => server.close(resolve));
    },
  };
}
module.exports = { createLookupEndpoint, LOOKUP_LIMIT };
