#!/bin/sh
set -e

# Gerar configuração do Nginx a partir do template, interpolando a variável PORT
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "Iniciando Nginx na porta ${PORT}..."
exec nginx -g 'daemon off;'