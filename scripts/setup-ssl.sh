#!/bin/bash
# setup-ssl.sh - Setup SSL with Let's Encrypt

set -e

DOMAIN="lowcall.com"
EMAIL="your-email@example.com"  # Change this!

echo "=== Setting up SSL Certificate ==="

# Obtain SSL certificate
echo "Obtaining SSL certificate..."
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

# Update Nginx config for HTTPS
sudo tee /etc/nginx/sites-available/lowcall > /dev/null <<'EOF'
upstream socketio_backend {
    server localhost:3000;
}

server {
    listen 80;
    listen [::]:80;
    server_name lowcall.com www.lowcall.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name lowcall.com www.lowcall.com;

    ssl_certificate /etc/letsencrypt/live/lowcall.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lowcall.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root /var/www/lowcall-client;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /socket.io/ {
        proxy_pass http://socketio_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF

sudo nginx -t
sudo systemctl reload nginx

echo "=== SSL Setup Complete ==="
