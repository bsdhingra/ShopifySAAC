# AGENTS.md

## Project
Shopify Dawn 15.4.1 customization project for:
- custom T-shirt / polo preview/editor
- tumbler customizer / wrap preview flow
- future personalized product customizers such as mugs and similar products

## Source of truth
- Read this file first and use it as the source of truth unless the current code clearly differs.
- Always inspect the current live code before changing anything.
- If current code differs from this file, prefer the current code, then update this file later so future work stays aligned.

---

## Current production status

### Stable in production for front-only apparel flow
- upload works
- crop works
- cancel works
- upload is disabled during crop
- proof generation works
- add to cart works
- cart shows proof mockup image
- cart shows uploaded image
- custom message is preserved

### Tumbler flow
- treat tumbler logic as separate from T-shirt logic
- do not assume apparel side/front-back rules apply to tumbler wrap behavior
- preserve existing tumbler behavior unless the task explicitly changes tumbler flow

---

## Current goal
Improve the product customizer UX and reliability without breaking:
- upload flow
- preview behavior
- finalize / proof flow
- variant-color sync
- Cloudinary flow
- metadata flow
- cart property flow
- product-specific customizer behavior

---

## Key files

### Apparel / T-shirt preview system
- `sections/main-product.liquid`
- `assets/cf-tshirt-preview-lite.js`
- `assets/custom-fields-uploader.js`
- `snippets/custom-fields-uploader.liquid`
- `assets/base.css`
- `snippets/product-media-gallery.liquid`
- `snippets/buy-buttons.liquid`

### Tumbler / wrap system
- treat tumbler JS/CSS/Liquid files as a separate product customizer family
- inspect actual tumbler files in the repo before making changes
- do not assume apparel rules or file names apply automatically

---

# CRITICAL GLOBAL SYSTEM RULES (DO NOT BREAK)

## 1. Always inspect current state before editing
Before changing code, identify:
- source-of-truth state
- proof/render state
- submit/add-to-cart gating
- uploader/source data flow
- hidden line item property flow
- product-specific invalidation rules

Do NOT guess.

---

## 2. Do not create parallel state models
- Do NOT add a second competing state model if current code already has one.
- Reuse current proof/render/finalize helpers where safe.
- Reuse current uploader/property flow where safe.

---

## 3. Prefer minimal, reversible changes
- Do not rewrite large files unless necessary.
- Do not remove working logic just to simplify UI.
- Prefer minimal surgical fixes over broad refactors.

---

## 4. Do not duplicate listeners or submit paths
- Do NOT duplicate event listeners
- Do NOT duplicate submit handlers
- Do NOT introduce a second add-to-cart path
- Do NOT introduce race conditions by stacking async flows

---

## 5. Product-specific behavior must stay product-specific
- Do not force T-shirt assumptions onto tumbler flow
- Do not force tumbler assumptions onto T-shirt flow
- Keep front/back logic separate from wrap/triptych logic

---

# APPAREL / T-SHIRT / POLO RULES

## 1. Finalize / Proof State Rules
- Proof is NOT valid until user clicks **Finalize Design**
- Proof-ready state must ONLY be set after:
  - finalize is complete
  - required proof(s) exist

- "Generating preview..." is a temporary state only
- It must NEVER persist after proof is available
- Ready state must override stale generating state

---

## 2. Side Independence Rules
Front and back are independent states.

If user edits only one side:
- ONLY that side becomes invalid
- The other side must remain valid and visible if color/base did not change

Example:
- front finalized → visible
- user edits back → front proof must remain visible

Do NOT hide a valid untouched side just because the user started editing the other side.

---

## 3. Required Side Logic (DO NOT CHANGE)
- front-only product → require front proof only
- back-only product → require back proof only
- front-back product:
  - if only front used → require front only
  - if only back used → require back only
  - if both used → require both

Do NOT wait for a non-required side.

---

## 4. Color / Base Change Rules
Color change is a shared dependency change.

When color changes:
- invalidate BOTH front and back proofs
- clear finalized state
- disable Add to Cart
- REQUIRE user to finalize again

