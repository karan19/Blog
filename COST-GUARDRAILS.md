# Cost Guardrails

## Budgets
- Create/update AWS Budgets as documented in `OPERATIONS.md`.
- Recommended: set both forecasted (80%) and actual (90%) spend alerts.

## Dev vs Prod Practices
- For development: scale ECS service to 0 when idle (`scripts/scale-ecs.sh 0`).
- Stop RDS instance outside working hours (`scripts/stop-rds.sh`; restart with `start-rds.sh`).
- Disable CloudFront logging in dev if cost becomes an issue (set `enableLogging: false`).

## Scaling Approvals
- Any increase in ECS desired count, RDS instance class, or enabling Multi-AZ requires confirmation with a cost estimate.
- Track changes in Git and document expected monthly delta before applying.

## Monitoring spend
- Review AWS Cost Explorer weekly.
- Use tags (`Project=GhostBlog`) on new resources so spend is attributable.

