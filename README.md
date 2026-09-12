# Magpie Frontend

The Angular dashboard for [Magpie](https://magpie.tools), the self-hosted proxy
manager.

Current stack:

- Angular `21.2`
- [Spartan UI](https://spartan.ng/) `1.4.1`, with local Helm components
- Lucide icons and Chart.js
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

## UI components

Spartan 1.4.1 supports Angular 21 and 22. This application remains on Angular 21.
Helm components live in `src/app/ui`, generated with the `vega` style in
`components.json`. Import them through `@spartan-ng/helm/<component>`.
Spartan's Brain package provides interaction and accessibility behavior.

To add a component:

```bash
npx ng generate @spartan-ng/cli:ui <component>
```

Application components in `src/app/shared/ui` handle option objects and Angular
forms, dialog content, pagination, passwords, and Chart.js canvas lifecycle.
Tables use semantic HTML with Spartan directives. Proxy sorting and pagination
continue to request pages from the backend; scrape-source sorting remains within
the current page. Chart.js also retains the geographic chart controllers.

Theme variables in `src/styles.css` apply to controls and overlays, including the
four account color themes. When adding a Lucide icon class such as `icon-plus`,
regenerate the subset of icon masks used by the application:

```bash
node scripts/update-icons.mjs
```

## Container image

The production image serves the compiled application through Nginx and proxies
`/api` to a service named `backend`:

```bash
docker build -t magpie-frontend:dev .
```

After authenticating to the target registry, publish the default multi-platform
image with:

```bash
./scripts/push-docker-image.sh <tag>
```

Set `MAGPIE_FRONTEND_IMAGE` to publish under another image name,
`DOCKER_PLATFORMS` to change target platforms, or `PUSH_LATEST=0` to avoid
updating the `latest` tag.

## Related repositories

- [Distribution and deployment](https://github.com/Magpie-Tools/magpie)
- [Backend](https://github.com/Magpie-Tools/magpie-backend)
- [Website](https://github.com/Magpie-Tools/magpie-website)
- [Documentation](https://github.com/Magpie-Tools/magpie-docs)

## License

Magpie is distributed under the GNU Affero General Public License v3.0.