Do NOT:
- auto-promote regenerated proofs to ready
- show proof-ready state without user finalize
- silently keep proofs as approved after color/base changes

---

## 5. Proof Display Rules
Show ONLY real generated proofs.

Do NOT show fake blank proof placeholders by default.

Cases:
- front-only → show front proof only
- back-only → show back proof only
- both → show both
- one side valid + one side being edited → keep valid proof visible and communicate pending side via text/state

---

## 6. Crop Mode Rules
Crop mode = temporary blocking state.

While crop is active:
- Finalize must be disabled
- Add to Cart must be disabled
- user must:
  - Apply crop OR
  - Cancel crop

Do NOT allow finalize during crop mode.

---

## 7. Add to Cart Gating Rules
Add to Cart must be enabled ONLY when:
- design is finalized
- required proof(s) exist
- no pending crop
- no invalidated state
- no missing required side

Add to Cart must be disabled when:
- generating
- crop pending
- proof invalid
- missing required side
- color/base changed and re-finalize is required

---

## 8. State Priority Rules
Priority must be:

1. BLOCKER / ERROR
   - crop pending
   - missing required proof
   - invalidated state
2. GENERATING
3. READY

READY must override stale GENERATING once required proofs are actually available.

---

## 9. Upload Rules
The uploader remains the source of truth for:
- Cloudinary upload
- metadata extraction
- validation
- hidden line item properties
- cart property flow

Current upload limit:
- image files over `10MB` are not supported in the normal uploader flow
- user-facing messaging must state this clearly instead of silently attempting upload
- if preview/proof still continues for UX, the user must still be told clearly when final production image must be sent offline

---

## 10. UI Messaging Rules
- Customizer area = STATUS only
- Add to Cart area = ACTION only
- Do NOT duplicate the same long instruction in multiple places

Examples:
- customizer → "Front design ready"
- CTA area → "Satisfied with your design?"

---

## 11. Known apparel failure patterns to avoid
- proof disappears when switching sides
- generating stuck after proof ready
- Add to Cart visually enabled but functionally blocked
- color change auto-approves proof
- crop mode allows finalize
- untouched side shown as fake blank proof

---

# TUMBLER / WRAP CUSTOMIZER RULES

## 1. Tumbler flow is a separate product family
- Treat tumbler customizer as independent from T-shirt/polo logic.
- Do not apply front/back apparel assumptions to tumbler unless explicitly required.

---

## 2. Source asset vs preview asset vs proof asset must remain separate
For tumbler flow, always distinguish between:
- full-resolution source design
- visual preview panels / triptych preview
- generated proof/render image
- cart/display image

Do NOT mix these concepts.

---

## 3. Preserve full-resolution production source
If tumbler flow depends on a full wrap design:
- preserve the full-resolution source
- do not replace it with only split preview panels
- preview panels may be derived display assets, not the production source of truth

---

## 4. Triptych / panel preview rules
If tumbler preview uses multiple panels (left / center / right):
- those panels are preview/display artifacts
- they should not become the only production data unless the code explicitly requires that
- do not distort the source image to fit panel previews

---

## 5. Tumbler invalidation rules
Any shared dependency change in tumbler flow should invalidate all dependent renders/proofs.

Examples:
- wrap source changed
- placement changed in a way that affects proof output
- base product or shared render dependency changed

Do NOT silently keep stale proof/render assets after shared dependency changes.

---

## 6. Tumbler Add to Cart goal
For tumbler flow:
- preserve full-resolution source and placement data for production
- avoid blocking Add to Cart unless the task explicitly requires a gated proof flow
- if proof generation is deferred/non-blocking, cart property flow must still remain correct and consistent

---

## 7. Tumbler performance rules
- avoid image distortion
- avoid desktop regressions
- keep mobile interaction smooth
- if heavy preview/proof work is needed, prefer minimizing blocking behavior
- do not add unnecessary live re-renders during drag/resize/editing

---

