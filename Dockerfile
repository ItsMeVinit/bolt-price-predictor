FROM nginx:alpine

# Copy the production build into the nginx html directory
COPY dist /usr/share/nginx/html

# Expose default HTTP port
EXPOSE 80

# Run nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
