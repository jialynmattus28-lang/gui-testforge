const stages = [
  'Requirements',
  'Test IR Design',
  'Human Review',
  'Freeze Asset',
  'Compile',
  'Run and Trace',
];

let state;
let currentStage = 0;
let selectedCaseId = null;
let operationTimer;
const content = document.querySelector('#content');
const stageNav = document.querySelector('#stage-nav');
const errorBanner = document.querySelector('#error-banner');
const editDialog = document.querySelector('#edit-dialog');
const editSource = document.querySelector('#edit-source');

async function api(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
  return payload;
}

function node(tag, options = {}, children = []) {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.testId) element.dataset.testid = options.testId;
  for (const [name, value] of Object.entries(options.attrs ?? {})) element.setAttribute(name, value);
  for (const child of children) element.append(child);
  return element;
}

function button(label, handler, options = {}) {
  const element = node('button', { className: options.secondary ? 'secondary' : '', text: label, testId: options.testId });
  element.type = 'button';
  element.disabled = options.disabled ?? false;
  if (options.title) element.title = options.title;
  element.addEventListener('click', handler);
  return element;
}

function showError(error) {
  errorBanner.textContent = error.message ?? String(error);
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.hidden = true;
  errorBanner.textContent = '';
}

function startOperation(label, determinate = false) {
  const panel = document.querySelector('#operation');
  const progress = document.querySelector('#operation-progress');
  const time = document.querySelector('#operation-time');
  document.querySelector('#operation-label').textContent = label;
  panel.hidden = false;
  progress.removeAttribute('value');
  if (determinate) progress.value = 0;
  const started = Date.now();
  clearInterval(operationTimer);
  operationTimer = setInterval(() => { time.textContent = `${Math.floor((Date.now() - started) / 1000)}s`; }, 250);
}

function updateOperation(current, total, label) {
  const progress = document.querySelector('#operation-progress');
  progress.value = total === 0 ? 0 : Math.round((current / total) * 100);
  if (label) document.querySelector('#operation-label').textContent = label;
}

function stopOperation() {
  clearInterval(operationTimer);
  document.querySelector('#operation').hidden = true;
}

function advanceAfterSuccess(nextStage, condition = true) {
  if (condition && Number.isInteger(nextStage)) currentStage = nextStage;
}

async function perform(label, action, options = {}) {
  clearError();
  startOperation(label);
  try {
    state = await action();
    advanceAfterSuccess(options.nextStage, options.when ? options.when(state) : options.nextStage !== undefined);
    render();
  } catch (error) {
    showError(error);
  } finally {
    stopOperation();
  }
}

function stageUnlocked(index) {
  return [
    true,
    state.requirementsConfirmed,
    state.cases.length > 0,
    state.reviewComplete,
    Boolean(state.frozenAsset),
    Boolean(state.compilation),
  ][index];
}

function stageComplete(index) {
  return [
    state.requirementsConfirmed,
    state.cases.length > 0,
    state.reviewComplete,
    Boolean(state.frozenAsset),
    Boolean(state.compilation),
    state.run?.status === 'COMPLETED',
  ][index];
}

const nextActionLabels = [
  'Next: Test IR Design',
  'Next: Human Review',
  'Next: Freeze Asset',
  'Next: Compile',
  'Next: Run and Trace',
];

function renderNextAction(fragment, stageIndex) {
  if (stageIndex >= stages.length - 1) return;
  fragment.append(node('footer', { className: 'workflow-footer' }, [
    button(nextActionLabels[stageIndex], () => {
      currentStage = stageIndex + 1;
      render();
    }, {
      disabled: !stageComplete(stageIndex),
      secondary: true,
      testId: 'next-stage',
    }),
  ]));
}

function renderStages() {
  stageNav.replaceChildren();
  stages.forEach((label, index) => {
    const unlocked = stageUnlocked(index);
    const complete = stageComplete(index);
    const control = node('button', { className: `stage ${index === currentStage ? 'active' : ''} ${complete ? 'complete' : ''}` });
    control.type = 'button';
    control.disabled = !unlocked;
    control.setAttribute('aria-label', unlocked ? label : `${label}, Locked`);
    control.append(
      node('span', { className: 'stage-icon', text: complete ? 'OK' : unlocked ? String(index + 1) : 'LOCK' }),
      node('span', {}, [node('strong', { text: label }), node('small', { text: complete ? 'Complete' : unlocked ? index === currentStage ? 'Current' : 'Ready' : 'Locked' })]),
    );
    control.addEventListener('click', () => { currentStage = index; render(); });
    stageNav.append(control);
  });
}

