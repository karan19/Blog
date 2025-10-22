#!/bin/bash
set -e

mkdir -p /var/lib/ghost/content/adapters/storage
ln -sfn /var/lib/ghost/node_modules/ghost-storage-adapter-s3 \
        /var/lib/ghost/content/adapters/storage/s3

exec /usr/local/bin/docker-entrypoint.sh "$@"
