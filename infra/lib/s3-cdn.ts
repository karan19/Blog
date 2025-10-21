import { Stack, StackProps, aws_s3 as s3, aws_cloudfront as cf, aws_cloudfront_origins as origins } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class S3CdnStack extends Stack {
  public readonly bucket: s3.Bucket;
  public readonly distro: cf.Distribution;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, 'MediaBucket', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL });
    this.distro = new cf.Distribution(this, 'MediaCdn', {
      defaultBehavior: { origin: new origins.S3Origin(this.bucket), viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS }
    });
  }
}