function sectionHeading(title, copy, tag) {
  const header = node('header', { className: 'section-heading' });
  const text = node('div');
  if (tag) text.append(node('span', { className: 'section-tag', text: tag }));
  text.append(node('h2', { text: title }), node('p', { text: copy }));
  header.append(text);
  return header;
}

function renderRequirements() {
  const fragment = document.createDocumentFragment();
  fragment.append(sectionHeading('Confirm the requirements', 'The bundled PRD is synthetic and contains five testable business requirements.', 'Step 1'));
  const actions = node('div', { className: 'toolbar' }, [
    node('a', { className: 'text-link', text: 'Open PRD', attrs: { href: state.artifactLinks.prd, target: '_blank' } }),
    button(state.requirementsConfirmed ? 'Requirements confirmed' : 'Confirm requirements', () => perform('Confirming requirements', () => api('/api/requirements/confirm', {}), { nextStage: 1 }), { disabled: state.requirementsConfirmed, testId: 'confirm-requirements' }),
  ]);
  fragment.append(actions);
  const list = node('div', { className: 'requirement-list' });
  for (const requirement of state.requirements) {
    list.append(node('article', { className: 'requirement-row' }, [
      node('code', { text: requirement.id }),
      node('div', {}, [node('h3', { text: requirement.title }), node('p', { text: requirement.text })]),
    ]));
  }
  fragment.append(list);
  renderNextAction(fragment, 0);
  content.replaceChildren(fragment);
}

function renderDesign() {
  const fragment = document.createDocumentFragment();
  fragment.append(sectionHeading('Create Test IR proposals', 'Use the recorded proposal for the five-minute demo, or configure a live provider for your own PRD.', 'Step 2'));
  fragment.append(node('div', { className: 'notice' }, [
    node('strong', { text: 'Offline replay' }),
    node('span', { text: 'Recorded AI response. No network request or API key is used.' }),
  ]));
  const strategy = node('textarea', { attrs: { id: 'strategy', placeholder: 'Optional test strategy or constraints', 'aria-label': 'Test strategy' } });
  const mode = node('select', { attrs: { id: 'provider-mode', 'aria-label': 'AI provider mode' } });
  mode.append(node('option', { text: 'Offline Demo', attrs: { value: 'offline' } }));
  const live = node('option', { text: state.provider.live.configured ? 'Live AI' : 'Live AI (not configured)', attrs: { value: 'live' } });
  live.disabled = !state.provider.live.configured;
  mode.append(live);
  fragment.append(node('div', { className: 'form-grid' }, [
    node('label', {}, [node('span', { text: 'Mode' }), mode]),
    node('label', { className: 'wide' }, [node('span', { text: 'Optional strategy' }), strategy]),
  ]));
  fragment.append(button(state.cases.length ? 'Generate a new proposal' : 'Create Test IR proposal', () => perform('Generating and validating Test IR', () => api('/api/generate', { mode: mode.value, strategy: strategy.value }), { nextStage: 2 }), { testId: 'generate-ir' }));
  if (state.cases.length) fragment.append(node('p', { className: 'success-line', text: `${state.cases.length} valid proposals are ready for human review.` }));
  renderNextAction(fragment, 1);
  content.replaceChildren(fragment);
}

function decisionFor(testCase) {
  return state.decisions[testCase.id];
}

function reviewCase(testCase) {
  selectedCaseId = testCase.id;
  renderReview();
}

