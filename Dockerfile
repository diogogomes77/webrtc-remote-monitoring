FROM nginx:stable-alpine
COPY ./default.conf /etc/nginx/conf.d/
COPY ./public /usr/share/nginx/html
COPY ./webapp.crt /etc/nginx/
COPY ./webapp.key /etc/nginx/
EXPOSE 80 443
