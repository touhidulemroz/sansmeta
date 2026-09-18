# Website Rebranding and SEO Plan

## 1. Project Scope

The website is the primary product and the only mandatory implementation target for this rebranding project.

### In scope

- Select a clear, marketable, SEO-friendly product name.
- Create a restrained, modern, relevant logo that fits the existing website.
- Replace the current water-drop identity across the website.
- Establish a coherent visual identity and brand voice.
- Improve on-page and technical SEO.
- Improve the landing-page information architecture and trustworthy product messaging.
- Verify the complete website experience on desktop and mobile.

### Out of scope for now

- No SwiftUI, macOS bundle, Dock icon, app name, packaging, signing, or Mac build changes.
- No changes to the core cleaning engine unless a website defect requires a separately approved fix.
- No claims that the product removes visible logos, pixel-level watermarks, or guarantees AI-detector outcomes.

### Deferred macOS alignment

After the website brand is approved and launched, the following may be carried into the Mac app in a separate project:

- Approved product name and tagline
- Approved logo and app-icon adaptation
- Brand colors and typography direction
- User-facing terminology and scope language

These items are recorded only for future consistency. They are not part of the current implementation.

## 2. Current Website Baseline

The original website baseline was a React/Vite frontend with a FastAPI backend branded **Watermarks Cleaner**, with an indigo-to-cyan tile and white water-drop logo. It communicated no account requirement, preservation of originals, temporary server storage, supported formats, and honest limitations; the retention model has since been replaced by the completed privacy-first lifecycle documented below.

The rebrand should preserve those strengths while fixing the following gaps:

- The name is generic and may create expectations of visible-watermark removal.
- The water-drop symbol is visually polished but not meaningfully connected to metadata, provenance, privacy, or safe file cleaning.
- The HTML currently has only a basic page title and favicon; it lacks a complete search and social metadata foundation.
- The product story needs a clearer search-oriented hierarchy without becoming keyword-stuffed or making unsupported claims.
- The single-page tool experience needs crawlable explanatory content and trust information around the utility.

## 3. Phase 1 — Brand Strategy and Naming

### 3.1 Define the positioning

Position the product as a privacy-conscious online utility for inspecting and cleaning supported hidden metadata, provenance fields, and invisible text characters while preserving the original file.

The brand should emphasize:

- Hidden metadata cleanup
- File privacy and control
- Inspect-before-clean workflow
- Separate, safe output copies
- Broad file-format support
- Honest technical boundaries

The brand must not imply:

- Removal of visible graphical watermarks or logos
- Removal of every type of AI watermark
- Guaranteed bypass of AI detection or platform labeling
- Fully local/browser-only processing when the deployed website processes files on its server

### 3.2 Generate the naming shortlist

Create 8–12 candidates across three naming directions:

1. **Descriptive:** immediately communicates metadata or file cleaning.
2. **Suggestive:** conveys clarity, privacy, or clean files without being overly literal.
3. **Distinctive coined name:** more ownable and brandable, supported by a descriptive tagline.

Each candidate will be scored on:

- Relevance to the actual product
- Search intent and keyword adjacency
- Memorability and ease of spelling
- Pronunciation and international usability
- Visual/logo potential
- Ability to expand beyond the current feature set
- Domain and social-handle availability
- Search-result competition
- Obvious product/company conflicts
- Preliminary trademark risk

### 3.3 Naming deliverable and approval gate

Present the best 3–5 candidates with:

- Name rationale
- Recommended tagline
- Primary SEO phrase and supporting phrases
- Advantages, risks, and possible confusion
- Domain options
- Preliminary conflict findings
- Recommended winner

**Approval gate:** no product name, logo, copy, metadata, or code will be changed until the final name and positioning are approved.

## 4. Phase 2 — Logo and Visual Identity

### 4.1 Logo direction

Replace the current water-drop logo with a minimal, modern, vector-first mark relevant to the product. The preferred conceptual territory is:

- A file/document frame combined with a precise cleaning or inspection gesture
- A metadata layer, hidden-data line, or structured-field motif
- A subtle shield/check/clean-cut symbol used only if it remains distinctive