function renderCaseDetail(testCase) {
  const decision = decisionFor(testCase);
  const detail = node('section', { className: 'case-detail' });
  detail.append(node('div', { className: 'case-title' }, [
    node('div', {}, [node('code', { text: testCase.id }), node('h3', { text: testCase.title })]),
    node('span', { className: `decision ${decision?.status ?? 'pending'}`, text: decision?.status ? decision.status.toUpperCase() : 'PENDING' }),
  ]));
  detail.append(node('div', { className: 'detail-grid' }, [
    node('div', {}, [node('span', { className: 'detail-label', text: 'Requirements' }), node('p', { text: testCase.requirementRefs.join(', ') })]),
    node('div', {}, [node('span', { className: 'detail-label', text: 'Expected business outcome' }), node('p', { text: testCase.expectedBusinessOutcome })]),
  ]));
  const steps = node('div', { className: 'steps' });
  testCase.steps.forEach((step, index) => {
    const assertionList = node('ul');
    for (const assertion of step.assertions) {
      assertionList.append(node('li', { text: `${assertion.target} equals ${JSON.stringify(assertion.equals)}` }));
    }
    steps.append(node('article', { className: 'step-row' }, [
      node('span', { className: 'step-number', text: String(index + 1) }),
      node('div', {}, [node('strong', { text: step.action.name }), node('code', { text: JSON.stringify(step.action.args ?? {}) }), assertionList]),
    ]));
  });
  detail.append(node('h4', { text: 'Semantic steps and assertions' }), steps);
  const source = node('details');
  source.append(node('summary', { text: 'View Test IR source' }), node('pre', { text: JSON.stringify(testCase, null, 2) }));
  detail.append(source);
  const refine = button('Refine with AI', async () => {
    const instruction = window.prompt('Describe the requested change for this case:');
    if (instruction) await perform('Requesting a revised proposal', () => api(`/api/cases/${encodeURIComponent(testCase.id)}/refine`, { instruction }));
  }, { secondary: true, disabled: !state.provider.live.configured, title: state.provider.live.configured ? '' : 'Configure Live AI to use per-case refinement' });
  detail.append(node('div', { className: 'case-actions' }, [
    button('Reject', async () => {
      const reason = window.prompt('Reason for rejection:');
      if (reason) await perform('Saving rejection', () => api(`/api/cases/${encodeURIComponent(testCase.id)}/reject`, { reason }), { nextStage: 3, when: (next) => next.reviewComplete });
    }, { secondary: true }),
    button('Edit manually', () => {
      editSource.value = JSON.stringify(testCase, null, 2);
      editDialog.dataset.caseId = testCase.id;
      editDialog.showModal();
    }, { secondary: true }),
    refine,
    button(decision?.status === 'approved' ? 'Approved' : 'Approve this case', () => perform('Saving human approval', () => api(`/api/cases/${encodeURIComponent(testCase.id)}/approve`, {}), { nextStage: 3, when: (next) => next.reviewComplete }), { disabled: decision?.status === 'approved', testId: 'approve-case' }),
  ]));
  return detail;
}

function renderReview() {
  if (!selectedCaseId || !state.cases.some((testCase) => testCase.id === selectedCaseId)) selectedCaseId = state.cases[0]?.id;
  const fragment = document.createDocumentFragment();
  const reviewed = Object.keys(state.decisions).length;
  fragment.append(sectionHeading('Review every Test IR case', `${reviewed} of ${state.cases.length} cases have a human decision.`, 'Step 3'));
  fragment.append(node('div', { className: 'review-toolbar' }, [
    node('span', { text: 'Approve all current proposals with content-bound human decisions.' }),
    button('Approve all', () => perform('Approving all Test IR cases', () => api('/api/cases/approve-all', {}), { nextStage: 3 }), { testId: 'approve-all' }),
  ]));
  const workspace = node('div', { className: 'review-workspace' });
  const list = node('aside', { className: 'case-list' });
  for (const testCase of state.cases) {
    const decision = decisionFor(testCase);
    const item = node('button', { className: `case-list-item ${testCase.id === selectedCaseId ? 'active' : ''}` });
    item.type = 'button';
    item.append(node('span', { className: `case-state ${decision?.status ?? 'pending'}`, text: decision?.status === 'approved' ? 'OK' : decision?.status === 'rejected' ? 'X' : '-' }), node('span', {}, [node('strong', { text: testCase.title }), node('small', { text: testCase.id })]));
    item.addEventListener('click', () => reviewCase(testCase));
    list.append(item);
  }
  const selected = state.cases.find((testCase) => testCase.id === selectedCaseId);
  workspace.append(list, selected ? renderCaseDetail(selected) : node('p', { text: 'No Test IR proposals.' }));
  fragment.append(workspace);
  renderNextAction(fragment, 2);
  content.replaceChildren(fragment);
}

function renderFreeze() {
  const approved = Object.values(state.decisions).filter((decision) => decision.status === 'approved').length;
  const rejected = Object.values(state.decisions).filter((decision) => decision.status === 'rejected').length;
  const fragment = document.createDocumentFragment();
  fragment.append(sectionHeading('Freeze the reviewed test asset', 'Freezing records the exact approved content and its SHA-256 asset hash.', 'Step 4'));
  fragment.append(node('div', { className: 'metrics' }, [
    node('div', {}, [node('strong', { text: String(approved) }), node('span', { text: 'Human approved' })]),
    node('div', {}, [node('strong', { text: String(rejected) }), node('span', { text: 'Rejected' })]),
    node('div', {}, [node('strong', { text: state.frozenAsset ? 'Verified' : 'Pending' }), node('span', { text: 'Frozen deterministic asset' })]),
  ]));
  if (state.frozenAsset) {
    fragment.append(node('p', { className: 'hash', text: state.frozenAsset.assetHash }), node('a', { className: 'text-link', text: 'Open frozen asset', attrs: { href: state.artifactLinks.frozen, target: '_blank' } }));
  } else {
    fragment.append(button('Freeze approved Test IR', () => perform('Hashing and freezing the asset', () => api('/api/freeze', {}), { nextStage: 4 }), { testId: 'freeze-asset' }));
  }
  renderNextAction(fragment, 3);
  content.replaceChildren(fragment);
}

