# https://developers.home-assistant.io/docs/add-ons/configuration#add-on-dockerfile
ARG BUILD_FROM=alpine:latest
FROM $BUILD_FROM

# Execute during the build of the image
#ARG TEMPIO_VERSION BUILD_ARCH
#RUN \
#    curl -sSLf -o /usr/bin/tempio \
#    "https://github.com/home-assistant/tempio/releases/download/${TEMPIO_VERSION}/tempio_${BUILD_ARCH}"

RUN \
  apk add --no-cache \
    nodejs=22.11.0-r1 \
    npm
RUN node -v
RUN npm -v

# Copy root filesystem
#COPY rootfs /

COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]