
FROM node:20-alpine AS builder

WORKDIR /usr/src/app


COPY package.json package-lock.json ./


RUN npm ci


COPY . .


RUN npm run build


RUN npm prune --production



FROM node:20-alpine AS production


ENV NODE_ENV=production


USER node

WORKDIR /usr/src/app

COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules

COPY --from=builder --chown=node:node /usr/src/app/dist ./dist

COPY --from=builder --chown=node:node /usr/src/app/package.json ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
