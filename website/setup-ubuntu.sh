#!/bin/bash

# Ubuntu VPS Setup Script for Cryptonix
set -e

echo "🚀 Setting up Ubuntu VPS for Cryptonix..."

# Update system
echo "📦 Updating Ubuntu packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
echo "🔧 Installing essential packages..."
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Node.js 20.x
echo "📥 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
echo "🐘 Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Install Redis
echo "🔴 Installing Redis..."
sudo apt install -y redis-server

# Install Nginx
echo "🌐 Installing Nginx..."
sudo apt install -y nginx

# Install Certbot for SSL
echo "🔒 Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx

# Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /var/www/cryptonix
sudo chown $USER:$USER /var/www/cryptonix

# Create logs directory
mkdir -p /var/www/cryptonix/website/logs

# Setup PostgreSQL
echo "🐘 Setting up PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE cryptonix;" || echo "Database might already exist"
sudo -u postgres psql -c "CREATE USER cryptonix WITH ENCRYPTED PASSWORD 'your_secure_password';" || echo "User might already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cryptonix TO cryptonix;" || echo "Privileges might already be granted"

# Configure Redis
echo "🔴 Configuring Redis..."
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl enable nginx
sudo systemctl start nginx

# Setup firewall
echo "🔥 Setting up firewall..."
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "✅ Ubuntu VPS setup completed!"
echo "📋 Next steps:"
echo "1. Clone your repository to /var/www/cryptonix"
echo "2. Copy .env.example to .env and configure it"
echo "3. Run: cd /var/www/cryptonix/website && npm ci && npm run build"
echo "4. Start with PM2: pm2 start ecosystem.config.js --env production"
echo "5. Setup your domain and SSL certificate"
