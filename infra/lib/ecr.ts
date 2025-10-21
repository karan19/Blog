import { Stack, StackProps, aws_ecr as ecr } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export class EcrStack extends Stack {
  public readonly repo: ecr.Repository;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    this.repo = new ecr.Repository(this, 'GhostRepo', { repositoryName: 'ghost-repo' });
  }
}
