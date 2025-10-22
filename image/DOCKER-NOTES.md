# Ghost Container Build & Deployment Guide

This note tracks the custom Docker image used by ECS.

## Dockerfile changes

- Base image `ghost:5`
- Installs `ghost-storage-adapter-s3` so uploads go to S3
- Adds `entrypoint.sh` to recreate the storage adapter symlink on every boot
- Runs Ghost in production via the standard entrypoint

## entrypoint.sh

```bash
#!/bin/bash
set -e
mkdir -p /var/lib/ghost/content/adapters/storage
ln -sfn /var/lib/ghost/node_modules/ghost-storage-adapter-s3 \
        /var/lib/ghost/content/adapters/storage/s3
exec /usr/local/bin/docker-entrypoint.sh "$@"
```

## Build & push (linux/amd64)

```bash
export AWS_PROFILE=dev-account
export AWS_REGION=us-west-2
export ACCOUNT_ID=654654148983
export ECR_REPO=ghost-repo
export IMAGE_TAG=latest

aws ecr get-login-password --region $AWS_REGION --profile $AWS_PROFILE \
  | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

cd ghost-on-aws/image
docker buildx build --platform linux/amd64 \
  -t ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG} \
  --push \
  .

aws ecs update-service \
  --cluster GhostInfraStack-ClusterEB0386A7-uKRK9EARdnII \
  --service GhostInfraStack-ServiceD69D759B-zBJvyMYoz8vS \
  --force-new-deployment \
  --region $AWS_REGION \
  --profile $AWS_PROFILE
```

## Troubleshooting

- `exec format error`: make sure the image is built for `linux/amd64`
- `Unable to find storage adapter s3`: ensure the entrypoint recreates the adapter symlink
