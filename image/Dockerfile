FROM ghost:5
WORKDIR /var/lib/ghost

# Install the S3 storage adapter; the volume under /var/lib/ghost/content
# will be recreated at runtime, so the adapter gets re-linked by entrypoint.sh.
RUN npm install ghost-storage-adapter-s3

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "current/index.js"]
