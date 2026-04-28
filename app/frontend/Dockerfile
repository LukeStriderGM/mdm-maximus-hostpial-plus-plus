FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_NODE_ID=""
ARG VITE_NODE_TYPE=""
ARG VITE_API_URL=""
ENV VITE_NODE_ID=$VITE_NODE_ID
ENV VITE_NODE_TYPE=$VITE_NODE_TYPE
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
