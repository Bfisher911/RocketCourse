# Course imagery implementation

## Current state

RocketCourse now treats imagery as versioned course content rather than a one-off upload. Every image belongs to a placement (`course_card`, `homepage_banner`, or `supporting`) and supporting images can additionally target a module, page, assignment, discussion, or quiz. The newest ready version is selected for export; previous versions remain available for restoration.

Uploads are available without spending AI credits. The browser validates file size and basic type, while the server decodes and re-encodes the image with Sharp, rejects animated files, enforces placement-specific formats, and records the user's rights acknowledgment. Source objects are private and returned through short-lived signed URLs.

Premium accounts can generate an essential, expanded, or custom set. Generation reserves credits atomically, uses idempotency keys, rate and spend limits, retries transient provider failures, refunds failed reservations, and stores provider request and usage metadata for support reconciliation. The OpenAI key and provider calls remain server-side. Generated alt text is explicitly presented as a suggestion that the course author must review.

## Placement specifications

| Placement | Working output | Accepted upload types | Export behavior |
| --- | ---: | --- | --- |
| Canvas course card | 1048 x 584 | JPEG, PNG, GIF | Included as a ready-to-upload file with Canvas assignment instructions because IMSCC cannot set the dashboard card |
| Homepage banner | 1200 x 400 | JPEG, PNG | Included and referenced from the homepage with an IMSCC package path |
| Supporting content | 1200 x 675 | JPEG, PNG | Included and referenced from the selected module, page, assignment, discussion, or quiz |

The editor exposes focus and zoom controls. Applying a crop creates a new derived version, preserving the original and earlier edits.

## Provider and economics

The default provider is OpenAI `gpt-image-2`. Medium generation costs one RocketCourse credit and high generation costs four. Provider unit costs, retry reserve, storage and processing, payment fees, support reserve, plan price, included credits, credit-pack price, and safety limits are editable in Super Admin. The live margin simulator shows revenue, expected cost, gross profit, margin, break-even utilization, and warning states without changing billing data.

Provider token usage is retained when returned. RocketCourse's configured unit cost is recorded as the estimated job cost; it is intentionally not labeled as provider-invoiced actual cost.

## Safeguards

- Default limits: 12 images per generation request, a hard request ceiling of 30, 100 images per course, 50 generated images per user per day, and 5 generation requests per minute.
- A monthly hard-spend ceiling blocks new reservations before calling the provider.
- Credit reservations and refunds are ledgered and idempotent.
- Subscription renewals reset included usage for the new billing period. Credit-pack consumption is reconciled before reset, and unused included credits roll into the auditable adjustment ledger only when the administrator enables rollover.
- Trial and institutional image allowances are enforced through subscription credit limits and update when Super Admin changes the corresponding configuration.
- Removing a target archives every active version so an older image cannot silently become active. Restoring a historical image creates a new current version.
- Images are private until export. Asset reads and download URLs require course ownership.

## Canvas export and current limitations

The IMSCC exporter embeds homepage and supporting images, adds their resources to the manifest, refreshes expired signed URLs, and validates missing alt text. Canvas does not expose course-card assignment through the IMSCC standard, so the export includes the card asset and a concise manual handoff. Automatic assignment requires a future authorized Canvas API integration and is not represented as complete.

Generation currently runs synchronously in the Netlify function. Closing the browser does not corrupt a reservation, but the upstream image request cannot be cancelled after submission. A durable queue would be the next step if long-running bulk generation or active cancellation becomes a product requirement.

## Verification

The implementation is covered by unit and integration tests for targeted asset selection, credit accounting, pricing scenarios, server authorization, upload validation, generation failure refunds, and IMSCC media references. Release verification should run type checking, linting, the full test suite, a production build, and authenticated staging smoke tests after applying the Supabase migration and configuring Stripe/OpenAI secrets.
