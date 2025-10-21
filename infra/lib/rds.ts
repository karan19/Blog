import { Stack, StackProps, aws_ec2 as ec2, aws_rds as rds, aws_secretsmanager as sm } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface Props extends StackProps { vpc: ec2.IVpc; instanceClass?: rds.InstanceType; }

export class RdsStack extends Stack {
  public readonly db: rds.DatabaseInstance;
  public readonly secret: sm.Secret;

  constructor(scope: Construct, id: string, { vpc, ...props }: Props) {
    super(scope, id, props);

    this.secret = new sm.Secret(this, 'DbSecret'); // admin user + pwd
    this.db = new rds.DatabaseInstance(this, 'Mysql', {
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0_35 }),
      vpc,
      credentials: rds.Credentials.fromSecret(this.secret),
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      allocatedStorage: 50,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      multiAz: false
    });
  }
}
