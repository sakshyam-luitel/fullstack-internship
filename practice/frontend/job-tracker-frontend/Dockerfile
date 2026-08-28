FROM node:22-alpine

WORKDIR /job-tracker-frontend

COPY package.json ./

RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]