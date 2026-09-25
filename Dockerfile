FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_API_URL=/api
ARG INTERNAL_API_URL=http://crm-api:8002/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV INTERNAL_API_URL=$INTERNAL_API_URL
RUN pnpm db:generate
RUN pnpm run-many:build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 8000 8001 8002
CMD ["sh","-c","pnpm nx dev web -- --hostname 0.0.0.0 --port 8000"]
