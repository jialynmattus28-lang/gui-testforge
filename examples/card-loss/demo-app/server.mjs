import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

const defaultCards = [
  { id: 'CARD-1001', label: 'Everyday account ending 1001', status: 'normal', selectable: true },
  { id: 'CARD-2002', label: 'Travel account ending 2002', status: 'lost', selectable: false },
  { id: 'CARD-3003', label: 'Savings account ending 3003', status: 'closed', selectable: false },
];

function initialState(fixture = {}) {
  const cards = structuredClone(fixture.cards ?? defaultCards).map((card) => ({
    ...card,
    selectable: card.selectable ?? card.status === 'normal',
  }));
  return {
    screen: 'identity',
    selectedCardId: null,
    messageCode: 'READY',
    businessOutcome: 'IN_PROGRESS',
    cards,
    fixture: {
      identityOutcome: fixture.identityOutcome ?? 'success',
      faceOutcome: fixture.faceOutcome ?? 'success',
      correctPassword: fixture.correctPassword ?? '123456',
    },
  };
}

function publicState(state) {
  const { fixture, ...visible } = state;
  return structuredClone(visible);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

export async function startDemoApp({ host = '127.0.0.1', port = 0 } = {}) {
  let state = initialState();

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`);
      if (request.method === 'GET' && url.pathname === '/health') {
        return sendJson(response, 200, { ok: true, service: 'card-loss-demo' });
      }
      if (request.method === 'GET' && url.pathname === '/api/state') {
        return sendJson(response, 200, publicState(state));
      }
      if (request.method === 'POST' && url.pathname === '/api/test/reset') {
        state = initialState(await readJson(request));
        return sendJson(response, 200, publicState(state));
      }

      if (request.method === 'POST' && url.pathname.startsWith('/api/action/')) {
        const body = await readJson(request);
        const action = url.pathname.slice('/api/action/'.length);

        if (action === 'read-identity') {
          if (state.fixture.identityOutcome === 'success') {
            state.screen = 'face';
            state.messageCode = 'IDENTITY_OK';
          } else {
            state.screen = 'identity';
            state.messageCode = 'IDENTITY_READ_FAILED';
          }
        } else if (action === 'verify-face') {
          if (state.screen !== 'face') return sendJson(response, 409, { error: 'Identity is not complete' });
          if (state.fixture.faceOutcome === 'success') {
            state.screen = 'cards';
            state.messageCode = 'FACE_OK';
          } else {
            state.messageCode = 'FACE_VERIFICATION_FAILED';
          }
        } else if (action === 'select-card') {
          if (state.screen !== 'cards') return sendJson(response, 409, { error: 'Card selection is not available' });
          const card = state.cards.find((candidate) => candidate.id === body.cardId);
          if (!card) return sendJson(response, 404, { error: 'Card not found' });
          if (!card.selectable) {
            state.messageCode = 'CARD_NOT_SELECTABLE';
          } else {
            state.selectedCardId = card.id;
            state.messageCode = 'CARD_SELECTED';
          }
        } else if (action === 'continue') {
          if (state.screen !== 'cards') return sendJson(response, 409, { error: 'Continue is not available' });
          if (!state.selectedCardId) {
            state.messageCode = 'CARD_REQUIRED';
          } else {
            state.screen = 'password';
            state.messageCode = 'PASSWORD_REQUIRED';
          }
        } else if (action === 'submit-password') {
          if (state.screen !== 'password') return sendJson(response, 409, { error: 'Password entry is not available' });
          if (body.value !== state.fixture.correctPassword) {
            state.messageCode = 'PASSWORD_INCORRECT';
          } else {
            const card = state.cards.find((candidate) => candidate.id === state.selectedCardId);
            card.status = 'lost';
            card.selectable = false;
            state.screen = 'result';
            state.messageCode = 'CARD_LOST';
            state.businessOutcome = 'SUCCEEDED';
          }
        } else if (action === 'exit') {
          state.screen = 'ended';
          state.messageCode = 'SERVICE_ENDED';
          state.businessOutcome = 'CANCELLED';
        } else {
          return sendJson(response, 404, { error: `Unknown action: ${action}` });
        }
        return sendJson(response, 200, publicState(state));
      }

      if (request.method === 'GET' && staticFiles.has(url.pathname)) {
        const [fileName, contentType] = staticFiles.get(url.pathname);
        const content = await readFile(new URL(`./public/${fileName}`, import.meta.url));
        response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
        return response.end(content);
      }
      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const url = `http://${host}:${address.port}`;
  return {
    url,
    server,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4318);
  const app = await startDemoApp({ port });
  console.log(`Card Loss demo app: ${app.url}`);
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await app.close();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
