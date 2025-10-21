#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network';
import { DnsAcmAlbStack } from '../lib/dns-acm-alb';
import { S3CdnStack } from '../lib/s3-cdn';
import { RdsStack } from '../lib/rds';
import { EcrStack } from '../lib/ecr';
import { ParamsStack } from '../lib/params';
import { EcsStack } from '../lib/ecs';

const app = new App();

const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';
const account = process.env.CDK_DEFAULT_ACCOUNT!;
const env = { account, region };

const HOSTED_ZONE = process.env.HOSTED_ZONE!;
const BLOG_DOMAIN = process.env.BLOG_SUBDOMAIN!;

const network = new NetworkStack(app, 'GhostNetwork', { env });
const dnsAlb = new DnsAcmAlbStack(app, 'GhostDnsAlb', { env, vpc: network.vpc, hostedZoneDomain: HOSTED_ZONE, domainName: BLOG_DOMAIN });
const s3cdn = new S3CdnStack(app, 'GhostMediaCdn', { env });
const rds = new RdsStack(app, 'GhostRds', { env, vpc: network.vpc });
const ecr = new EcrStack(app, 'GhostEcr', { env });
new ParamsStack(app, 'GhostParams', { env });

new EcsStack(app, 'GhostEcs', {
  env,
  vpc: network.vpc,
  alb: dnsAlb.alb,
  https: dnsAlb.https,
  repo: ecr.repo,
  db: rds.db,
  mediaBucket: s3cdn.bucket,
  mediaCdnDomain: s3cdn.distro.domainName,
  blogDomain: BLOG_DOMAIN
});
