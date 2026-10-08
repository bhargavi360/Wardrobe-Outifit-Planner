FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install --frozen-lockfile

COPY frontend .
RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app .
EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
