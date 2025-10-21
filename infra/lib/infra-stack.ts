import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';

interface GhostInfraStackProps extends cdk.StackProps {
  hostedZoneDomain: string;
  blogDomain: string;
}

export class GhostInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GhostInfraStackProps) {
    super(scope, id, props);

    const { hostedZoneDomain, blogDomain } = props;

    // VPC
    const vpc = new ec2.Vpc(this, 'Vpc', { 
      maxAzs: 2, 
      natGateways: 1 
    });

    // Route53 Hosted Zone
    const zone = r53.HostedZone.fromLookup(this, 'Zone', { 
      domainName: hostedZoneDomain 
    });

    // ACM Certificate
    const cert = new acm.Certificate(this, 'Cert', {
      domainName: blogDomain,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    // ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', { 
      vpc, 
      internetFacing: true 
    });

    // HTTP to HTTPS redirect
    const httpListener = alb.addListener('HttpListener', { 
      port: 80, 
      open: true 
    });
    httpListener.addAction('RedirectToHttps', {
      action: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true
      })
    });

    // HTTPS listener
    const httpsListener = alb.addListener('HttpsListener', { 
      port: 443, 
      open: true, 
      certificates: [cert] 
    });

    // Route53 A record
    new r53.ARecord(this, 'AliasRecord', {
      zone,
      recordName: blogDomain.replace(`.${hostedZoneDomain}`, ''),
      target: r53.RecordTarget.fromAlias({
        bind: () => ({ 
          hostedZoneId: alb.loadBalancerCanonicalHostedZoneId, 
          dnsName: alb.loadBalancerDnsName 
        })
      })
    });

    // S3 bucket for media
    const mediaBucket = new s3.Bucket(this, 'MediaBucket', { 
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL 
    });

    // CloudFront distribution
    const mediaCdn = new cf.Distribution(this, 'MediaCdn', {
      defaultBehavior: { 
        origin: new origins.S3Origin(mediaBucket), 
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS 
      }
    });

    // RDS MySQL database
    const dbSecret = new sm.Secret(this, 'DbSecret');
    const database = new rds.DatabaseInstance(this, 'Mysql', {
      engine: rds.DatabaseInstanceEngine.mysql({ 
        version: rds.MysqlEngineVersion.VER_8_0_35 
      }),
      vpc,
      credentials: rds.Credentials.fromSecret(dbSecret),
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      allocatedStorage: 50,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      multiAz: false
    });

    // ECR repository
    const ecrRepo = new ecr.Repository(this, 'GhostRepo', { 
      repositoryName: 'ghost-repo' 
    });

    // SSM parameters for mail credentials
    new ssm.StringParameter(this, 'MailUser', { 
      parameterName: '/ghost/mail/user', 
      stringValue: 'REPLACE_ME' 
    });
    new ssm.StringParameter(this, 'MailPass', { 
      parameterName: '/ghost/mail/pass', 
      stringValue: 'REPLACE_ME' 
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    // ECS Task Role
    const taskRole = new iam.Role(this, 'TaskRole', { 
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com') 
    });
    mediaBucket.grantReadWrite(taskRole);

    // Allow ECS to connect to RDS
    database.connections.allowDefaultPortFrom(ec2.Peer.ipv4(vpc.vpcCidrBlock));

    // CloudWatch Logs
    const logGroup = new logs.LogGroup(this, 'Logs');

    // ECS Task Definition
    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', { 
      cpu: 512, 
      memoryLimitMiB: 1024, 
      taskRole 
    });

    // Ghost container
    const container = taskDef.addContainer('Ghost', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, 'latest'),
      logging: ecs.LogDriver.awsLogs({ 
        logGroup, 
        streamPrefix: 'ghost' 
      }),
      environment: {
        url: `https://${blogDomain}`,
        database__client: 'mysql',
        database__connection__host: database.instanceEndpoint.hostname,
        database__connection__user: 'admin',
        storage__active: 's3',
        storage__s3__bucket: mediaBucket.bucketName,
        storage__s3__region: this.region,
        storage__s3__assetHost: `https://${mediaCdn.domainName}`
      },
      secrets: {
        database__connection__password: ecs.Secret.fromSecretsManager(dbSecret),
        mail__options__auth__user: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromStringParameterName(this, 'MailUserParam', '/ghost/mail/user')
        ),
        mail__options__auth__pass: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromStringParameterName(this, 'MailPassParam', '/ghost/mail/pass')
        )
      },
      portMappings: [{ containerPort: 2368 }]
    });

    // ECS Service
    const service = new ecs.FargateService(this, 'Service', { 
      cluster, 
      taskDefinition: taskDef, 
      desiredCount: 1, 
      assignPublicIp: false 
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc, 
      port: 2368, 
      protocol: elbv2.ApplicationProtocol.HTTP, 
      targets: [service],
      healthCheck: { 
        path: '/', 
        healthyHttpCodes: '200,301,302', 
        interval: cdk.Duration.seconds(30) 
      }
    });

    // Add target group to HTTPS listener
    httpsListener.addTargetGroups('GhostTargetGroup', { 
      targetGroups: [targetGroup] 
    });

    // Outputs
    new cdk.CfnOutput(this, 'BlogUrl', { 
      value: `https://${blogDomain}` 
    });
    new cdk.CfnOutput(this, 'EcrRepositoryUri', { 
      value: ecrRepo.repositoryUri 
    });
    new cdk.CfnOutput(this, 'MediaBucketName', { 
      value: mediaBucket.bucketName 
    });
    new cdk.CfnOutput(this, 'DatabaseEndpoint', { 
      value: database.instanceEndpoint.hostname 
    });
  }
}
