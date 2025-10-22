# Operations & Maintenance – Ghost on AWS

## Backups & Integrity Checks

| Resource | Status | Notes |
|----------|--------|-------|
| RDS (ghostinfrastack-mysql...) | BackupRetentionPeriod = 1 day | Consider raising to 7 for prod. Not Multi-AZ, not encrypted. |
| S3 Media Bucket (`ghostinfrastack-mediabucket...`) | Versioning enabled | Supports object-level rollback. |
| CloudWatch Logs | Log group `GhostInfraStack-GhostLogs42350297-yG1J1bF43DL9` exists (retention 731 days) | No alarms yet. |
| SES | Still in sandbox | Only verified addresses receive mail; submit production request when ready. |

## CI/CD Workflows

- Infrastructure: `.github/workflows/infra-deploy.yml`
- Image build/push + ECS rollout: `.github/workflows/image-deploy.yml`
- Theme deploy: `.github/workflows/theme-deploy.yml`

Each workflow can be triggered manually or by pushing changes to their respective paths.

## Update & Rollback Procedures

### Image
- **Update**: modify `image/`, push → workflow builds/pushes `latest` + SHA → ECS redeploy.
- **Rollback**: re-run workflow with prior SHA (available in ECR). Use `aws ecs update-service --force-new-deployment` with desired tag.

### Theme
- **Update**: edit `theme/` → push → workflow zips and uploads (auto-activates).
- **Rollback**: re-upload previous theme or revert commit and rerun workflow.

### Infrastructure
- **Update**: adjust CDK code → push → `infra-deploy` applies. Always review `cdk diff` before major changes.
- **Rollback**: use `cdk deploy` with previous commit; never run `cdk destroy` without RDS/S3 backups.

## Scaling & Cost Awareness

- ECS default desired count: 1 task. Increase via CDK or CLI:
  ```bash
  aws ecs update-service \
    --cluster GhostInfraStack-ClusterEB0386A7-uKRK9EARdnII \
    --service GhostInfraStack-ServiceD69D759B-zBJvyMYoz8vS \
    --desired-count 2 \
    --region us-west-2 \
    --profile dev-account
  ```
- Any scale-up (ECS tasks, RDS size, enabling Multi-AZ) must be confirmed with a cost estimate.

## Safety Guards

- Do **not** delete RDS/S3/DNS resources without explicit user approval and fresh backups.
- Ask before changing Route 53 records, ACM certificates, or SES sending modes.
- Keep Ghost Members portal/SES behavior coordinated with business needs.

## Outstanding TODOs

- Request SES production access when ready.
- Configure `mail.from` in Ghost admin to remove log warning.
- Decide whether to disable or customize the Members portal overlay.
- Optional: add CloudWatch alarms (ECS task failures, RDS CPU), SNS notifications.
