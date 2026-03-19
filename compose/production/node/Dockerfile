FROM node:22-alpine

WORKDIR /app/client

COPY ./client/package*.json ./
RUN npm ci

COPY ./client .
