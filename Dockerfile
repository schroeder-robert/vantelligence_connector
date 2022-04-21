FROM node:current-slim
WORKDIR /app
COPY package.json .
RUN apt-get update; \
  apt-get -y install python3 make g++; \
  npm install; \
  apt-get -y purge python3 make g++; \
  apt-get -y --purge autoremove; \
  apt-get -y clean; \
  rm -rf /var/lib/apt/lists/*;
COPY . ./
CMD ["node", "app.js"]