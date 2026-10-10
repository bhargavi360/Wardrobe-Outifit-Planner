FROM node:22-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

ARG NEXT_PUBLIC_API_URL=/api
ARG WARDROBE_API_ORIGIN
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV WARDROBE_API_ORIGIN=${WARDROBE_API_ORIGIN}

COPY frontend .
RUN npm run build

FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app .
EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
