#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { GhostInfraStack } from '../lib/infra-stack';

const app = new App();

const region = process.env.CDK_DEFAULT_REGION || 'us-west-2';
const account = process.env.CDK_DEFAULT_ACCOUNT!;
const env = { account, region };

const HOSTED_ZONE = process.env.HOSTED_ZONE || 'karankan19.com';
const BLOG_DOMAIN = process.env.BLOG_SUBDOMAIN || 'blog.karankan19.com';

new GhostInfraStack(app, 'GhostInfra', {
  env,
  hostedZoneDomain: HOSTED_ZONE,
  blogDomain: BLOG_DOMAIN
});