function renderCompile() {
  const fragment = document.createDocumentFragment();
  fragment.append(sectionHeading('Compile into the existing Playwright project', 'Before GUI: generate native Playwright scripts and let the host runner discover them without starting the target application.', 'Step 5 · Before GUI'));
  const framework = node('select', { attrs: { 'aria-label': 'Test framework' } });
  framework.append(node('option', { text: 'Playwright', attrs: { value: 'playwright' } }));
  const selenium = node('option', { text: 'Selenium - Phase 2', attrs: { value: 'selenium' } });
  selenium.disabled = true;
  framework.append(selenium);
  fragment.append(node('label', { className: 'framework-select' }, [node('span', { text: 'Framework' }), framework]));
  fragment.append(node('div', { className: 'notice neutral' }, [node('strong', { text: 'Existing Playwright host' }), node('span', { text: 'The host keeps its own config, fixtures, reporters, existing tests, and normal Playwright command.' })]));
  fragment.append(button(state.compilation ? 'Compile again' : 'Compile Playwright bundle', () => perform('Compiling the frozen asset', () => api('/api/compile', { framework: framework.value }), { nextStage: 5 }), { testId: 'compile-bundle' }));
  if (state.compilation) {
    fragment.append(
      node('p', { className: 'success-line', text: `${state.compilation.manifest.cases.length} cases compiled with ${state.compilation.manifest.compilerId} ${state.compilation.manifest.compilerVersion}.` }),
      node('div', { className: 'compile-status' }, [
        node('strong', { text: 'COMPILED / NOT_EVALUATED' }),
        node('span', { text: `${state.compilation.discovery.total} tests discovered: ${state.compilation.discovery.existing} existing + ${state.compilation.discovery.generated} generated.` }),
        node('code', { text: state.compilation.sourceHash }),
      ]),
      node('a', { className: 'text-link', text: 'Open generated native spec', attrs: { href: state.artifactLinks.generated, target: '_blank' } }),
    );
  }
  renderNextAction(fragment, 4);
  content.replaceChildren(fragment);
}

async function pollRun() {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    state = await api('/api/status');
    const run = state.run;
    updateOperation(run?.progress?.current ?? 0, run?.progress?.total ?? 1, run?.progress?.caseId ? `Running ${run.progress.caseId}: ${run.progress.phase}` : 'Starting deterministic execution');
    if (run?.status !== 'RUNNING') return;
  }
}

async function startRun() {
  clearError();
  startOperation('Starting deterministic execution', true);
  try {
    state = await api('/api/run', {});
    render();
    await pollRun();
    render();
  } catch (error) {
    showError(error);
  } finally {
    stopOperation();
  }
}