Avoid:

- Water drops
- Generic AI stars as the main idea
- Robot heads, neural-network brains, magic wands, glowing gradients, or 3D effects
- Busy shield-lock-file combinations
- Fine details that disappear at favicon size
- Image-generator artifacts or an “AI slop” aesthetic

### 4.2 Design requirements

- Geometric, restrained, and recognizable
- Designed as editable SVG, not as a raster-only generated image
- Works at 16, 24, 32, 48, and 128 px
- Works in one color before color is added
- Clear on both light and dark surfaces
- Includes a standalone symbol and horizontal wordmark arrangement
- Visually compatible with the website’s clean, low-noise interface
- Accessible contrast and no reliance on color alone

### 4.3 Logo approval process

1. Produce 2–3 genuinely different monochrome concepts.
2. Show each in header, favicon, and small-size contexts.
3. Select one concept and refine geometry, spacing, and color.
4. Export the approved SVG and required favicon/social-preview assets.
5. Replace the website logo only after approval.

### 4.4 Supporting brand system

Define a small, implementation-ready system:

- Primary and neutral colors
- Semantic success, warning, error, and processing colors
- Typography stack
- Spacing and corner-radius principles
- Icon style
- Brand voice and terminology
- Short tagline, one-sentence description, and longer product description

This should refine the current interface rather than redesign it for novelty.

## 5. Phase 3 — SEO Strategy

### 5.1 Keyword and competitor research

Research the live search landscape after the naming direction is approved. Separate keywords by intent:

- **Primary product intent:** metadata cleaner, file metadata remover, remove metadata online
- **Feature intent:** EXIF/XMP cleanup, C2PA metadata inspection, invisible Unicode cleaner
- **Format intent:** image metadata cleaner, document metadata cleaner, video metadata cleaner, text watermark character cleaner
- **Trust intent:** preserve original file, private metadata cleanup, automatic file deletion

Only target phrases supported by the product’s real capabilities. Avoid building the brand around misleading high-volume terms such as visible watermark removal.

### 5.2 Page and content structure

Create a search-friendly page hierarchy around the tool:

- Clear H1 focused on the main user outcome
- Concise value proposition and primary action above the fold
- How it works
- Supported files and metadata types
- What it handles and does not handle
- Privacy and file-retention explanation
- Frequently asked questions
- Useful format-specific or task-specific landing pages only where content is genuinely distinct
- About, privacy, terms, and contact/support pages before public marketing

The upload tool must remain immediately accessible; SEO content should support it rather than bury it.

### 5.3 Technical SEO foundation

- Unique, descriptive `<title>` and meta description
- Canonical URL
- Indexing directives appropriate to production and non-production environments
- Open Graph and social-card metadata
- Web app icons and favicon set based on the approved logo
- `robots.txt`
- `sitemap.xml`
- JSON-LD structured data appropriate to the final site, such as `WebApplication`, `Organization`, and evidence-backed FAQ markup
- Correct heading hierarchy and semantic landmarks
- Descriptive link and button labels
- Accessible image alternatives
- Human-readable production URL and consistent HTTPS origin
- Custom 404/error handling where applicable
- No indexing of job IDs, temporary downloads, API routes, or user-generated file locations

### 5.4 Performance and crawlability

- Keep the initial JavaScript and asset payload small.
- Optimize fonts, icons, logo, and social-preview assets.
- Prevent layout shifts by reserving media dimensions.
- Verify Core Web Vitals on desktop and mobile.
- Ensure important marketing copy is available to search crawlers; consider prerendering or a static marketing shell if the SPA alone is insufficient.
- Keep tool-state and analytics code from blocking meaningful initial content.

## 6. Phase 4 — Website UX, Copy, and Trust

### 6.1 Header and navigation

- Apply the approved name and logo.
- Retain a compact Files/Text mode switch or replace it with an equally clear interaction.
- Add only essential navigation, such as How it works, Supported formats, Privacy, and FAQ.
- Keep the primary cleaning action visually dominant.

### 6.2 Hero section

