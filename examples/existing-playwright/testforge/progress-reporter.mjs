import { appendFileSync, writeFileSync } from 'node:fs';

export default class TestForgeProgressReporter {
  constructor() {
    this.path = process.env.GUI_TESTFORGE_PROGRESS_REPORT;
    this.completed = 0;
  }

  onBegin(_config, suite) {
    if (!this.path) return;
    writeFileSync(this.path, `${JSON.stringify({ type: 'begin', total: suite.allTests().length })}\n`, 'utf8');
  }

  onTestEnd(test, result) {
    if (!this.path) return;
    this.completed += 1;
    appendFileSync(this.path, `${JSON.stringify({
      type: 'testEnd',
      current: this.completed,
      caseId: test.title.split(' · ')[0],
      status: result.status,
    })}\n`, 'utf8');
  }
}
