import { Stack, StackProps, aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export class ParamsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    new ssm.StringParameter(this, 'MailUser', { parameterName: '/ghost/mail/user', stringValue: 'REPLACE_ME' });
    new ssm.StringParameter(this, 'MailPass', { parameterName: '/ghost/mail/pass', stringValue: 'REPLACE_ME' });
  }
}
