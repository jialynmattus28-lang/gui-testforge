const screen = document.querySelector('#screen');
const message = document.querySelector('#message');

async function request(path, body = undefined) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
  return payload;
}

function button(label, testId, handler, options = {}) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.dataset.testid = testId;
  element.disabled = options.disabled ?? false;
  element.className = options.secondary ? 'secondary' : '';
  element.addEventListener('click', async () => render(await handler()));
  return element;
}

function heading(title, copy) {
  screen.replaceChildren();
  const h1 = document.createElement('h1');
  h1.textContent = title;
  const p = document.createElement('p');
  p.textContent = copy;
  screen.append(h1, p);
}

function render(state) {
  document.body.dataset.screen = state.screen;
  document.body.dataset.selectedCardId = state.selectedCardId ?? '';
  document.body.dataset.businessOutcome = state.businessOutcome;
  document.querySelectorAll('[data-step]').forEach((item) => {
    item.classList.toggle('active', item.dataset.step === state.screen);
  });
  message.textContent = state.messageCode;

  if (state.screen === 'identity') {
    heading('Read identity', 'Place the synthetic identity document on the reader.');
    screen.append(button('Read identity', 'read-identity', () => request('/api/action/read-identity', {})));
  } else if (state.screen === 'face') {
    heading('Verify identity', 'Look at the camera to complete synthetic face verification.');
    screen.append(button('Verify face', 'verify-face', () => request('/api/action/verify-face', {})));
  } else if (state.screen === 'cards') {
    heading('Select a card', 'Only a card in normal status can be selected.');
    const list = document.createElement('div');
    list.className = 'card-list';
    for (const card of state.cards) {
      const item = button(
        `${card.label} | ${card.status}`,
        `card-${card.id}`,
        () => request('/api/action/select-card', { cardId: card.id }),
        { disabled: !card.selectable },
      );
      item.classList.toggle('selected', state.selectedCardId === card.id);
      item.dataset.cardStatus = card.status;
      item.dataset.cardSelectable = String(card.selectable);
      list.append(item);
    }
    screen.append(list, button('Continue', 'continue', () => request('/api/action/continue', {})));
  } else if (state.screen === 'password') {
    heading('Confirm card loss', 'Enter the six-digit synthetic card password.');
    const input = document.createElement('input');
    input.type = 'password';
    input.inputMode = 'numeric';
    input.maxLength = 6;
    input.autocomplete = 'off';
    input.dataset.testid = 'password';
    input.setAttribute('aria-label', 'Card password');
    screen.append(input, button('Confirm card loss', 'submit-password', () => request('/api/action/submit-password', { value: input.value })));
  } else if (state.screen === 'result') {
    heading('Card loss completed', 'The selected synthetic card is now marked as lost.');
    const result = document.createElement('p');
    result.dataset.testid = 'business-outcome';
    result.textContent = state.businessOutcome;
    screen.append(result);
  } else {
    heading('Service ended', 'No changes can be made in this session.');
  }
}

render(await request('/api/state'));
