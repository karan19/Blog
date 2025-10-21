import { Stack, StackProps, aws_ec2 as ec2, aws_ecs as ecs, aws_ecr as ecr, aws_elasticloadbalancingv2 as elbv2, aws_logs as logs, aws_iam as iam, aws_rds as rds, aws_s3 as s3, aws_ssm as ssm, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface Props extends StackProps {
  vpc: ec2.IVpc;
  alb: elbv2.ApplicationLoadBalancer;
  https: elbv2.ApplicationListener;
  repo: ecr.IRepository;
  db: rds.DatabaseInstance;
  mediaBucket: s3.Bucket;
  mediaCdnDomain: string;
  blogDomain: string;
}

export class EcsStack extends Stack {
  constructor(scope: Construct, id: string, { vpc, alb, https, repo, db, mediaBucket, mediaCdnDomain, blogDomain, ...props }: Props) {
    super(scope, id, props);

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    const taskRole = new iam.Role(this, 'TaskRole', { assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com') });
    mediaBucket.grantReadWrite(taskRole);

    db.connections.allowDefaultPortFrom(ec2.Peer.ipv4(vpc.vpcCidrBlock));

    const logGroup = new logs.LogGroup(this, 'Logs');

    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', { cpu: 512, memoryLimitMiB: 1024, taskRole });

    const container = taskDef.addContainer('Ghost', {
      image: ecs.ContainerImage.fromEcrRepository(repo, 'latest'),
      logging: ecs.LogDriver.awsLogs({ logGroup, streamPrefix: 'ghost' }),
      environment: {
        url: `https://${blogDomain}`,
        database__client: 'mysql',
        database__connection__host: db.instanceEndpoint.hostname,
        database__connection__user: 'admin',
        storage__active: 's3',
        storage__s3__bucket: mediaBucket.bucketName,
        storage__s3__region: this.region,
        storage__s3__assetHost: `https://${mediaCdnDomain}`
      },
      secrets: {
        database__connection__password: ecs.Secret.fromSecretsManager(db.secret!),
        mail__options__auth__user: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'MailUserParam', '/ghost/mail/user')),
        mail__options__auth__pass: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterName(this, 'MailPassParam', '/ghost/mail/pass'))
      },
      portMappings: [{ containerPort: 2368 }]
    });

    const svc = new ecs.FargateService(this, 'Service', { cluster, taskDefinition: taskDef, desiredCount: 1, assignPublicIp: false });

    const tg = new elbv2.ApplicationTargetGroup(this, 'Tg', {
      vpc, port: 2368, protocol: elbv2.ApplicationProtocol.HTTP, targets: [svc],
      healthCheck: { path: '/', healthyHttpCodes: '200,301,302', interval: Duration.seconds(30) }
    });

    https.addTargetGroups('GhostTg', { targetGroups: [tg] });
  }
}
