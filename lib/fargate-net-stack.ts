import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs'
import * as iam from '@aws-cdk/aws-iam'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns'

import config from './config'
import { Tags } from '@aws-cdk/core';
import { TaskDefinition, Compatibility } from '@aws-cdk/aws-ecs';


export class FargateNetStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    for (const [key, value] of Object.entries(config.tags)) {
      Tags.of(scope).add(key, value)
    }
    const { vpcId } = config.vpc

    const vpc = ec2.Vpc.fromVpcAttributes(this, 'vpc', {
      vpcId, privateSubnetIds: config.vpc.subnetIds, availabilityZones: config.vpc.availabilityZones
    })

    const clusterName = `${config.name}Cluster`
    const cluster = new ecs.Cluster(this, clusterName, {
      vpc,
      clusterName,
    })

    const taskDefinition = new ecs.TaskDefinition(this, `${config.name}TaskDef`, {
      networkMode: ecs.NetworkMode.AWS_VPC,
      compatibility: Compatibility.FARGATE,
      cpu: '1024',
      memoryMiB: '2048',
    })

    taskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: [
        's3:*',
        'kms:*',
        'ssm:*'
      ],
    }))

    taskDefinition.addContainer(`${config.name}TaskContainer`, {
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/amazonlinux/amazonlinux:latest'),
      memoryLimitMiB: 512,
      command: ['bash', '-c', 'echo hello; sleep 86400; echo bye'],
    })

    const securityGroups = config.vpc.securityGroups.map(sgId => ec2.SecurityGroup.fromSecurityGroupId(this, sgId, sgId))

    new ecs.FargateService(this, `${config.name}NetService`, {
      cluster,
      taskDefinition,
      desiredCount: 0,
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      assignPublicIp: false,
      securityGroups,
    }) 
  }
}
