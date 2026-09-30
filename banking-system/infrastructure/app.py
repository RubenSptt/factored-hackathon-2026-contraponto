import os

import aws_cdk as cdk

from banking_infrastructure.foundation_stack import FoundationStack

app = cdk.App()

project_name = app.node.try_get_context("project_name") or "banking-system"
environment_name = app.node.try_get_context("environment") or "dev"
region = (
    app.node.try_get_context("aws_region")
    or os.environ.get("CDK_DEFAULT_REGION")
    or "us-east-1"
)

FoundationStack(
    app,
    f"{project_name}-{environment_name}-foundation",
    project_name=project_name,
    environment_name=environment_name,
    env=cdk.Environment(
        account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
        region=region,
    ),
)

app.synth()
