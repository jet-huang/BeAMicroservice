# Build
FROM node:16.16.0-buster as BUILD
ARG appBaseHref="/"
WORKDIR /app
COPY ./package*.json ./
RUN npm install --legacy-peer-deps
COPY ./ ./
RUN npm run ng build -- --output-path /app/dist --base-href ${appBaseHref}

# Distribute
FROM nginx:1.22-alpine
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=BUILD /app/dist /usr/share/nginx/html
EXPOSE 80

# envsubst will replace arguments in runtimeConfig.prod.json with those set by environment vars
CMD ["/bin/sh",  "-c",  "envsubst < /usr/share/nginx/html/assets/config/runtimeConfig.template.json > /usr/share/nginx/html/assets/config/runtimeConfig.prod.json && exec nginx -g 'daemon off;'"]
