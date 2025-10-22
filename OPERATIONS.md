# Operations & Maintenance – Ghost on AWS

## Backups & Integrity Checks

| Resource | Status | Notes |
|----------|--------|-------|
| RDS (`ghostinfrastack-mysql…`) | Backup retention 7 days, enhanced monitoring enabled (PI/Log exports disabled on t4g.small) | Still single-AZ / unencrypted (dev default). Increase retention or enable encryption as needed. |
| S3 Media Bucket | Versioning + SSE-S3 encryption enforced | Supports rollbacks; HTTPS-only enforced. |
| CloudWatch Logs | Log group `GhostInfraStack-GhostLogs42350297-yG1J1bF43DL9` (731-day retention) | ECS task logs available via CloudWatch console. |
| ALB Access Logs | Bucket `${AlbLogsBucketName}` | Enabled for request troubleshooting. |
| CloudFront Logs | Bucket `${CloudFrontLogsBucketName}` | Enabled for CDN analytics. |
| SES | Sandbox mode | Only verified recipients receive mail—request production access before go-live. |

## Observability & Alerts

- SNS topic `OpsTopic` routes alarms to `${OPS_ALERT_EMAIL}` (defaults to `SES_FROM_EMAIL` unless overridden by `OPS_ALERT_EMAIL`).
- CloudWatch alarms: ECS high CPU, ALB 5xx count, RDS high CPU, RDS low storage.
- Performance Insights and enhanced monitoring active on RDS.
- ALB/CloudFront access logs shipped to dedicated S3 buckets.

## CI/CD Workflows

- Infrastructure: `.github/workflows/infra-deploy.yml`
- Image build/push + ECS rollout: `.github/workflows/image-deploy.yml`
- Theme deploy (auto-activate): `.github/workflows/theme-deploy.yml`

Trigger manually via GitHub Actions or push changes to the respective paths.

## Update & Rollback Procedures

### Image
- **Update**: modify `image/`, push → workflow builds `latest` + SHA → ECS redeploy.
- **Rollback**: redeploy earlier SHA tag from ECR (`aws ecs update-service --force-new-deployment --cluster … --service … --force-new-deployment --desired-count N`).

### Theme
- **Update**: edit `theme/`, push → CI zips/uploads theme and activates it.
- **Rollback**: re-upload previous zip or revert commit and rerun workflow.

### Infrastructure
- **Update**: edit CDK, push → infra workflow runs `cdk deploy GhostInfraStack`.
- **Rollback**: checkout previous commit and redeploy. Never destroy RDS/S3 without backups.

## Scaling & Cost Awareness

- Default ECS desired count = 1. Scale via CDK or CLI:
  ```bash
  aws ecs update-service \
    --cluster GhostInfraStack-ClusterEB0386A7-uKRK9EARdnII \
    --service GhostInfraStack-ServiceD69D759B-zBJvyMYoz8vS \
    --desired-count 2 \
    --region us-west-2 \
    --profile dev-account
  ```
- Helper scripts in `scripts/`:
  - `scale-ecs.sh <desiredCount>`
  - `stop-rds.sh` / `start-rds.sh`
- Any scale-up (more tasks, larger RDS class, Multi-AZ) must include a cost estimate and explicit approval.

## Budgets & Cost Alerts

Create a monthly budget (edit thresholds/addresses):

```bash
aws budgets create-budget \
  --account-id <ACCOUNT_ID> \
  --budget '{
    "BudgetName":"GhostMonthlyBudget",
    "BudgetLimit":{"Amount":"50","Unit":"USD"},
    "TimeUnit":"MONTHLY",
    "BudgetType":"COST"
  }' \
  --notifications-with-subscribers '[
    {"Notification":{"NotificationType":"FORECASTED","ComparisonOperator":"GREATER_THAN","Threshold":80},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"finance@yourdomain.com"}]},
    {"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":90},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"devops@yourdomain.com"}]}
  ]'
```

## Security Hardening Summary

- Task role restricted to `mediaBucket/content/*` prefix and read-only SSM mail parameters.
- Media bucket enforces HTTPS + SSE-S3; DMARC TXT record published with policy `p=none`.
- Database security group allows connections only from ECS service SG.
- RDS automated backups retained 7 days; slow query logs exported to CloudWatch.

## Safety Guards

- Do **not** delete RDS/S3/DNS resources without explicit approval and fresh backups.
- Always ask before modifying Route 53, ACM, SES sending modes, or scaling resources beyond baseline.
- Keep Ghost Members portal and SES behavior aligned with business rules.

## Outstanding TODOs

- Request SES production access.
- Set `mail.from` inside Ghost admin to remove log warning.
- Decide whether to disable or customize the Members portal overlay.
- Optional enhancements: CloudWatch dashboards, additional SNS subscribers, lifecycle rules for log buckets.
