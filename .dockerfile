# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Copy .env file to the working directory
COPY .env .env

# Expose the port that the app runs on
EXPOSE 4242

# Command to run the application
CMD ["node", "index.js"]
