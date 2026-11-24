# Stage 1: Build Vue client
FROM node:22-alpine AS build-stage
WORKDIR /app/client
COPY ./client/package*.json ./
RUN npm ci
COPY ./client .
RUN npm run build

# Stage 2: Production Nginx
FROM docker.io/nginx:1.31.9-alpine AS production-stage
RUN rm /etc/nginx/conf.d/default.conf
COPY ./nginx/templates /etc/nginx/templates
COPY --from=build-stage /app/client/dist /var/www/vue

EXPOSE 80
