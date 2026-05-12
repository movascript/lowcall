#!/bin/bash
# setup-coturn.sh - Setup STUN/TURN server with static user authentication

set -e

DOMAIN="lowcall.ir"
TURN_USER="myuser"
TURN_PASSWORD="mypassword"

# Enable Coturn
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn

# Backup original config
sudo cp /etc/turnserver.conf /etc/turnserver.conf.backup

# Create Coturn configuration
sudo tee /etc/turnserver.conf > /dev/null <<EOF
# STUN/TURN server configuration for LowCall

# Listening ports
listening-port=3478
tls-listening-port=5349

# External IP
external-ip=193.176.242.86

# Relay ports range
min-port=49152
max-port=65535

# Use fingerprints
fingerprint

# Use long-term credentials mechanism
lt-cred-mech

# Static user credentials
user=$TURN_USER:$TURN_PASSWORD

# Realm
realm=$DOMAIN

# Log file
log-file=/var/log/turnserver.log

# Verbose logging (disable in production)
verbose

# Deny private IP ranges
no-multicast-peers
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255

# SSL/TLS for TURNS
cert=/etc/nginx/ssl/lowcall.ir/fullchain.pem
pkey=/etc/nginx/ssl/lowcall.ir/privkey.pem

# Disable insecure TLS versions
no-tlsv1
no-tlsv1_1
EOF

# Save TURN credentials
echo "Saving TURN credentials..."
sudo tee /var/www/lowcall-server/turn-credentials.txt > /dev/null <<EOF
TURN Server Configuration:
========================
Domain: $DOMAIN
Public IP: $PUBLIC_IP
Username: $TURN_USER
Password: $TURN_PASSWORD

React App Configuration:
========================
const iceServers = [
  { urls: 'stun:$DOMAIN:3478' },
  { urls: 'stun:$PUBLIC_IP:3478' },
  {
    urls: 'turn:$DOMAIN:3478?transport=udp',
    username: '$TURN_USER',
    credential: '$TURN_PASSWORD'
  },
  {
    urls: 'turn:$DOMAIN:3478?transport=tcp',
    username: '$TURN_USER',
    credential: '$TURN_PASSWORD'
  },
  {
    urls: 'turns:$DOMAIN:5349?transport=tcp',
    username: '$TURN_USER',
    credential: '$TURN_PASSWORD'
  }
];

const peerConnection = new RTCPeerConnection({ iceServers });

Backend API (Optional):
========================
// اگر نمی‌خواهید credential را در frontend hardcode کنید:

app.get('/api/turn-credentials', (req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:$DOMAIN:3478' },
      {
        urls: ['turn:$DOMAIN:3478?transport=udp', 'turn:$DOMAIN:3478?transport=tcp'],
        username: '$TURN_USER',
        credential: '$TURN_PASSWORD'
      }
    ]
  });
});
EOF

sudo chmod 600 /var/www/lowcall-server/turn-credentials.txt

# Open firewall ports
echo "Opening firewall ports..."
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 49152:65535/udp

# Restart Coturn
echo "Restarting Coturn..."
sudo systemctl restart coturn
sudo systemctl enable coturn

# Wait for service to start
sleep 2

# Check status
echo ""
echo "=== Coturn Status ==="
sudo systemctl status coturn --no-pager -l

echo ""
echo "=== Coturn Setup Complete ==="
echo "Credentials saved to: /var/www/lowcall-server/turn-credentials.txt"
echo ""
echo "Quick Test:"
echo "  STUN: stun:$DOMAIN:3478"
echo "  TURN: turn:$DOMAIN:3478"
echo ""
echo "Install test tool: npm install -g stun"
echo "Test command: stun $PUBLIC_IP 3478"
