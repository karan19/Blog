#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { GhostInfraStack } from "../lib/ghost-infra-stack";

const app = new App();

// Safe defaults with clear overrides
const REGION = process.env.CDK_DEFAULT_REGION ?? "us-west-2";
const ACCOUNT = process.env.CDK_DEFAULT_ACCOUNT;
if (!ACCOUNT) throw new Error("CDK_DEFAULT_ACCOUNT missing. Set AWS credentials.");

const HOSTED_ZONE = process.env.HOSTED_ZONE ?? "karankan19.com";
const BLOG_SUBDOMAIN = process.env.BLOG_SUBDOMAIN ?? `blog.${HOSTED_ZONE}`;
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL ?? `no-reply@${HOSTED_ZONE}`;
const ECR_REPO_NAME = process.env.ECR_REPO_NAME ?? "ghost-repo";
const IMAGE_TAG = process.env.IMAGE_TAG ?? "latest"; // image tag to run
const OPS_ALERT_EMAIL = process.env.OPS_ALERT_EMAIL ?? SES_FROM_EMAIL;

new GhostInfraStack(app, "GhostInfraStack", {
  env: { account: ACCOUNT, region: REGION },
  hostedZoneDomain: HOSTED_ZONE,
  blogDomain: BLOG_SUBDOMAIN,
  sesFromEmail: SES_FROM_EMAIL,
  ecrRepoName: ECR_REPO_NAME,
  imageTag: IMAGE_TAG,
  opsAlertEmail: OPS_ALERT_EMAIL
});
