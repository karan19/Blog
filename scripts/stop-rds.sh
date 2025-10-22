#!/bin/bash
set -euo pipefail

aws rds stop-db-instance \
  --db-instance-identifier ghostinfrastack-mysql4be5b1a3-l3dldf5azaij \
  --region us-west-2 \
  ${AWS_PROFILE:+--profile $AWS_PROFILE}
