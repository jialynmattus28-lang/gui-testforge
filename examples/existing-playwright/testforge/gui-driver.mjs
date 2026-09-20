async function requireOk(response, operation) {
  if (!response.ok()) throw new Error(`${operation} failed with HTTP ${response.status()}`);
  return response.json();
}

export async function createDriver({ page, request, caseId, fixture }) {
  if (!page || !request) throw new Error('DRIVER_NOT_IMPLEMENTED: page and request fixtures are required');
  await requireOk(await request.post('/api/test/reset', { data: fixture }), 'Demo reset');
  await page.goto('/', { waitUntil: 'networkidle' });

  async function readActualState() {
    return requireOk(await request.get('/api/state'), 'Reading actual application state');
  }

  async function clickAndWait(testId, endpoint) {
    const responsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST' && new URL(response.url()).pathname === endpoint
    ));
    await page.getByTestId(testId).click();
    const state = await requireOk(await responsePromise, `GUI action ${endpoint}`);
    await page.waitForFunction(({ expectedScreen, expectedMessage }) => (
      document.body.dataset.screen === expectedScreen
      && document.querySelector('[data-testid="message-code"]')?.textContent === expectedMessage
    ), { expectedScreen: state.screen, expectedMessage: state.messageCode });
  }

  return {
    async act(action) {
      switch (action.name) {
        case 'readIdentity':
          await clickAndWait('read-identity', '/api/action/read-identity');
          return;
        case 'verifyFace':
          await clickAndWait('verify-face', '/api/action/verify-face');
          return;
        case 'selectCard': {
          const card = page.getByTestId(`card-${action.args.cardId}`);
          if (await card.isEnabled()) await clickAndWait(`card-${action.args.cardId}`, '/api/action/select-card');
          return;
        }
        case 'continue':
          await clickAndWait('continue', '/api/action/continue');
          return;
        case 'submitPassword':
          await page.getByTestId('password').fill(action.args.value);
          await clickAndWait('submit-password', '/api/action/submit-password');
          return;
        case 'exit':
          await requireOk(await request.post('/api/action/exit', { data: {} }), 'Exit');
          await page.reload({ waitUntil: 'networkidle' });
          return;
        default:
          throw new Error(`UNKNOWN_ACTION: ${action.name}`);
      }
    },

    async observe(query) {
      switch (query.target) {
        case 'screen':
          return page.locator('body').getAttribute('data-screen');
        case 'messageCode':
          return page.getByTestId('message-code').textContent();
        case 'selectedCardId': {
          const selected = page.locator('[data-testid^="card-"].selected');
          if ((await selected.count()) === 0) return null;
          return (await selected.first().getAttribute('data-testid')).replace('card-', '');
        }
        case 'canContinue':
          return (await page.locator('body').getAttribute('data-selected-card-id')) !== '';
        case 'businessOutcome':
          return page.locator('body').getAttribute('data-business-outcome');
        case 'card.status':
          return (await readActualState()).cards.find((card) => card.id === query.args.cardId)?.status ?? null;
        case 'card.selectable':
          return page.getByTestId(`card-${query.args.cardId}`).isEnabled();
        default:
          throw new Error(`UNKNOWN_OBSERVATION: ${query.target}`);
      }
    },

    async close() {
      void caseId;
    },
  };
}