## 8. Tumbler cart/display rules
- cart/display should reflect the intended preview/proof logic for tumbler products
- do not confuse proof image, preview image, and production source image
- keep cart property naming and display behavior aligned with actual tumbler flow

---

## 9. Known tumbler failure patterns to avoid
- blocking Add to Cart while waiting on heavy proof generation
- losing full-resolution source
- using only preview panels as production source
- image distortion
- stale proof/render after shared dependency change
- mixed or inconsistent cart property mapping

---

# FUTURE PRODUCT CUSTOMIZER RULES

For mugs and future custom products:
- first determine whether the product behaves like:
  - side-based apparel
  - wrap-based drinkware
  - single-surface proof product
- define the correct dependency model before coding
- define:
  - source asset
  - preview asset
  - proof asset
  - submit/cart state
- do not reuse apparel or tumbler rules blindly without validating fit

---

# PREVIEW / PROOF / CART RULES (ALL CUSTOMIZERS)

## 1. Keep cart property flow intact
Do not break:
- line item properties
- hidden property values
- cart proof/mockup display
- uploaded image references
- custom messages

---

## 2. Add to Cart must reflect real readiness
- Do not let the button look ready when state is blocked
- Do not leave it disabled after readiness is achieved
- Avoid mismatches between:
  - visual button state
  - disabled attribute
  - aria-disabled
  - actual submit behavior

---

## 3. Re-evaluate state after proof/render completion
Whenever proof/render is stored:
- immediately re-check required readiness
- immediately re-check gating
- immediately update status/action UI

Do not wait for extra user interaction to fix stale state.

---

# DEPLOYMENT AND TESTING WORKFLOW
- Use Shopify CLI preview theme for development and testing.
- Use `shopify theme push --store=... --theme ...` for production deploy.
- If `config/settings_data.json` differs, keep the remote version unless intentionally changing theme settings.
- Hard refresh after JS changes.
- Validate desktop and mobile for editor/upload/crop/proof changes.

---

# PRODUCT/TAG MODEL
Different print combinations are separate products.

Current apparel configuration is tag-driven:
- `cf-tshirt-preview`
- `cf-config-front-only`
- `cf-config-back-only`
- `cf-config-front-back`

Do not assume tumbler or future products use the same tag model unless current code confirms it.

---

# DESIGN NOTE
- Medium-term editor architecture notes live in `tshirt-editor-medium-term-design.md`.
- Keep AGENTS.md concise enough to be usable, but include rules that prevent repeated state/UX bugs.

---

# CONSTRAINTS
Do not break:
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
- tumbler source asset flow
- tumbler preview logic
- tumbler placement data flow

Proof/preview state must be correctly generated and populated before or during add to cart according to the product’s own architecture.
Do not remove or bypass working proof/render hooks unless replaced safely.
Prefer minimal, reversible changes.
Do not rewrite large files unless necessary.
Prefer hiding/reusing existing uploader logic over reimplementing upload flow from scratch.

---

# WORKING PREFERENCES
- Always inspect current file contents before suggesting edits.
- Do not assume older code is still present.
- Use the current actual code as the source of truth.
- Suggest one safe step at a time unless asked otherwise.
- When debugging complex flows, prefer adding temporary safe logs before rewriting logic.
- When changing code, explain:
  - exact file
  - exact block to replace
  - why the change is needed
  - expected behavior after the change

---

# WORKFLOW FOR CODEX
For any task:
1. Inspect the current files first
2. Summarize how the current implementation works
3. Identify the smallest safe change
4. Explain the root cause of the issue
5. Propose a minimal fix
6. Only then edit code

For product-specific tasks:
- first identify product family:
  - apparel side-based
  - tumbler wrap-based
  - other
- then apply only the relevant rules

---

# DONE WHEN
- upload still works
- crop still works
- preview still works
- proof/render generation still works
- metadata/cart properties still work
- variant-color sync still works
- front/back behavior remains correct
- tumbler source asset and preview behavior remain correct
- canceling the picker does not clear the working session
- add to cart still carries the correct design/customization data
- state behavior is predictable
- no stale or misleading proof-ready states remain
