FROM node:18-alpine

# Install Python and build dependencies
RUN apk add --no-cache python3 py3-pip make g++ linux-headers

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Create uploads directory
RUN mkdir -p uploads/videos

# Set proper permissions
RUN chmod -R 755 uploads

EXPOSE 4000

CMD ["node", "server.js"] 