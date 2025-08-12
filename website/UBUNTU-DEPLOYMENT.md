# Ubuntu VPS Deployment Guide for Cryptonix

This guide will help you deploy your SvelteKit application on an Ubuntu VPS.

## Prerequisites

- Ubuntu 20.04+ VPS
- Root or sudo access
- A domain name (optional but recommended)
- SSH access to your VPS

## Step 1: Initial VPS Setup

### 1.1 Connect to your VPS
```bash
ssh root@your-vps-ip
```

### 1.2 Create a non-root user (recommended)
```bash
# Create user
adduser deploy
usermod -aG sudo deploy

# Switch to new user
su - deploy
```

### 1.3 Run the setup script
```bash
# Make script executable
chmod +x setup-ubuntu.sh

# Run setup script
./setup-ubuntu.sh
```

## Step 2: Clone and Configure Application

### 2.1 Clone your repository
```bash
cd /var/www
git clone https://github.com/yourusername/cryptonix.git
cd cryptonix
```

### 2.2 Configure environment variables
```bash
cd website
cp env.example .env
nano .env
```

Update the following in `.env`:
```bash
DATABASE_URL="postgresql://cryptonix:your_secure_password@localhost:5432/cryptonix"
REDIS_URL="redis://localhost:6379"
NODE_ENV="production"
JWT_SECRET="your-super-secret-jwt-key-here"
SESSION_SECRET="your-super-secret-session-key-here"
```

### 2.3 Install dependencies and build
```bash
npm ci --production
npm run build
```

## Step 3: Start the Application

### 3.1 Start with PM2
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 3.2 Check status
```bash
pm2 status
pm2 logs cryptonix
```

## Step 4: Configure Nginx and SSL

### 4.1 Setup SSL certificate
```bash
# Make SSL script executable
chmod +x setup-ssl.sh

# Run SSL setup (replace with your domain)
./setup-ssl.sh your-domain.com
```

### 4.2 Test Nginx configuration
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Step 5: Database Setup

### 5.1 Run database migrations
```bash
cd /var/www/cryptonix/website
npm run db:migrate
```

### 5.2 Verify database connection
```bash
npm run db:studio
```

## Step 6: Testing

### 6.1 Test your application
- Visit `http://your-vps-ip:3000` (direct Node.js)
- Visit `https://your-domain.com` (through Nginx + SSL)

### 6.2 Check services
```bash
# Check PM2
pm2 status

# Check Nginx
sudo systemctl status nginx

# Check PostgreSQL
sudo systemctl status postgresql

# Check Redis
sudo systemctl status redis-server
```

## Step 7: Deployment Updates

### 7.1 Manual deployment
```bash
cd /var/www/cryptonix/website
chmod +x deploy-ubuntu.sh
./deploy-ubuntu.sh
```

### 7.2 Automated deployment with Git hooks
```bash
# On your local machine, add remote
git remote add production deploy@your-vps-ip:/var/www/cryptonix

# Deploy
git push production main
```

## Troubleshooting

### Common Issues

#### 1. Port 3000 not accessible
```bash
# Check if app is running
pm2 status
pm2 logs cryptonix

# Check firewall
sudo ufw status
```

#### 2. Database connection issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
sudo -u postgres psql -c "\l"
```

#### 3. Nginx issues
```bash
# Check Nginx status
sudo systemctl status nginx

# Check error logs
sudo tail -f /var/log/nginx/error.log
```

#### 4. SSL certificate issues
```bash
# Check certificate status
sudo certbot certificates

# Renew manually if needed
sudo certbot renew
```

## Security Considerations

### 1. Firewall
```bash
# Only allow necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 2. Database security
```bash
# Change default PostgreSQL password
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'new_secure_password';"
```

### 3. Regular updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Monitoring and Maintenance

### 1. Check application health
```bash
# PM2 monitoring
pm2 monit

# System resources
htop
df -h
free -h
```

### 2. Log rotation
```bash
# PM2 logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### 3. Backup strategy
```bash
# Database backup
sudo -u postgres pg_dump cryptonix > backup_$(date +%Y%m%d_%H%M%S).sql

# Application backup
tar -czf cryptonix_backup_$(date +%Y%m%d_%H%M%S).tar.gz /var/www/cryptonix
```

## Performance Optimization

### 1. Nginx optimization
```bash
# Edit /etc/nginx/nginx.conf
worker_processes auto;
worker_connections 1024;
```

### 2. Node.js optimization
```bash
# Use cluster mode (already configured in PM2)
# Monitor memory usage
pm2 status
```

### 3. Database optimization
```bash
# PostgreSQL tuning
sudo nano /etc/postgresql/*/main/postgresql.conf
```

## Support

If you encounter issues:
1. Check the logs: `pm2 logs cryptonix`
2. Check system status: `sudo systemctl status nginx postgresql redis-server`
3. Verify configuration files
4. Check firewall settings: `sudo ufw status`

## Next Steps

- Set up monitoring (e.g., UptimeRobot)
- Configure automated backups
- Set up CI/CD pipeline
- Monitor performance metrics
- Regular security updates
