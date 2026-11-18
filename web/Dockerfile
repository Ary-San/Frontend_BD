# Compila la web y la sirve con nginx, que además reenvía /api/<escenario>/ a cada PostgREST.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# La imagen oficial pasa las plantillas por envsubst al arrancar (BLOQUEAR_ESCRITURA).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
