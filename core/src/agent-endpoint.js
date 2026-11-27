'use strict';
const http = require('node:http');
const { createHash, timingSafeEqual } = require('node:crypto');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { ListToolsRequestSchema, CallToolRequestSchema, SUPPORTED_PROTOCOL_VERSIONS } = require('@modelcontextprotocol/sdk/types.js');

const BAD = JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'bad-request' }, id: null });
const METHODS = new Set(['initialize', 'notifications/initialized', 'ping', 'tools/list', 'tools/call']);
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const digest = (value) => createHash('sha256').update(value).digest();
const errorResult = (code) => ({ isError: true, content: [{ type: 'text', text: code }] });

function createAgentEndpoint({ agents, tools, log = (line) => console.error(line), port = 8090, clock = Date }) {
  const keys = agents.map((agent) => [digest(agent.key), agent]);
  const calls = new Map();
  let running = 0;
  let server;

  function find(header) {
    const candidate = digest(typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '');
    let found = null;
    for (const [key, agent] of keys) if (timingSafeEqual(candidate, key)) found = agent;
    return found;
  }

  function valid(body) {
    if (!plain(body) || Object.keys(body).some((key) => !['jsonrpc', 'id', 'method', 'params'].includes(key))) return false;
    if (body.jsonrpc !== '2.0' || !METHODS.has(body.method) || (body.id !== undefined && !Number.isSafeInteger(body.id))) return false;
    if (body.params !== undefined && !plain(body.params)) return false;
    if (body.method === 'tools/call' && (!plain(body.params) || typeof body.params.name !== 'string' || (body.params.arguments !== undefined && !plain(body.params.arguments)))) return false;
    return true;
  }

  async function handle(req, res) {
    const agent = find(req.headers.authorization);
    if (!agent) { log('rfactory-agents: refused'); res.writeHead(401).end(); return; }
    if (req.headers.origin !== undefined) { res.writeHead(403).end(); return; }
    if (req.url.split('?')[0] !== '/mcp') { res.writeHead(404).end(); return; }
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }

    let size = 0;
    const chunks = [];
    const complete = await new Promise((resolve) => {
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > 16384) {
          req.pause();
          const socket = req.socket;
          res.writeHead(413, { Connection: 'close' });
          res.end(() => socket.destroy());
          resolve(false);
        } else chunks.push(chunk);
      });
      req.once('end', () => resolve(true));
      req.once('error', () => resolve(false));
    });
    if (!complete) { if (!res.headersSent) res.writeHead(400, { 'Content-Type': 'application/json' }).end(BAD); return; }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { res.writeHead(400, { 'Content-Type': 'application/json' }).end(BAD); return; }
    if (!valid(body)) { res.writeHead(400, { 'Content-Type': 'application/json' }).end(BAD); return; }
    // The SDK answers these three headers itself, in its own words (and echoes the version): refuse them first.
    const { accept = '', 'content-type': type = '', 'mcp-protocol-version': version } = req.headers;
    if (!accept.toLowerCase().includes('application/json') || !accept.toLowerCase().includes('text/event-stream') || !/^application\/json\s*(;|$)/i.test(type)
      || (version !== undefined && !SUPPORTED_PROTOCOL_VERSIONS.includes(version))) {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end(BAD);
      return;
    }
    req.headers.accept = accept.toLowerCase();

    const mcp = new Server({ name: 'rfactory-agents', version: '1' }, { capabilities: { tools: {} } });
    mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: tools.list() }));
    mcp.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
      const known = tools.list().some((item) => item.name === params.name) ? params.name : 'unknown';
      let tool = known;
      let project = '-';
      let code = 'ok';
      let result;
      const now = clock.now();
      const recent = (calls.get(agent.name) || []).filter((at) => at > now - 60000);
      recent.push(now);
      calls.set(agent.name, recent);
      if (recent.length > 30) code = 'rate-limited';
      else if (running >= 2) code = 'busy';
      else {
        running++;
        try {
          const answer = await tools.call(agent, params.name, params.arguments || {});
          tool = answer.tool;
          project = answer.project;
          if (answer.error) code = answer.error;
          else result = answer.result;
        } catch { code = 'source-error'; }
        finally { running--; }
      }
      log(`rfactory-agents: ${agent.name} ${tool} ${project} ${code}`);
      return code === 'ok' ? { content: [{ type: 'text', text: JSON.stringify(result) }] } : errorResult(code);
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const send = transport.send.bind(transport);
    transport.send = (message, options) => send(message.error
      ? { jsonrpc: message.jsonrpc, id: message.id, error: { code: -32600, message: 'bad-request' } }
      : message, options);
    try { await mcp.connect(transport); await transport.handleRequest(req, res, body); }
    catch { if (!res.headersSent) res.writeHead(500).end(); }
    finally { await mcp.close().catch(() => {}); }
  }

  return {
    async start() {
      server = http.createServer(handle);
      server.on('upgrade', (_req, socket) => socket.destroy());
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
      return `http://127.0.0.1:${server.address().port}/mcp`;
    },
    async close() { if (server) await new Promise((resolve) => server.close(resolve)); },
  };
}

module.exports = { createAgentEndpoint };
