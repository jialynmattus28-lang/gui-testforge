# Guided Stage Transitions and Execution Gate Design

[English](2026-09-20-guided-stage-transitions-and-execution-gate-design.md) | [简体中文](2026-09-20-guided-stage-transitions-and-execution-gate-design.zh-CN.md)

**Date:** 2026-09-20
**Status:** Implemented and verified

## 1. Goal

Make the six-step Studio workflow move forward without unnecessary navigation while preserving explicit manual control. Reaching **Run and Trace** must not imply that execution is ready: execution requires both a running target application and a validated project-specific GUI Driver.

## 2. Considered Approaches

1. **Recommended: automatic progress plus a manual Next action.** Successful completion moves to the next stage, and every completed stage also exposes a Next button. Run and Trace has an independent execution-readiness gate.
2. Manual Next only. This is predictable but adds repetitive interaction to the five-minute demo.
3. Automatic progress only. This is fast but makes it harder to revisit and understand the boundary between workflow stages.

The first approach is selected because it supports both guided first-time use and deliberate expert navigation.

## 3. Navigation Rules

Each stage has one deterministic completion condition:

| Stage | Completion condition | Automatic destination |
| --- | --- | --- |
| Requirements | Requirements confirmed | Test IR Design |
| Test IR Design | A valid proposal set exists | Human Review |
| Human Review | Every case has a human decision | Freeze Asset |
| Freeze Asset | The approved Test IR asset is frozen | Compile |
| Compile | Native Playwright scripts compile and pass discovery | Run and Trace |
| Run and Trace | Native execution completes | None |

Every stage except the last also displays a **Next** button. It is disabled until the current completion condition is true. Users may still return to any unlocked earlier stage from the stage navigation.

## 4. Human Review

Human Review retains per-case approve, reject, edit, and AI-refine actions. It adds:

- **Approve all:** explicitly records a human approval for every current Test IR case, including cases that are pending or previously rejected. It is a deterministic batch workflow action, not an AI decision.
- **Next: Freeze Asset:** enabled only when every case has a current human decision.

Completing the final outstanding decision, including through Approve all, automatically opens Freeze Asset. The manual Next action remains available when the user returns to the completed review stage.

## 5. Execution Readiness Gate

Compile continues to require no GUI, target URL, or implemented Driver. Successful compilation opens Run and Trace with status **Waiting for application and GUI Driver**.

Run is disabled until both inputs have been supplied and validated:

1. **Target application URL:** a syntactically valid HTTP or HTTPS URL supplied by the user.
2. **GUI Driver:** a user-selected `.mjs` file exporting the required `createDriver` factory.

The Studio stores the selected Driver in its isolated workspace, validates the Driver contract, and records only non-secret readiness metadata in public state. Changing the target URL or Driver invalidates any previous run result.

The one-command repository demo retains its prebuilt application and Driver, but they are not silently activated. **Use bundled demo** is an explicit user action that configures both inputs. This preserves five-minute onboarding without misrepresenting the real handoff.

## 6. Error Handling

- Invalid or unsupported URL: display an inline error and keep Run disabled.
- Missing, non-`.mjs`, or invalid Driver export: display the validation error and keep Run disabled.
- Unreachable target: start no passing result; native Playwright reports the connection failure.
- Driver replacement: revalidate before execution and clear stale run output.
- Compilation remains `COMPILED / NOT_EVALUATED` regardless of execution readiness.

## 7. Testing

- UI tests verify automatic transitions and disabled/enabled Next actions.
- API tests verify Approve all and execution configuration validation.
- End-to-end demo tests explicitly choose Use bundled demo before Run becomes enabled.
- Existing integration tests continue proving compilation and discovery without a GUI or Driver implementation.

## 8. Acceptance Criteria

- Completing stages 1 through 5 automatically opens the next stage.
- Completed stages expose a working manual Next action.
- Approve all records explicit approvals for all current cases.
- Run and Trace can be opened after compilation but cannot execute without both handoff inputs.
- The bundled target and Driver are activated only through an explicit demo action.
- No AI participates in navigation, approval batching, readiness validation, execution, or verdicts.
