#!/bin/bash

# Puppeteer Service Deployment Script
# Usage: ./deploy.sh <ec2-ip> <ssh-key-path>

if [ $# -ne 2 ]; then
    echo "Usage: $0 <ec2-ip> <ssh-key-path>"
    echo "Example: $0 52.23.45.67 ~/.ssh/my-key.pem"
    exit 1
fi

EC2_IP=$1
SSH_KEY=$2

echo "🚀 Deploying Puppeteer Service to EC2..."

# Build the Docker image locally
echo "📦 Building Docker image..."
docker build -t puppeteer-service .

# Save the image to a tar file
echo "💾 Saving Docker image..."
docker save puppeteer-service > puppeteer-service.tar

# Copy the tar file to EC2
echo "📤 Uploading to EC2..."
scp -i $SSH_KEY puppeteer-service.tar ubuntu@$EC2_IP:~/

# Deploy on EC2
echo "🔧 Deploying on EC2..."
ssh -i $SSH_KEY ubuntu@$EC2_IP << 'EOF'
    # Stop existing container
    docker stop puppeteer-service || true
    docker rm puppeteer-service || true
    
    # Load the new image
    docker load < puppeteer-service.tar
    
    # Run the new container
    docker run -d \
        --name puppeteer-service \
        -p 3001:3001 \
        --restart unless-stopped \
        puppeteer-service
    
    # Clean up
    rm puppeteer-service.tar
    
    echo "✅ Puppeteer service deployed successfully!"
    echo "🌐 Service available at: http://$EC2_IP:3001"
EOF

# Clean up local files
rm puppeteer-service.tar

echo "🎉 Deployment complete!"
echo "🔗 Service URL: http://$EC2_IP:3001"
echo "📊 Health check: http://$EC2_IP:3001/health" 