FROM node:22-alpine

WORKDIR /app/client

COPY ./client/package*.json ./
RUN npm install

COPY ./client .

COPY ./compose/local/node/start /start
RUN sed -i 's/\r$//g' /start
RUN chmod +x /start

CMD ["/start"]
