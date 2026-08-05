# DIY Charlotte Mason Blueprint Planner

A zero-dependency, single-page Charlotte Mason homeschool planner. Define
your family's children, school year, and category/book plan, and the app
computes pacing, generates a weekly schedule, and lets you print per-child
term schedules.

## Running it locally

No build step, no server required for basic use — just open
`CM_Blueprint_Planner_2026-27.html` directly in a browser.

**Note:** the app loads its shared logic from `lib/logic.mjs` as an ES
module. Some browsers block a `file://` page from importing local ES
modules due to CORS restrictions on the `file:` protocol. If the page loads
but the tabs don't render any data, serve the folder over local HTTP
instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/CM_Blueprint_Planner_2026-27.html
```

Data is stored in your browser's `localStorage` (key `cm_blueprint_data_v3`),
so it persists per-browser/per-device. Use **Export backup (.json)** /
**Import backup** to move data between browsers or keep a backup.

## Running the tests

Core pacing/scheduling/migration logic lives in `lib/logic.mjs`, a plain ES
module with no dependencies, so it can be tested directly with Node — no
npm install, no test framework:

```bash
node tests/logic.test.mjs
```

This runs a small custom test runner built on Node's built-in `assert`
module and prints pass/fail for each test.

## Project layout

- `CM_Blueprint_Planner_2026-27.html` — the app: HTML/CSS plus a
  `<script type="module">` that imports `lib/logic.mjs` and handles all
  rendering, persistence, and UI interaction.
- `lib/logic.mjs` — pure, dependency-free logic shared by the app and the
  tests: the `FamilySetup` data model, pacing math, frequency-based
  schedule inclusion, print-view data generation, and old-data migration
  and validation.
- `tests/logic.test.mjs` — Node-runnable test suite for `lib/logic.mjs`.

## Publishing with GitHub Pages

To view the planner via a shareable browser link instead of opening the
file locally:

1. Push this repo (or your branch) to GitHub.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Pick the branch you want to publish (e.g. `main`) and the folder `/ (root)`.
5. Save. GitHub will publish the site at
   `https://<your-username>.github.io/<repo-name>/CM_Blueprint_Planner_2026-27.html`
   within a minute or two.

Because the app loads `lib/logic.mjs` as a real HTTP module request, GitHub
Pages (which serves over `https://`) works without the `file://` CORS caveat
mentioned above.
