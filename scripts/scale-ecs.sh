#!/bin/bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <desired-count>" >&2
  exit 1
fi

desired=$1

aws ecs update-service \
  --cluster GhostInfraStack-ClusterEB0386A7-uKRK9EARdnII \
  --service GhostInfraStack-ServiceD69D759B-zBJvyMYoz8vS \
  --desired-count "$desired" \
  --region us-west-2 \
  ${AWS_PROFILE:+--profile $AWS_PROFILE}
