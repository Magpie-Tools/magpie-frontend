# Magpie Frontend

The Angular dashboard for [Magpie](https://magpie.tools), the self-hosted proxy
manager.

Current stack:

- Angular `21.1`
- PrimeNG `21`
- Tailwind CSS `4`
- npm-based workflow

## Prerequisites

- Node.js `20.19+` or `22.12+`
- npm

## Development server

```bash
npm ci
npm run start
```

The development server runs at `http://localhost:4200/` and expects the Magpie
backend at `http://localhost:5656/api`.

## Build

```bash
npm run build
```

The production browser build is emitted to `dist/frontend/browser/`.

## Tests

```bash
npm test
```

For a non-interactive test run:

```bash
npm test -- --watch=false --browsers=ChromeHeadless
```

## Container image

The production image serves the compiled application through Nginx and proxies
`/api` to a service named `backend`:

```bash
docker build -t magpie-frontend:dev .
```

## Related repositories

- [Backend](https://github.com/Magpie-Tools/magpie-backend)
- [Website](https://github.com/Magpie-Tools/magpie-website)
- [Documentation](https://github.com/Magpie-Tools/magpie-docs)

## License

Magpie is distributed under the GNU Affero General Public License v3.0.
