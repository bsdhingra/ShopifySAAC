# AGENTS.md

## Project
Shopify Dawn 15.4.1 customization for a custom T-shirt preview/editor.

## Source of truth
- Read this file first and use it as the source of truth unless the current code clearly differs.
- Always inspect the current live code before changing anything.

## Current production status
Stable in production for front-only flow:
- upload works
- crop works
- cancel works
- upload is disabled during crop
- proof generation works
- add to cart works
- cart shows proof mockup image
- cart shows uploaded image
- custom message is preserved

## Current goal
Improve the T-shirt preview/editor UX without breaking the existing working upload flow, preview behavior, variant-color sync, Cloudinary flow, metadata flow, line item properties, or cart property flow.

## Key files
- `sections/main-product.liquid`
- `assets/cf-tshirt-preview-lite.js`
- `assets/custom-fields-uploader.js`
- `snippets/custom-fields-uploader.liquid`
- `assets/base.css`
- `snippets/product-media-gallery.liquid`
- `snippets/buy-buttons.liquid`

## Current architecture

### Visible editor
- The custom T-shirt preview/editor container is rendered in `sections/main-product.liquid`.
- The visible editor controls and crop behavior are handled in `assets/cf-tshirt-preview-lite.js`.
- The Start Designing gate is active and working.
- The visible upload buttons trigger the real hidden file inputs.

### Real uploader
- The real uploader inputs still live in `snippets/custom-fields-uploader.liquid`.
- The real uploader logic still lives in `assets/custom-fields-uploader.js`.
- The real uploader remains the source of truth for:
  - Cloudinary upload
  - metadata extraction
  - validation
  - hidden line item property values
  - cart property flow

### Preview and crop behavior
- Front and back states must remain independent.
- Front/back switching must update both the base mockup and the correct overlay state.
- Variant-color sync must continue to update the preview base correctly.
- Front-only products now use a gallery-native synthetic design preview slide for the large desktop preview; treat this as front-only behavior unless explicitly extended for front/back.
- Crop works on the visible on-shirt design area.
- The shirt should remain visible during crop.
- Upload must remain disabled while crop mode is active.
- After crop apply, the resulting file must be fed back into the real uploader input (`DataTransfer`) so downstream systems remain consistent.
- Canceling the native file picker must be treated as a true no-op:
  - do not clear preview
  - do not clear uploader state
  - do not clear hidden properties

## Deployment and testing workflow
- Use Shopify CLI preview theme for development and testing.
- Use `shopify theme push --store=... --theme ...` for production deploy.
- If `config/settings_data.json` differs, keep the remote version unless intentionally changing theme settings.
- Hard refresh after JS changes.
- Validate desktop and mobile for editor/upload/crop/proof changes.

## Product/tag model
Different print combinations are separate products.

Product configuration is tag-driven:
- `cf-tshirt-preview`
- `cf-config-front-only`
- `cf-config-back-only`
- `cf-config-front-back`

## Design note
- Medium-term editor architecture notes live in `tshirt-editor-medium-term-design.md`.
- Keep AGENTS.md concise; move deeper editor/crop architecture discussion there.

## Constraints
- Do not break:
  - upload flow
  - Cloudinary upload
  - metadata flow
  - validation
  - line item properties
  - cart properties
  - preview behavior
  - proof generation
  - variant color sync
  - front/back side logic
  - Start Designing gate
  - Dawn media gallery
  - thumbnails
  - slider logic
  - counters
- Proof Mockup URL must be correctly generated and populated before add to cart.
- Do not remove or bypass proof generation hooks unless replaced safely.
- Prefer minimal, reversible changes.
- Do not rewrite large files unless necessary.
- Do not remove working logic just to simplify UI.
- Prefer hiding/reusing existing uploader logic over reimplementing upload flow from scratch.

## Working preferences
- Always inspect current file contents before suggesting edits.
- Do not assume older code is still present.
- Use the current actual code as the source of truth.
- Suggest one safe step at a time unless asked otherwise.
- When debugging complex flows, prefer adding temporary logs before rewriting logic.
- When changing code, explain:
  - exact file
  - exact block to replace
  - why the change is needed
  - expected behavior after the change

## Workflow for Codex
For any task:
1. Inspect the current files first
2. Summarize how the current implementation works
3. Identify the smallest safe change
4. Explain the root cause of the issue
5. Propose a minimal fix
6. Only then edit code

## Done when
- only one visible upload experience remains
- file type/help text and upload status are still visible somewhere appropriate
- upload still works
- crop still works
- preview still works
- proof generation still works
- metadata/cart properties still work
- variant-color sync still works
- front/back behavior remains correct
- canceling the picker does not clear the working session
- add to cart still carries the uploaded design data
