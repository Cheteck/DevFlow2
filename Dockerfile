# syntax=docker/dockerfile:1
# MosaiX platform image.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:${PATH}" \
    NODE_ENV="production"
RUN corepack enable
WORKDIR /app

FROM base AS install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY . .
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS runtime
# Non-root runtime: files must belong to `node` so the dev reinstall can
# rebuild foreign (Windows) node_modules layouts without EACCES.
COPY --chown=node:node --from=install /app/node_modules ./node_modules
COPY --chown=node:node --from=install /app/packages ./packages
COPY --chown=node:node --from=install /app/apps ./apps
COPY --chown=node:node --from=install /app/plugins ./plugins
COPY --chown=node:node src ./src
COPY --chown=node:node themes ./themes
COPY --chown=node:node config ./config
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json tsconfig.build.json ./
ENV COREPACK_HOME="/tmp/corepack"
RUN corepack prepare pnpm@10.33.4 --activate
USER node
ENV PORT="3000" \
    HOST="0.0.0.0"
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/__mosaix').then(function(r){process.exit(r.ok?0:1)}).catch(function(){process.exit(1)})"
CMD ["pnpm", "start"]
