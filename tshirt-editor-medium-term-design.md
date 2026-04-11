# T-Shirt Editor Medium-Term Architecture

## Goal
Move the T-shirt preview/editor from destructive crop behavior toward a scalable editor model that:

- keeps the original uploaded file per side as the canonical source
- stores crop metadata separately from placement metadata
- preserves on-shirt placement when crop is applied
- keeps the existing real uploader, Cloudinary flow, metadata flow, and cart property flow intact

## Canonical Side State
Each side (`front`, `back`) should have its own editor state:

- `originalFile`
- `originalObjectUrl`
- `crop`
- rendered preview source used by the visible shirt editor

The key rule is:

- original upload remains the canonical design asset
- crop is editor metadata
- placement remains editor metadata
- the real uploader remains a compatibility sink for upload/property flow

## Crop Model
Crop should operate on the visible on-shirt design area.

When crop is applied:

1. capture the crop rectangle relative to the visible design wrapper
2. convert that crop rectangle into source coordinates on the original uploaded file
3. store those source coordinates as crop metadata
4. generate a cropped file from the original only for compatibility with the existing uploader flow
5. preserve the visible placement by compensating the wrapper center and size from the selected crop box

## Placement Preservation Rule
After crop apply, the visible selection should stay anchored in place.

Given:

- current wrapper center/size
- crop rectangle inside the wrapper

The next wrapper placement should be:

- center = selected crop center in canvas coordinates
- width = crop rectangle width
- height = crop rectangle height

This keeps the user-selected area visually stable on the shirt.

## Compatibility Strategy
The real uploader remains responsible for:

- Cloudinary upload
- metadata extraction
- line item properties
- cart properties
- validation

The custom editor should:

- preview from canonical editor state
- bypass preview-reset behavior when syncing cropped files back into the real input
- keep writing placement data for proof/cart usage
- write crop metadata into hidden properties for forward compatibility

## Validation Criteria
The architecture is considered correct when:

- upload still works through the real uploader
- crop no longer recenters or enlarges the design unexpectedly
- re-crop uses the original uploaded file, not the last cropped derivative
- proof rendering matches the visible cropped placement
- front/back remain independent
- variant-color sync remains unaffected
