# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24-alpine
ARG NGINX_VERSION=1.30.3-alpine
ARG APP_VERSION=2.1.3

FROM node:${NODE_VERSION} AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --no-audit --no-fund

COPY . .
RUN npm run typecheck && npm run build

FROM nginxinc/nginx-unprivileged:${NGINX_VERSION} AS runtime

ARG APP_VERSION

USER root
RUN apk del --no-cache curl
USER 101

LABEL org.opencontainers.image.title="Nebula Music" \
  org.opencontainers.image.description="Self-hosted Subsonic and OpenSubsonic web player" \
  org.opencontainers.image.version="${APP_VERSION}" \
  org.opencontainers.image.source="https://github.com/lilremark/Nebula-Music" \
  org.opencontainers.image.licenses="MIT"

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]

