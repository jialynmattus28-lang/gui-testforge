# Card Loss Demo PRD

## Purpose

Provide a synthetic, self-contained GUI flow for demonstrating requirements-first deterministic testing. The application does not connect to a bank, identity device, face service, card system, or production data.

## Requirements

### REQ-1 - Identity read

The user must complete a successful synthetic identity read before continuing. A failed read keeps the user on the identity screen and shows `IDENTITY_READ_FAILED`.

### REQ-2 - Face verification

The user must complete successful synthetic face verification before cards are shown. A failed verification keeps the user on the face screen and shows `FACE_VERIFICATION_FAILED`.

### REQ-3 - Card selection

All cards remain visible. Only a card in `normal` status is selectable. Cards in `lost` or `closed` status are disabled. Continuing without a selected card is blocked and shows `CARD_REQUIRED`.

### REQ-4 - Complete card loss

Submitting the correct synthetic password changes the selected card status from `normal` to `lost`, sets the business outcome to `SUCCEEDED`, and shows `CARD_LOST`.

### REQ-5 - Reject an incorrect password

Submitting an incorrect password shows `PASSWORD_INCORRECT`, keeps the business outcome at `IN_PROGRESS`, and does not change the selected card status.
