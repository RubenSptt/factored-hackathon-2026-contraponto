from pathlib import Path

import aws_cdk as cdk
from aws_cdk import aws_bedrockagentcore as agentcore
from aws_cdk import aws_iam as iam
from constructs import Construct


class AgentStack(cdk.Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        project_name: str,
        environment_name: str,
        bedrock_model_id: str,
        local_invoker_user_name: str | None = None,
        **kwargs: object,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        cdk.Tags.of(self).add("Project", project_name)
        cdk.Tags.of(self).add("Environment", environment_name)
        cdk.Tags.of(self).add("ManagedBy", "cdk")

        agent_asset_path = (
            Path(__file__).resolve().parents[3]
            / "agent"
            / "runtime"
            / "card_support_agent"
        )
        runtime_name = f"{project_name}_{environment_name}_card_support".replace(
            "-", "_"
        )

        runtime = agentcore.Runtime(
            self,
            "CardSupportAgentRuntime",
            runtime_name=runtime_name,
            agent_runtime_artifact=agentcore.AgentRuntimeArtifact.from_code_asset(
                path=str(agent_asset_path),
                runtime=agentcore.AgentCoreRuntime.PYTHON_3_13,
                entrypoint=["main.py"],
            ),
            environment_variables={"BEDROCK_MODEL_ID": bedrock_model_id},
        )

        runtime.add_to_role_policy(
            iam.PolicyStatement(
                actions=["bedrock:InvokeModel"],
                resources=[
                    f"arn:{cdk.Aws.PARTITION}:bedrock:"
                    f"{cdk.Aws.REGION}::foundation-model/{bedrock_model_id}"
                ],
            )
        )
        runtime.add_to_role_policy(
            iam.PolicyStatement(actions=["logs:PutResourcePolicy"], resources=["*"])
        )
        if local_invoker_user_name is not None:
            local_invoker = iam.User.from_user_name(
                self, "LocalInvokerUser", local_invoker_user_name
            )
            runtime.grant_invoke_runtime(local_invoker)

        cdk.CfnOutput(
            self,
            "AgentRuntimeArn",
            value=runtime.agent_runtime_arn,
            description="AgentCore runtime ARN for local InvokeAgentRuntime calls.",
        )
        cdk.CfnOutput(
            self,
            "AgentRuntimeId",
            value=runtime.agent_runtime_id,
            description="AgentCore runtime identifier.",
        )
        cdk.CfnOutput(
            self,
            "BedrockModelId",
            value=bedrock_model_id,
            description="Bedrock model configured for the smoke-test agent.",
        )