- Use one specific, search-relevant H1.
- Explain the supported cleaning scope in plain language.
- Make upload/choose-files the unmistakable primary action.
- Surface the most important trust facts close to the action.
- Avoid describing server processing as local or private-by-design without the necessary qualification.

### 6.3 Product explanation

- Preserve the Inspect → Clean → Download model.
- Explain that outputs are separate copies and originals are not modified.
- Distinguish hidden metadata/provenance from visible watermarks.
- Explain file retention and deletion accurately.
- Make format support easy to scan without overwhelming the hero.

### 6.4 Conversion and confidence

- Add a compact FAQ answering capability, privacy, retention, quality, and format questions.
- Add visible links to privacy, terms, source/license attribution, and support/contact destinations.
- Include truthful processing and failure states.
- Avoid fabricated testimonials, usage counts, security certifications, or guarantees.

### 6.5 Accessibility and responsive behavior

- Keyboard-accessible upload and mode controls
- Visible focus states
- Screen-reader status for upload, inspection, cleaning, errors, and completion
- Appropriate contrast and touch-target sizes
- Reduced-motion support
- Responsive layouts for common phone, tablet, laptop, and wide-desktop widths
- No clipped copy, horizontal scrolling, or inaccessible drag-and-drop-only flows

## 7. Phase 5 — Implementation Sequence

Implementation should proceed only after the naming and logo approval gates.

1. Record the approved brand name, positioning, tagline, keywords, and asset specifications.
2. Add the approved SVG logo, favicon set, and social image.
3. Introduce shared brand/design tokens.
4. Update website-visible name, logo alternatives, copy, and footer attribution.
5. Refine the landing-page structure and add approved trust/FAQ content.
6. Add metadata, canonical handling, structured data, robots, and sitemap.
7. Add required supporting public pages.
8. Optimize loading and crawlability.
9. Run the complete verification checklist.
10. Deploy to a preview environment for approval before production release.

Existing uncommitted website work must be reviewed and preserved. Rebranding changes should not overwrite unrelated work.

## 8. Verification and Acceptance Criteria

### Brand consistency

- No unintended references to the previous website name or water-drop identity remain.
- The approved product name and tagline are consistent across visible copy, metadata, assets, and social previews.
- The logo remains legible at favicon and mobile-header sizes.
- Claims match the actual backend behavior and supported engine capabilities.

### SEO

- Production pages have correct titles, descriptions, canonical URLs, and index directives.
- Sitemap and robots files resolve correctly.
- Structured data validates without unsupported claims.
- Social previews render the approved name, description, and image.
- Search crawlers can access meaningful product content.
- Temporary job/download/API URLs are not indexable.

### Functional

- Files mode and Text mode still work end to end.
- Inspect, clean, cancel, individual download, and zip download are verified.
- File-size, batch-size, unsupported-format, timeout, and server errors are understandable.
- Originals remain unaffected and retention behavior matches the public copy.

### Visual and responsive

- Review at representative desktop, tablet, and mobile widths.
- Check light/dark logo applications even if the initial site remains light-only.
- No overflow, layout shift, blurred assets, or illegible small text.
- Loading, empty, success, warning, and error states follow the brand system.

### Quality checks

- Frontend type checking and production build pass.
- Backend/API tests pass.
- Automated accessibility and performance audits are reviewed.
- Browser console and network requests show no unexplained errors.
- Final manual browser walkthrough is completed on desktop and mobile.

## 9. Planned Deliverables

- Naming research matrix and recommended name
- Approved positioning statement and tagline
- Primary and supporting SEO keyword map
- Editable SVG logo and wordmark
- Favicon/app-web-icon set and social-preview image
- Website brand tokens and copy guide
- Updated website UI and landing-page content
- Technical SEO implementation
- Supporting trust/legal/information pages approved for launch
- Desktop and mobile verification report
- Deferred macOS brand-alignment note, with no Mac implementation

## 10. Decisions Required Before Implementation

The following decisions must be approved before code or brand assets are changed:

