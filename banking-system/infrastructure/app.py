import os

import aws_cdk as cdk

from banking_infrastructure.agent_stack import AgentStack
from banking_infrastructure.foundation_stack import FoundationStack

app = cdk.App()

project_name = app.node.try_get_context("project_name") or "banking-system"
environment_name = app.node.try_get_context("environment") or "dev"
bedrock_model_id = (
    app.node.try_get_context("bedrock_model_id") or "amazon.nova-micro-v1:0"
)
local_invoker_user_name = app.node.try_get_context("local_invoker_user_name")
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

AgentStack(
    app,
    f"{project_name}-{environment_name}-agent",
    project_name=project_name,
    environment_name=environment_name,
    bedrock_model_id=bedrock_model_id,
    local_invoker_user_name=local_invoker_user_name,
    env=cdk.Environment(
        account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
        region=region,
    ),
)

app.synth()
