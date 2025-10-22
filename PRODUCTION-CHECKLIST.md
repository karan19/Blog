# Production Readiness Checklist

Use this before tagging the environment as production-ready. Check each item and record date/owner.

## Infrastructure
- [ ] `cdk diff` shows no unexpected changes.
- [ ] ALB HTTPS healthy; Route 53 A-alias resolves to ALB.
- [ ] RDS backups retained ≥7 days; Performance Insights enabled.
- [ ] Media bucket encrypted; CloudFront distribution active.

## Application
- [ ] `/` returns 200 with live theme.
- [ ] `/ghost` admin accessible; owner account verified.
- [ ] Published post renders correctly.
- [ ] Media assets load via CloudFront domain.

## Email
- [ ] SES out of sandbox.
- [ ] DKIM/SPF/DMARC published and passing.
- [ ] Staff invite + member magic link tested end-to-end.

## Observability
- [ ] Alarms (ECS CPU, ALB 5xx, RDS CPU/storage) fire and notify ops email.
- [ ] ALB/CloudFront logs accessible in S3.
- [ ] RDS Performance Insights reviewed for baseline.

## Security
- [ ] ECS task role least privilege verified.
- [ ] RDS SG restricts access to ECS SG.
- [ ] HTTPS enforced end-to-end; no plaintext endpoints.

## Cost Controls
- [ ] AWS Budget configured with recipients.
- [ ] Scale-down scripts tested (`scripts/scale-ecs.sh`, `scripts/stop-rds.sh`).
- [ ] Resource tagging (`Project=GhostBlog`) applied as needed.

## Sign-off
- Approved by: __________________  Date: __________

