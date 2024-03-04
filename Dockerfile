# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=21.6.2

################################################################################
# Use node image for base image for all stages.
FROM node:${NODE_VERSION}-alpine as base
RUN apk update && apk add git
# Set working directory for all build stages.
WORKDIR /usr/src/app

RUN git init .
RUN git remote add -t \* -f origin https://github.com/furyhawk/heynote.git
RUN git checkout main

################################################################################
# Create a stage for installing production dependecies.
FROM base as deps

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage bind mounts to package.json and package-lock.json to avoid having to copy them
# into this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

RUN npm install
################################################################################
# Create a stage for building the application.
FROM deps as build

# Download additional development dependencies before building, as some projects require
# "devDependencies" to be installed to build. If you don't need this, remove this step.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci

# Copy the rest of the source files into the image.
# COPY . .

# Run the build script.
# RUN npm run webapp:build


################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
# FROM base as final

# Use production node environment by default.
# ENV NODE_ENV production

# Run the application as a non-root user.
# USER node

# Copy package.json so that package manager commands can be used.
# COPY package.json .

# Copy the production dependencies from the deps stage and also
# the built application from the build stage into the image.
COPY --from=deps /usr/src/app/node_modules ./node_modules
# COPY --from=build /usr/src/app/dist-electron ./dist-electron
# FROM nginx:alpine as production-build
# COPY nginx.conf /etc/nginx/nginx.conf
# ## Remove default nginx index page
# RUN rm -rf /usr/share/nginx/html/*
# COPY --from=builder /dist /usr/share/nginx/html/nested-app
# ENTRYPOINT ["nginx", "-g", "daemon off;"]
# Expose the port that the application listens on.
EXPOSE 5173

# Run the application.
CMD npm run webapp:dev -- --host
