# TaskFlow image (multi-stage)

# Stage 1: run the unit and API tests.
# The JUnit report is copied out of this stage by Jenkins.
FROM node:22-alpine AS test
WORKDIR /src
COPY package.json ./
COPY app ./app
COPY public ./public
COPY test ./test
RUN node --test \
      --test-reporter=spec --test-reporter-destination=stdout \
      --test-reporter=junit --test-reporter-destination=test-results.xml

# Stage 2: runtime image
FROM node:22-alpine AS runtime

ARG APP_VERSION=1.0.0
ARG BUILD_NUMBER=local
ARG GIT_COMMIT=dev

LABEL maintainer="Abhay Maurya" \
      org.opencontainers.image.title="taskflow" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}"

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    APP_VERSION=${APP_VERSION} \
    BUILD_NUMBER=${BUILD_NUMBER} \
    GIT_COMMIT=${GIT_COMMIT}

WORKDIR /app
COPY --from=test /src/package.json ./
COPY --from=test /src/app ./app
COPY --from=test /src/public ./public

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "app/server.js"]