1. Final product name
2. Primary brand positioning
3. Tagline
4. Logo concept
5. Primary color direction
6. Production domain or preferred domain shortlist
7. Required public pages and legal/privacy wording
8. Whether the marketing content remains within the current SPA or uses a prerendered/static public shell

## 11. Recommended Immediate Next Step

Begin with **Phase 1 only**: live name, search-result, domain, social-handle, and preliminary conflict research. Present the shortlist and recommendation for approval. Do not modify the website or macOS app during that research phase.

---

# Website Rebranding — Implementation Completed

> Status: implemented and verified (2026-09-18). See sections 1–11 above for the original plan and decision gates. All brand decisions below were fixed by the product owner before implementation; no code or assets were invented to fill gaps the owner had not approved.

## Fixed brand decisions (pre-approved)

- Brand name: **SansMeta**
- Tagline: **Remove Hidden AI Metadata Online for Free**
- Logo concept: the approved raster concept in `web/branding/sansmeta-logo-concept.png`. Production assets are derived from it (not redesigned) by `web/branding/generate_assets.py`. A hand-built vector SVG of the mark is **still future work** (asset gap — see below).

## What changed

### Branding & visual system
- Replaced the water-drop identity across header, footer, title, metadata, errors, tool UI.
- Derived production assets from the approved concept: `public/logo-mark.png`, `favicon.ico`/`favicon-32.png`/`favicon-192.png`/`icon-512.png`, `apple-touch-icon.png`, `og-image.png`, `manifest.webmanifest`. Removed the old `public/logo.svg`.
- Applied a flat indigo primary (`#4f46e5`), removed the indigo→cyan gradient, added main nav (`How it works / Formats / Privacy / FAQ`), consistent buttons/cards/borders/focus states/responsive rules.

### Copy & landing structure
- New hero, eyebrow tagline, and single clear H1. Sections: How it works, Supported formats, What it handles/doesn't, Metadata vs. watermarks (hidden metadata / invisible Unicode / visible / pixel-level), Privacy & file handling, FAQ.
- Honest scope copy; explains invisible Unicode is not always AI-generated; no claims of visible/logo/pixel watermark removal, AI-detector bypass, or guaranteed lossless processing.

### Trust & privacy
- Backend-accurate privacy copy (server-side processing, response-completion/manual/start-over deletion, token-protected job links, configurable fallback capped at 15 minutes, no account, limits).
- New static privacy page at `/privacy/` mirroring implementation.
- Consent-gated analytics: GA script loads only on explicit accept; aggregate events only — filenames, contents, pasted text, download tokens never sent.

### On-page SEO
- Descriptive title + meta description; one H1; logical heading hierarchy; semantic landmarks; descriptive nav/image alt text; FAQ matching JSON-LD; unique titles for `/privacy/` and 404.

### Technical SEO
- Prerendered landing HTML baked into `dist/index.html` at build time (React SSR via `react-dom/server`), so meaningful content is in the initial HTML; browser hydrates.
- Origin-dependent canonical, Open Graph, Twitter tags, `robots.txt`, `sitemap.xml` injected by the backend from `WEB_PUBLIC_ORIGIN` — all omitted when unset so previews never advertise an invented domain.
- `WebApplication` + `FAQPage` JSON-LD (no fake reviews/ratings).
- 404 returns styled HTML 404 (status 404); unknown `/api/*` returns JSON 404; `/api` responses are `no-store` + `X-Robots-Tag: noindex`.

## Verification results

- Frontend `tsc --noEmit` + `vite build` + prerender: pass. 46 modules, clean build.
- Backend: **26/26 tests pass** (existing + new SEO/trust tests).
- Crawl checks (with `WEB_PUBLIC_ORIGIN`): canonical, og, twitter, robots.txt, sitemap.xml all present; without origin all omitted; `/api` 404s JSON, missing pages return HTML 404; `/privacy/` and redirects (`/privacy` → `/privacy/`, `/index.html` → `/`) work.
- Browser (agent-browser, headless Chromium): home hydrates with full content, nav/mode-switch/consent banner present; **no GA request before consent** (consent gating works); no console errors. Text flow (paste → clean → copy) works. Files flow: upload marked PNG → inspect found marks (report expands) → clean → valid `.zip` with `marked.cleaned.png` (OpenAI tag removed, pixels intact, PIL-valid PNG). Mobile (iPhone 14) renders; skip-link + Tab focus work.
- Accessibility: axe-core **0 violations**, 1 incomplete (fixed-position consent banner color-contrast — false negative; measured ratio 6.86:1, passes WCAG AA).
- Screenshots captured for desktop + mobile (could not be read — weekly vision-tool limit reached; layout verified via accessibility snapshots instead).

