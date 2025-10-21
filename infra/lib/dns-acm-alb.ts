import { Stack, StackProps, aws_route53 as r53, aws_certificatemanager as acm, aws_elasticloadbalancingv2 as elbv2, aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface Props extends StackProps {
  vpc: ec2.IVpc;
  hostedZoneDomain: string;
  domainName: string;
}

export class DnsAcmAlbStack extends Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly https: elbv2.ApplicationListener;

  constructor(scope: Construct, id: string, { vpc, hostedZoneDomain, domainName, ...props }: Props) {
    super(scope, id, props);

    const zone = r53.HostedZone.fromLookup(this, 'Zone', { domainName: hostedZoneDomain });
    const cert = new acm.DnsValidatedCertificate(this, 'Cert', { domainName, hostedZone: zone });

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', { vpc, internetFacing: true });
    const http = this.alb.addListener('Http', { port: 80, open: true });
    http.addAction('RedirectToHttps', {
      action: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true
      })
    });

    this.https = this.alb.addListener('Https', { port: 443, open: true, certificates: [{ certificateArn: cert.certificateArn }] });

    new r53.ARecord(this, 'Alias', {
      zone,
      recordName: domainName.replace(`.${hostedZoneDomain}`, ''),
      target: r53.RecordTarget.fromAlias({
        bind: () => ({ hostedZoneId: this.alb.loadBalancerCanonicalHostedZoneId, dnsName: this.alb.loadBalancerDnsName })
      })
    });
  }
}
