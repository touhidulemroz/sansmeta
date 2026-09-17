# Contributing

## Requirements

- Apple Silicon Mac (the build script assumes it)
- Xcode Command Line Tools (`xcode-select --install`)
- Python 3.10+
- `sips` and `iconutil` (bundled with macOS)

## Setup

No dependencies to install. The app uses system Python only; the engine is stdlib-only for its deterministic cleaners.

## Running the tests

```sh
python3 -m unittest discover -s tests -v
```

The integration tests exercise `app/bridge.py` against the real upstream engine and its fixtures. They write only into temporary directories.

## Building the app

```sh
bash scripts/build.sh
```

The result is `dist/Watermarks Cleaner.app`. It is ad-hoc signed for the build machine; it is not notarized for public distribution.

## Updating the upstream engine

The vendored engine is a pinned, unmodified snapshot of [guillaumemeyer/watermarks-remover](https://github.com/guillaumemeyer/watermarks-remover), reduced to what the app uses. To update it:

1. Clone or fetch upstream at the desired revision.
2. Replace `upstream/service/scripts/` with the new revision's `service/scripts/` (delete the old directory first so removed files don't linger).
3. Refresh `upstream/tests/fixtures/` if fixture files changed.
4. Update `upstream/LICENSE` if the license changed, and the pinned revision in the README.
5. Run `python3 -m unittest discover -s tests -v` and `bash scripts/build.sh`.
6. Sanity-check the built app: inspect and clean a fixture file, confirm the report renders.

Never edit files under `upstream/` in place — engine patches would break the unmodified-vendor guarantee and complicate future updates.

## Code conventions

- `app/WatermarksApp.swift` — single-file SwiftUI app; UI state lives in `AppModel`, engine calls go through `Engine.run` only.
- `app/bridge.py` — the adapter is the only component that talks to the engine; it accepts one JSON request on stdin and prints one JSON response.
- Tests are stdlib `unittest`; no test dependencies.
- UI text stays in the Swift file; there is no localization layer yet.
