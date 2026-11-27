'use strict';
// Fake github-mcp-server: run(config) serves config.tools and canned config.results.
// A result entry is { pages: [...] } (page picked by `page` or cursor "c<N>") or any JSON value.
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

async function run(config) {
  if (config.pidFile) require('node:fs').writeFileSync(config.pidFile, String(process.pid));
  if (process.argv.includes('--version')) {
    if (config.hang === 'version') return new Promise(() => { setInterval(() => {}, 1000); });
    return console.log(`GitHub MCP Server\nVersion: ${config.version || '1.14.0'}`);
  }
  process.stderr.write('fake-stderr\n');
  if (config.hang === 'handshake') return new Promise(() => { setInterval(() => {}, 1000); });
  const server = new Server({ name: 'fake', version: '0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: config.tools }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (config.hang === req.params.name) return new Promise(() => {});
    const a = req.params.arguments || {};
    const e = config.results[req.params.name + (a.method ? `:${a.method}` : '')];
    if (e === undefined) return { isError: true, content: [{ type: 'text', text: 'no canned result' }] };
    let out = e;
    if (e && e.pages) {
      const idx = a.after ? Number(String(a.after).slice(1)) : (a.page || 1) - 1;
      out = e.pages[idx] ?? e.pages[e.pages.length - 1];
    }
    return { content: [{ type: 'text', text: JSON.stringify(out) }] };
  });
  await server.connect(new StdioServerTransport());
}

module.exports = { run };
