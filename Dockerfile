# Stage 1: build the Angular application
# The compiled assets are the same on every architecture, so build them on the
# native build platform instead of emulating npm under QEMU for each target.
FROM --platform=$BUILDPLATFORM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: serve the compiled assets
FROM nginx:alpine
ENV EXPORT_PROXY_READ_TIMEOUT_SECONDS=310
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/frontend/browser/ /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
