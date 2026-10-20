# Contributing

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug or idea

Open an issue and pick the matching template. For time-zone bugs, please include the city, the
date and time you entered, what you expected, and what you saw.

## Working on the code

You need **Node.js 22.12 or newer** and Chrome 120+.

```sh
npm ci                            # install exact dependency versions
npm test                          # unit tests
npm run build                     # type check + build → dist/meridian-clock/
npx playwright install chromium   # once
npm run test:e2e                  # browser tests against the built extension
```

Load `dist/meridian-clock/` with **Load unpacked** in `chrome://extensions` to try your change.
`npm run dev` gives a quick browser preview without the extension parts.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Keep each pull request to one change.
3. Add or update tests when you change behaviour (time conversion, DST, storage rules).
4. Make sure `npm test`, `npm run build` and `npm run test:e2e` all pass.
5. Describe what changed and why.

## Ground rules for this extension

- **No network access.** Don't add code that contacts a server, loads remote scripts, fonts or
  maps, or loosens the content security policy in `public/manifest.json`.
- **No new permissions** without discussing it in an issue first.
- New bundled data or libraries must have a licence that allows redistribution, and must be
  listed in `scripts/notices.mjs` so they appear in `THIRD_PARTY_NOTICES.txt`.

## Licence of contributions

By sending a pull request you agree that your contribution is released under the project's
[MIT License](LICENSE).

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
