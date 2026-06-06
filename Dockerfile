ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:${NODE_VERSION} AS runtime
ARG CODEX_VERSION=0.136.0

ENV NODE_ENV=production \
    HOME=/home/node \
    CODEX_HOME=/home/node/.codex \
    XDG_CACHE_HOME=/var/lib/colombo/.cache \
    XDG_DATA_HOME=/var/lib/colombo/.local/share \
    TMPDIR=/tmp \
    codex_bin=codex \
    codex_workdir=/opt/colombo \
    colombo_dir=/opt/colombo \
    agent_instructions_file=AGENTS.md \
    state_dir=/var/lib/colombo

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git openssh-client \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g @openai/codex@${CODEX_VERSION} \
  && mkdir -p /app /opt/colombo /var/lib/colombo /home/node/.codex \
  && chown -R node:node /app /opt/colombo /var/lib/colombo /home/node

WORKDIR /app

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node

CMD ["node", "dist/src/index.js"]
