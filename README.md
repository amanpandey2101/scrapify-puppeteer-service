# Puppeteer Service

A separate microservice for handling browser automation tasks using Puppeteer. This service runs on AWS EC2 and handles all web scraping operations.

## Features

- Browser session management
- Page navigation
- Element interaction (click, fill, wait)
- Text extraction
- HTML content retrieval
- Scroll operations

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Browser Management
- `POST /launch-browser` - Launch a new browser session
- `DELETE /close-session/:sessionId` - Close a browser session

### Page Operations
- `POST /navigate` - Navigate to a URL
- `GET /page-html/:sessionId` - Get page HTML content

### Element Operations
- `POST /click-element` - Click an element
- `POST /fill-input` - Fill an input field
- `POST /wait-for-element` - Wait for an element to appear
- `POST /scroll-to-element` - Scroll to an element
- `POST /extract-text` - Extract text from an element

## Deployment to AWS EC2

### Option 1: Docker Deployment

1. **Launch EC2 Instance**
   ```bash
   # Use Ubuntu 22.04 LTS
   # Instance type: t3.medium or larger
   # Security group: Allow port 3001
   ```

2. **Install Docker**
   ```bash
   sudo apt update
   sudo apt install docker.io
   sudo systemctl start docker
   sudo systemctl enable docker
   sudo usermod -aG docker $USER
   ```

3. **Deploy the Service**
   ```bash
   # Clone your repository
   git clone <your-repo>
   cd puppeteer-service
   
   # Build and run
   docker build -t puppeteer-service .
   docker run -d -p 3001:3001 --name puppeteer-service puppeteer-service
   ```

### Option 2: Direct Deployment

1. **Install Node.js and dependencies**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install Chrome
   wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
   sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
   sudo apt-get update
   sudo apt-get install -y google-chrome-stable
   ```

2. **Deploy the service**
   ```bash
   git clone <your-repo>
   cd puppeteer-service
   npm install
   npm run build
   npm start
   ```

3. **Set up PM2 for production**
   ```bash
   sudo npm install -g pm2
   pm2 start dist/index.js --name puppeteer-service
   pm2 startup
   pm2 save
   ```

## Environment Variables

Create a `.env` file:
```env
PORT=3001
NODE_ENV=production
```

## Security Considerations

1. **Firewall**: Only allow access from your main application
2. **HTTPS**: Use a reverse proxy (nginx) with SSL
3. **Authentication**: Add API key authentication
4. **Rate Limiting**: Implement rate limiting

## Monitoring

- Use CloudWatch for logs and metrics
- Set up health checks
- Monitor memory usage (Puppeteer can be memory-intensive)

## Scaling

- Use multiple EC2 instances behind a load balancer
- Implement session persistence
- Consider using AWS ECS for container orchestration

## Integration with Main App

Add the environment variable to your main app:
```env
PUPPETEER_SERVICE_URL=http://your-ec2-ip:3001
```

The main app will use the `PuppeteerClient` class to communicate with this service. 