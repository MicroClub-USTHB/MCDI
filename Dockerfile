
FROM node:20-alpine AS builder

WORKDIR /usr/src/app


COPY package.json package-lock.json ./


RUN npm ci


COPY . .


RUN npm run build


# ── pruned: devDependencies stripped — used by the production stage only ──────
FROM builder AS pruned

RUN npm prune --production



FROM node:20-alpine AS production


ENV NODE_ENV=production


USER node

WORKDIR /usr/src/app

COPY --from=pruned --chown=node:node /usr/src/app/node_modules ./node_modules

COPY --from=pruned --chown=node:node /usr/src/app/dist ./dist

COPY --from=pruned --chown=node:node /usr/src/app/package.json ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
