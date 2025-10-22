import {
  Stack, StackProps, Duration, CfnOutput,
  aws_ec2 as ec2,
  aws_rds as rds,
  aws_secretsmanager as sm,
  aws_s3 as s3,
  aws_cloudfront as cf,
  aws_cloudfront_origins as origins,
  aws_elasticloadbalancingv2 as elbv2,
  aws_certificatemanager as acm,
  aws_route53 as r53,
  aws_route53_targets as r53targets,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_logs as logs,
  aws_iam as iam,
  aws_ssm as ssm,
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
  aws_sns as sns,
  aws_sns_subscriptions as subs
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { CertificateStack } from "./certificate-stack";

interface Props extends StackProps {
  hostedZoneDomain: string;
  blogDomain: string;
  sesFromEmail: string;
  ecrRepoName: string;
  imageTag: string;
  opsAlertEmail: string;
}

export class GhostInfraStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, {
      ...props,
      crossRegionReferences: true
    });

    const vpc = new ec2.Vpc(this, "Vpc", { maxAzs: 2, natGateways: 1 });

    const logDeliveryFriendlyAccess = new s3.BlockPublicAccess({
      blockPublicAcls: false,
      ignorePublicAcls: false,
      blockPublicPolicy: true,
      restrictPublicBuckets: true
    });

    const mediaBucket = new s3.Bucket(this, "MediaBucket", {
      blockPublicAccess: logDeliveryFriendlyAccess,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true
    });

    const cfLogsBucket = new s3.Bucket(this, "CloudFrontLogs", {
      blockPublicAccess: logDeliveryFriendlyAccess,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE
    });

    const mediaDistro = new cf.Distribution(this, "MediaCdn", {
      defaultBehavior: {
        origin: new origins.S3Origin(mediaBucket),
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      enableLogging: true,
      logBucket: cfLogsBucket
    });

    const dbSecret = new sm.Secret(this, "DbSecret", {
      secretName: "ghost-db-admin",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "admin" }),
        generateStringKey: "password",
        excludeCharacters: '/@" '
      }
    });

    const db = new rds.DatabaseInstance(this, "Mysql", {
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0_43 }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      credentials: rds.Credentials.fromSecret(dbSecret),
      allocatedStorage: 50,
      multiAz: false,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      deletionProtection: false,
      backupRetention: Duration.days(7),
      monitoringInterval: Duration.seconds(60)
    });

    const zone = r53.HostedZone.fromLookup(this, "Zone", { domainName: props.hostedZoneDomain });

    const certificateStack = new CertificateStack(this, "CertificateStack", {
      hostedZoneDomain: props.hostedZoneDomain,
      blogDomain: props.blogDomain,
      env: { account: this.account, region: "us-east-1" }
    });

    const albCert = new acm.Certificate(this, "AlbCert", {
      domainName: props.blogDomain,
      validation: acm.CertificateValidation.fromDns(zone)
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true
    });

    const albLogsBucket = new s3.Bucket(this, "AlbLogs", {
      blockPublicAccess: logDeliveryFriendlyAccess,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE
    });

    alb.logAccessLogs(albLogsBucket);

    const http = alb.addListener("Http", { port: 80, open: true });
    http.addAction("RedirectToHttps", {
      action: elbv2.ListenerAction.redirect({ protocol: "HTTPS", port: "443" })
    });

    const https = alb.addListener("Https", {
      port: 443,
      open: true,
      certificates: [{ certificateArn: albCert.certificateArn }]
    });

    new r53.ARecord(this, "AliasRecord", {
      zone,
      recordName: props.blogDomain.replace(`.${props.hostedZoneDomain}`, ""),
      target: r53.RecordTarget.fromAlias(new r53targets.LoadBalancerTarget(alb))
    });

    const repo = new ecr.Repository(this, "GhostRepo", {
      repositoryName: props.ecrRepoName
    });

    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com")
    });
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "s3:GetBucketLocation",
        "s3:ListBucket"
      ],
      resources: [mediaBucket.bucketArn]
    }));

    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:PutObjectTagging",
        "s3:GetObjectTagging"
      ],
      resources: [`${mediaBucket.bucketArn}/content/*`]
    }));

    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParameterHistory"],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/ghost/mail/user`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/ghost/mail/pass`
      ]
    }));

    const logGroup = new logs.LogGroup(this, "GhostLogs");

    const mailUserParam = new ssm.StringParameter(this, "MailUserParam", {
      parameterName: "/ghost/mail/user",
      stringValue: "REPLACE_ME"
    });
    const mailPassParam = new ssm.StringParameter(this, "MailPassParam", {
      parameterName: "/ghost/mail/pass",
      stringValue: "REPLACE_ME"
    });

    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: 512,
      memoryLimitMiB: 1024,
      taskRole
    });

    const container = taskDef.addContainer("Ghost", {
      image: ecs.ContainerImage.fromEcrRepository(repo, props.imageTag),
      logging: ecs.LogDriver.awsLogs({ logGroup, streamPrefix: "ghost" }),
      environment: {
        url: `https://${props.blogDomain}`,
        database__client: "mysql",
        database__connection__host: db.instanceEndpoint.hostname,
        database__connection__user: "admin",
        storage__active: "s3",
        storage__s3__bucket: mediaBucket.bucketName,
        storage__s3__region: this.region,
        storage__s3__assetHost: `https://${mediaDistro.domainName}`,
        database__connection__database: "ghost",
        mail__transport: "SMTP",
        mail__options__host: `email-smtp.${this.region}.amazonaws.com`,
        mail__options__port: "587",
        mail__options__secure: "false"
      },
      secrets: {
        database__connection__password: ecs.Secret.fromSecretsManager(dbSecret, "password"),
        mail__options__auth__user: ecs.Secret.fromSsmParameter(mailUserParam),
        mail__options__auth__pass: ecs.Secret.fromSsmParameter(mailPassParam)
      },
      portMappings: [{ containerPort: 2368 }]
    });

    const svc = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: false
    });

    https.addTargets("GhostTg", {
      port: 2368,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [svc],
      healthCheck: { path: "/", healthyHttpCodes: "200,301,302", interval: Duration.seconds(30) }
    });

    db.connections.allowDefaultPortFrom(svc.connections.securityGroups[0]);

    const opsTopic = new sns.Topic(this, "OpsTopic", {
      displayName: "Ghost Ops Alerts"
    });
    opsTopic.addSubscription(new subs.EmailSubscription(props.opsAlertEmail));

    const ecsCpuAlarm = new cw.Alarm(this, "EcsHighCpu", {
      metric: svc.metricCpuUtilization(),
      threshold: 70,
      evaluationPeriods: 5,
      datapointsToAlarm: 3,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD
    });
    ecsCpuAlarm.addAlarmAction(new cw_actions.SnsAction(opsTopic));

    const alb5xxAlarm = new cw.Alarm(this, "Alb5xxHigh", {
      metric: alb.metricHttpCodeElb(elbv2.HttpCodeElb.ELB_5XX_COUNT),
      threshold: 50,
      evaluationPeriods: 5
    });
    alb5xxAlarm.addAlarmAction(new cw_actions.SnsAction(opsTopic));

    const rdsCpuAlarm = new cw.Alarm(this, "RdsHighCpu", {
      metric: db.metricCPUUtilization(),
      threshold: 80,
      evaluationPeriods: 5,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD
    });
    rdsCpuAlarm.addAlarmAction(new cw_actions.SnsAction(opsTopic));

    const rdsStorageAlarm = new cw.Alarm(this, "RdsLowStorage", {
      metric: db.metricFreeStorageSpace(),
      threshold: 10 * 1024 * 1024 * 1024,
      evaluationPeriods: 3,
      comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD
    });
    rdsStorageAlarm.addAlarmAction(new cw_actions.SnsAction(opsTopic));

    new r53.TxtRecord(this, "DmarcRecord", {
      zone,
      recordName: `_dmarc.${props.hostedZoneDomain}`,
      values: [`v=DMARC1; p=none; rua=mailto:${props.sesFromEmail}`]
    });

    new CfnOutput(this, "EcsClusterName", { value: cluster.clusterName });
    new CfnOutput(this, "EcsServiceName", { value: svc.serviceName });
    new CfnOutput(this, "EcrRepositoryUri", { value: repo.repositoryUri });
    new CfnOutput(this, "MediaDistributionId", { value: mediaDistro.distributionId });
    new CfnOutput(this, "MediaDistributionDomainName", { value: mediaDistro.domainName });
    new CfnOutput(this, "MediaBucketName", { value: mediaBucket.bucketName });
    new CfnOutput(this, "AlbLogsBucketName", { value: albLogsBucket.bucketName });
    new CfnOutput(this, "CloudFrontLogsBucketName", { value: cfLogsBucket.bucketName });
  }
}