function renderRun() {
  const fragment = document.createDocumentFragment();
  fragment.append(sectionHeading('Run through the host Playwright framework', 'After GUI: the same unchanged generated scripts execute through the host runner and its GUI Driver.', 'Step 6 · After GUI'));
  fragment.append(node('div', { className: 'notice neutral' }, [node('strong', { text: 'Native Playwright execution' }), node('span', { text: 'AI-free execution. The Driver reports actual UI state; Playwright compares it with the frozen expected values.' })]));
  const executionReady = state.executionSetup.ready;
  const targetUrl = node('input', {
    attrs: {
      type: 'url',
      placeholder: 'https://your-application.example',
      value: state.executionSetup.mode === 'external' ? state.executionSetup.targetUrl ?? '' : '',
      'aria-label': 'Target application URL',
    },
  });
  const driverFile = node('input', {
    attrs: { type: 'file', accept: '.mjs', 'aria-label': 'GUI Driver (.mjs)' },
  });
  const validateSetup = button('Validate execution setup', async () => {
    const file = driverFile.files?.[0];
    if (!file) return;
    const driverSource = await file.text();
    await perform('Validating application URL and GUI Driver', () => api('/api/execution/setup', {
      targetUrl: targetUrl.value.trim(),
      driverFileName: file.name,
      driverSource,
    }));
  }, { disabled: true, testId: 'validate-execution-setup' });
  const updateSetupAction = () => {
    validateSetup.disabled = !(targetUrl.value.trim() && driverFile.files?.length) || state.run?.status === 'RUNNING';
  };
  targetUrl.addEventListener('input', updateSetupAction);
  driverFile.addEventListener('change', updateSetupAction);

  fragment.append(node('section', { className: 'execution-setup' }, [
    node('div', { className: `readiness-status ${executionReady ? 'ready' : 'waiting'}` }, [
      node('strong', { text: executionReady ? 'READY FOR EXECUTION' : 'Waiting for application and GUI Driver' }),
      node('span', { text: executionReady
        ? `${state.executionSetup.targetUrl} · ${state.executionSetup.driverFileName}`
        : 'Compilation is complete. Execution remains disabled until both handoff inputs are validated.' }),
    ]),
    node('div', { className: 'form-grid execution-form' }, [
      node('label', {}, [node('span', { text: 'Target application URL' }), targetUrl]),
      node('label', {}, [node('span', { text: 'GUI Driver (.mjs)' }), driverFile]),
    ]),
    node('div', { className: 'setup-actions' }, [
      validateSetup,
      ...(state.bundledDemoAvailable ? [button('Use bundled demo', () => perform('Loading bundled application and GUI Driver', () => api('/api/execution/use-bundled-demo', {})), { secondary: true, disabled: state.run?.status === 'RUNNING', testId: 'use-bundled-demo' })] : []),
    ]),
  ]));

  const runActions = [];
  if (executionReady) {
    runActions.push(node('a', { className: 'text-link', text: 'Open GUI Driver', attrs: { href: state.artifactLinks.driver, target: '_blank' } }));
  }
  runActions.push(button(state.run ? 'Run again' : 'Run compiled tests', startRun, {
    testId: 'run-tests',
    disabled: !state.executionSetup.ready || state.run?.status === 'RUNNING',
  }));
  fragment.append(node('div', { className: 'toolbar' }, runActions));
  if (state.run?.status === 'ERROR') fragment.append(node('div', { className: 'error-inline', text: state.run.error }));
  if (state.run?.result) {
    const result = state.run.result;
    fragment.append(node('div', { className: `run-summary ${result.testVerdict.toLowerCase()}` }, [
      node('strong', { text: result.testVerdict }),
      node('span', { text: result.executionStatus }),
      node('span', { text: `${result.summary?.passed ?? 0} passed / ${result.summary?.failed ?? 0} failed / ${result.summary?.notEvaluated ?? 0} not evaluated` }),
    ]));
    if (state.artifactLinks.report) {
      fragment.append(node('a', { className: 'text-link', text: 'Open native Playwright report', attrs: { href: state.artifactLinks.report, target: '_blank' } }));
    }
    const table = node('div', { className: 'result-table' });
    for (const item of result.cases) {
      const details = node('details', { className: `result-row ${item.testVerdict.toLowerCase()}` });
      details.append(node('summary', {}, [node('span', { text: item.caseId }), node('strong', { text: item.title }), node('span', { className: 'verdict', text: item.testVerdict })]));
      const evidence = node('div', { className: 'evidence-list' });
      for (const record of item.evidence) {
        evidence.append(node('div', { className: record.passed ? 'evidence-pass' : 'evidence-fail' }, [
          node('code', { text: record.query.target }),
          node('span', { text: `Expected ${JSON.stringify(record.expected)}` }),
          node('span', { text: `Actual ${JSON.stringify(record.actual)}` }),
        ]));
      }
      if (item.error) evidence.prepend(node('div', { className: 'error-inline', text: item.error }));
      details.append(evidence);
      table.append(details);
    }
    fragment.append(table);
  }
  content.replaceChildren(fragment);
}

function render() {
  renderStages();
  [renderRequirements, renderDesign, renderReview, renderFreeze, renderCompile, renderRun][currentStage]();
}

document.querySelector('#save-edit').addEventListener('click', async (event) => {
  event.preventDefault();
  try {
    const testCase = JSON.parse(editSource.value);
    editDialog.close();
    await perform('Validating edited Test IR', () => api(`/api/cases/${encodeURIComponent(editDialog.dataset.caseId)}/edit`, { testCase }));
  } catch (error) {
    showError(error);
  }
});

try {
  state = await api('/api/status');
  render();
} catch (error) {
  showError(error);
}
