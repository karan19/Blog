import {
  Stack, StackProps,
  aws_certificatemanager as acm,
  aws_route53 as r53
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface Props extends StackProps {
  hostedZoneDomain: string;
  blogDomain: string;
}

export class CertificateStack extends Stack {
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, {
      ...props,
      env: {
        account: props.env?.account ?? process.env.CDK_DEFAULT_ACCOUNT,
        region: "us-east-1"
      }
    });

    const zone = r53.HostedZone.fromLookup(this, "Zone", {
      domainName: props.hostedZoneDomain
    });

    this.certificate = new acm.Certificate(this, "SiteCert", {
      domainName: props.blogDomain,
      validation: acm.CertificateValidation.fromDns(zone)
    });
  }
}
