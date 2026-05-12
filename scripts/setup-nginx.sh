#!/bin/bash
# setup-nginx.sh - Configure Nginx for lowcall.com

set -e

DOMAIN="lowcall.com"
CLIENT_DIR="/var/www/lowcall-client"

echo "=== Setting up Nginx ==="

# Create client directory
echo "Creating client directory..."
sudo mkdir -p $CLIENT_DIR
sudo chown -R www-data:www-data $CLIENT_DIR

# Copy client build files (you'll need to build React app first)
echo "Note: Make sure to build your React app and copy dist/* to $CLIENT_DIR"

# Create Nginx configuration
echo "Creating Nginx configuration..."
sudo tee /etc/nginx/sites-available/lowcall > /dev/null <<'EOF'
upstream socketio_backend {
    server localhost:3000;
}

server {
    listen 80;
    listen [::]:80;
    server_name lowcall.ir www.lowcall.ir;

    # Redirect to HTTPS (will be configured after SSL setup)
    # return 301 https://$server_name$request_uri;

    root /var/www/lowcall-client;
    index index.html;

    # React app - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Socket.IO proxy
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

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF

# Enable site
echo "Enabling Nginx site..."
sudo ln -sf /etc/nginx/sites-available/lowcall /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Restart Nginx
echo "Restarting Nginx..."
sudo systemctl restart nginx

echo "=== Nginx Setup Complete ==="
echo "To enable SSL, run: sudo certbot --nginx -d lowcall.com -d www.lowcall.com"