## Gaps & remaining items

1. **Production domain not configured** — `WEB_PUBLIC_ORIGIN` is empty. Canonical/social/sitemap only populate once the real origin is set in the deployment env and re-deployed. No domain was invented.
2. **Vector SVG logo** — only the raster concept exists; the favicon/mark set is raster-derived. A hand-built editable SVG of the mark and lockup is future work.
3. **Small-size favicon optical review** — set derived and sanity-checked at 16/32px but not brand-owner validated at favicon size.
4. **macOS app alignment** — name, tagline, logo, colors, terminology are recorded for a future separate Mac project; the Mac app, its bundle, packaging, and the shared engine were **not** modified.
5. **No deploy** — not deployed or pushed; no external service modified.
6. **Screenshots not visually read** — vision-tool weekly limit hit; layout verified via accessibility-tree snapshots instead. Manual visual review recommended before production.

---

# Website Temporary-File Privacy Lifecycle — Completed

Status: implemented and verified locally (2026-09-18). This work applies only to
the SansMeta website. The native macOS application and shared cleaning engine
remain deferred and unchanged.

## Implemented behavior

- Every clean job receives a random job ID plus a separate 256-bit access token.
  Status, download, cancellation, and deletion operations require both; invalid
  credentials are indistinguishable from expired jobs on read routes, while
  deletion stays idempotent and returns a non-disclosing success response.
- An individual download deletes that exported server file only after its response
  completes. Other files in the same batch remain available; the workspace is
  removed after the final cleaned file is downloaded.
- A completed ZIP response deletes the generated ZIP and the entire job workspace
  in response-completion background cleanup.
- “Clear & delete files,” starting over, switching away from the file session, and
  beginning another clean batch request cleanup for the previous job. Manual
  deletion distinguishes server-confirmed removal from a request that was merely
  accepted/deferred.
- Page hide/close sends a best-effort `sendBeacon` request, with keepalive fetch as
  a fallback. The UI and privacy copy explicitly avoid guaranteeing confirmation.
- Cleanup requested while a worker is processing or a response is streaming sets
  cancellation/deletion state and waits until the active work or streams release
  their leases, preventing mid-write or mid-response deletion.
- The automatic fallback is configurable with `WEB_JOB_TTL_SECONDS`, constrained
  to 1–900 seconds, and defaults to 900 seconds (15 minutes). Each job schedules an
  expiry timer; periodic sweeping and startup orphan cleanup remain defense in depth.
- The public `/api/config` exposes only effective non-secret limits and retention,
  and the live React copy uses that value. Static privacy/structured-data pages use
  a server-replaced retention placeholder so deployed copy matches configuration.
- Pasted text is sent directly to the text-cleaning call and returned in its HTTP
  response; it is not written into a job workspace or retained by the website.

## Download-flow decision

The existing product supports individual downloads and a complete ZIP. Deleting
the entire job after the first individual file would break legitimate multi-file
workflows, so individual responses delete only the delivered export. The complete
ZIP response deletes the whole job. A prominent manual delete/start-over action
and the fallback expiry cover abandoned partial batches.

## Verification scope

Backend coverage includes individual and ZIP response-completion cleanup, manual
and repeated deletion, token isolation, active-job deferral, configured expiry,
failed immediate cleanup followed by expiry, cancellation, invalid/expired jobs,
and public configuration. Frontend production build and desktop/mobile browser
flows cover cleaning, downloading, deletion, start-over/new-batch cleanup,
best-effort page-abandonment requests, and expired-job messaging.
