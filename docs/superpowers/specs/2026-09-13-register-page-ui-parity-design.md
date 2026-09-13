# Register Page UI Parity Design

## Goal

Bring `/register` visually in line with the approved `feat/ui-ux` register design while keeping the current local implementation safe and functional. The page remains an email-free Base Mainnet hardware prebooking flow.

## Scope

- Recreate the branch's full-bleed meadow background, dark vignette, editorial eyebrow/title, and glassmorphic two-column composition.
- Expand the primary card with the branch's wallet status bar, hardware quantity/pricing block, network and balance state, action-state messaging, and transaction confirmation treatment.
- Add the branch's right-side hardware specification, security benefits, allocation metadata, and queue telemetry panel.
- Preserve the current wallet connection, Base network switching, USDC approval, prebooking contract call, queue reads, and transaction explorer link.
- Keep email fully disabled: no email field, email import, `/api/send-email` request, or email API key usage.
- Keep mobile responsive: collapse to one column, preserve readable controls, and allow natural page scrolling when the content exceeds the viewport.

## Non-Goals

- Do not copy the branch's email or receipt implementation.
- Do not change the deployed prebooking contract address or Base/USDC constants.
- Do not modify `/receive`, `/audio-test`, ENS resolution, Arc settlement, or hardware audio behavior.

## Component Design

The existing `Register` page remains the single route component. Its transaction handlers and state model remain authoritative; the JSX is reorganized into three visual regions:

1. Page atmosphere: full viewport meadow image, dark green wash, and fixed-header-safe top padding.
2. Prebooking card: heading, wallet/network status, quantity and price controls, balance/queue feedback, primary wallet action, and transaction confirmation.
3. Terminal allocation card: hardware specifications, security claims, queue number, unit count, USDC balance, and contract configuration status.

No new email or backend boundary is introduced.

## Interaction States

- Disconnected: show `Connect wallet`.
- Connected on another chain: show `Switch to Base`.
- Connected on Base: show the prebooking action; disable it if the contract address is missing.
- Approval or prebooking pending: show the existing transaction status and prevent duplicate actions.
- Confirmed: show the transaction hash and BaseScan link inline; do not dispatch email.
- Failure: show the existing actionable wallet/transaction error inside the card.

## Responsive Layout

- Desktop: two columns with the form card slightly wider than the allocation card, both vertically balanced below the fixed navbar.
- Mobile/tablet: one column, with the allocation card below the form; no fixed-height clipping.
- All routed utility pages retain their existing full-height/header-offset treatment.

## Verification

- TypeScript build must pass.
- Existing protocol, Arc, ENS, and hardware tests must pass.
- No client source may reference Brevo, Resend, `/api/send-email`, or `VITE_RESEND_API_KEY`.
