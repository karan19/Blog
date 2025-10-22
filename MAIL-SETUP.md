# Mail Setup & Production Checklist

This document captures the SES/Ghost mail configuration so we can revisit Step 6 whenever needed.

## 1. Domain verification

```bash
AWS_PROFILE=dev-account AWS_REGION=us-west-2 \
aws sesv2 create-email-identity --email-identity blog.karankan19.com

aws sesv2 get-email-identity --email-identity blog.karankan19.com \
  --query 'DkimAttributes.Tokens'
```

Add the returned tokens as CNAME records in Route 53 (already done for `mipuonocwzhc55v3cicf6s5nhdezasyl`, `226ignlflf2j6wqkmqntdudwqyobcg4k`, `7wxlz755eo62xq34uoa4sdqjq4oxyzk4`). Check status with:

```bash
aws sesv2 get-email-identity --email-identity blog.karankan19.com \
  --query '{Verified:VerifiedForSendingStatus,DKIMStatus:DkimAttributes.Status}'
```

## 2. SMTP credentials

```bash
export AWS_PROFILE=dev-account
export AWS_REGION=us-west-2
export SMTP_USER_NAME=ghost-smtp-user

aws iam create-user --user-name $SMTP_USER_NAME
aws iam attach-user-policy \
  --user-name $SMTP_USER_NAME \
  --policy-arn arn:aws:iam::aws:policy/AmazonSESFullAccess
aws iam create-access-key --user-name $SMTP_USER_NAME \
  --query 'AccessKey.{AccessKeyId:AccessKeyId,SecretAccessKey:SecretAccessKey}' \
  --output json > smtp-access-key.json

python - <<'PY'
import json, hmac, hashlib, base64
from pathlib import Path
creds = json.loads(Path('smtp-access-key.json').read_text())
msg = b"SendRawEmail"
sig = hmac.new(creds['SecretAccessKey'].encode(), msg, hashlib.sha256).digest()
smtp_pass = base64.b64encode(sig).decode()
Path('smtp-credentials.json').write_text(json.dumps({
    "SMTPUsername": creds['AccessKeyId'],
    "SMTPPassword": smtp_pass
}, indent=2))
print(Path('smtp-credentials.json').read_text())
PY

SMTP_USER=$(python - <<'PY'; import json; print(json.load(open('smtp-credentials.json'))['SMTPUsername']); PY)
SMTP_PASS=$(python - <<'PY'; import json; print(json.load(open('smtp-credentials.json'))['SMTPPassword']); PY)

aws ssm put-parameter --name /ghost/mail/user --type SecureString --value "$SMTP_USER" --overwrite --region $AWS_REGION --profile $AWS_PROFILE
aws ssm put-parameter --name /ghost/mail/pass --type SecureString --value "$SMTP_PASS" --overwrite --region $AWS_REGION --profile $AWS_PROFILE

aws ecs update-service \
  --cluster GhostInfraStack-ClusterEB0386A7-uKRK9EARdnII \
  --service GhostInfraStack-ServiceD69D759B-zBJvyMYoz8vS \
  --force-new-deployment \
  --region $AWS_REGION \
  --profile $AWS_PROFILE
```

After verification, delete local files (`smtp-access-key.json`, `smtp-credentials.json`). Swap `AmazonSESFullAccess` for a least-privilege `ses:SendRawEmail` policy once in production.

## 3. Pending items

- Request SES production access (Account dashboard → Request production access).
- Set `mail.from` inside Ghost (Settings → Email Newsletter) to remove the warning.
- Optionally add SPF/DMARC records for `blog.karankan19.com`.
- Consider SNS notifications for bounces/complaints once out of sandbox.
