# https://developers.home-assistant.io/docs/add-ons/configuration#add-on-dockerfile
ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21
FROM $BUILD_FROM

# Execute during the build of the image
#ARG TEMPIO_VERSION BUILD_ARCH
#RUN \
#    curl -sSLf -o /usr/bin/tempio \
#    "https://github.com/home-assistant/tempio/releases/download/${TEMPIO_VERSION}/tempio_${BUILD_ARCH}"

RUN \
  apk add --no-cache \
    linux-headers \
    g++ \
    make \
    python3 \
    nodejs \
    npm
RUN npm install -g node-gyp

# Copy root filesystem
COPY rootfs /
RUN chmod a+x /usr/bin/connector

WORKDIR /connector

COPY src/ .
RUN npm install