# Vercel Deployment Guide for Cryptonix

This guide will help you deploy your SvelteKit application to Vercel.

## Prerequisites

- GitHub, GitLab, or Bitbucket repository
- Vercel account
- Your SvelteKit project ready for deployment

## Step 1: Prepare Your Project

### 1.1 Ensure Vercel Adapter is Installed
```bash
npm install @sveltejs/adapter-vercel
```

### 1.2 Verify Configuration
Your `svelte.config.js` should use the Vercel adapter:
```javascript
import adapter from '@sveltejs/adapter-vercel';

export default {
  kit: {
    adapter: adapter()
  }
};
```

### 1.3 Check vercel.json
Ensure your `vercel.json` is properly configured (already done).

## Step 2: Deploy to Vercel

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Go to [vercel.com](https://vercel.com) and sign in**

2. **Click "New Project"**

3. **Import your repository**
   - Connect your GitHub/GitLab/Bitbucket account
   - Select the `cryptonix` repository

4. **Configure the project:**
   - **Framework Preset**: SvelteKit
   - **Root Directory**: `website` (since your SvelteKit project is in the website subfolder)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.svelte-kit/output/client`
   - **Install Command**: `npm install`

5. **Add Environment Variables**
   - Click "Environment Variables"
   - Add the following variables:
   ```
   DATABASE_URL=your_database_connection_string
   JWT_SECRET=your_jwt_secret
   SESSION_SECRET=your_session_secret
   NODE_ENV=production
   ```

6. **Click "Deploy"**

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   cd website
   vercel
   ```

4. **Follow the prompts:**
   - Link to existing project or create new
   - Set root directory to `website`
   - Confirm build settings

## Step 3: Configure Environment Variables

### 3.1 Database Configuration
Since you're using Drizzle ORM, you'll need a PostgreSQL database:

**Options:**
- **Vercel Postgres** (integrated)
- **Supabase** (recommended for free tier)
- **Neon** (serverless PostgreSQL)
- **External PostgreSQL** (if you have one)

### 3.2 Required Environment Variables
```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Security
JWT_SECRET=your-super-secret-jwt-key-here
SESSION_SECRET=your-super-secret-session-key-here

# Application
NODE_ENV=production

# External Services (if using)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

## Step 4: Database Setup

### 4.1 Using Vercel Postgres
1. Go to your Vercel project dashboard
2. Click "Storage" → "Connect Store"
3. Select "Postgres"
4. Choose your plan and region
5. Copy the connection string to your environment variables

### 4.2 Using Supabase (Recommended)
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get your connection string from Settings → Database
4. Add to Vercel environment variables

### 4.3 Run Migrations
After setting up the database:
```bash
# Locally or in Vercel function
npm run db:migrate
```

## Step 5: Custom Domain (Optional)

1. **Go to your Vercel project dashboard**
2. **Click "Settings" → "Domains"**
3. **Add your domain**
4. **Configure DNS records** as instructed by Vercel

## Step 6: Testing Your Deployment

### 6.1 Check Build Logs
- Go to your Vercel project dashboard
- Click on the latest deployment
- Check build logs for any errors

### 6.2 Test Your Application
- Visit your Vercel URL
- Test all major functionality
- Check API endpoints

### 6.3 Monitor Performance
- Use Vercel Analytics
- Check Core Web Vitals
- Monitor serverless function performance

## Step 7: Continuous Deployment

### 7.1 Automatic Deployments
- Vercel automatically deploys on every push to your main branch
- Preview deployments are created for pull requests

### 7.2 Manual Deployments
```bash
# Deploy from CLI
vercel --prod

# Or redeploy from dashboard
# Go to Deployments → Redeploy
```

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check build logs in Vercel dashboard
# Common issues:
# - Missing dependencies
# - Build command errors
# - Environment variable issues
```

#### 2. Database Connection Issues
```bash
# Verify DATABASE_URL is correct
# Check if database is accessible from Vercel
# Ensure SSL is enabled for external databases
```

#### 3. Environment Variable Issues
```bash
# Verify all required variables are set
# Check variable names match your code
# Ensure no typos in values
```

#### 4. Function Timeout
```bash
# Vercel functions have a 10-second timeout
# Optimize database queries
# Use connection pooling
```

## Performance Optimization

### 1. SvelteKit Optimizations
- Use `$page.data` for server-side data
- Implement proper caching strategies
- Optimize images and static assets

### 2. Database Optimizations
- Use connection pooling
- Implement query caching
- Optimize database indexes

### 3. Vercel Optimizations
- Use Edge Functions where appropriate
- Implement proper caching headers
- Optimize bundle size

## Monitoring and Analytics

### 1. Vercel Analytics
- Core Web Vitals
- Performance metrics
- User analytics

### 2. Error Tracking
- Vercel Function logs
- Real-time error monitoring
- Performance insights

## Cost Considerations

### Vercel Pricing (as of 2024)
- **Hobby**: $0/month (limited)
- **Pro**: $20/month
- **Enterprise**: $40+/month

### Database Costs
- **Vercel Postgres**: $20/month (Pro plan)
- **Supabase**: $0/month (free tier)
- **Neon**: $0/month (free tier)

## Next Steps

1. **Set up monitoring** and error tracking
2. **Configure backups** for your database
3. **Set up CI/CD** pipeline
4. **Implement caching** strategies
5. **Monitor performance** metrics

## Support

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **SvelteKit Documentation**: [kit.svelte.dev](https://kit.svelte.dev)
- **Vercel Community**: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)
