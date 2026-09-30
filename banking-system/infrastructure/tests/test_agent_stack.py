import aws_cdk as cdk
from aws_cdk import assertions

from banking_infrastructure.agent_stack import AgentStack


def test_agent_stack_creates_agentcore_runtime() -> None:
    app = cdk.App()
    stack = AgentStack(
        app,
        "test-agent",
        project_name="banking-system",
        environment_name="dev",
        bedrock_model_id="amazon.nova-micro-v1:0",
    )

    template = assertions.Template.from_stack(stack)

    template.resource_count_is("AWS::BedrockAgentCore::Runtime", 1)
    template.has_resource_properties(
        "AWS::BedrockAgentCore::Runtime",
        {
            "AgentRuntimeName": "banking_system_dev_card_support",
            "EnvironmentVariables": {"BEDROCK_MODEL_ID": "amazon.nova-micro-v1:0"},
            "AgentRuntimeArtifact": {
                "CodeConfiguration": {
                    "Runtime": "PYTHON_3_13",
                    "EntryPoint": ["main.py"],
                }
            },
        },
    )


def test_agent_stack_grants_bedrock_model_invoke() -> None:
    app = cdk.App()
    stack = AgentStack(
        app,
        "test-agent",
        project_name="banking-system",
        environment_name="dev",
        bedrock_model_id="amazon.nova-micro-v1:0",
    )

    template = assertions.Template.from_stack(stack)

    template.has_resource_properties(
        "AWS::IAM::Policy",
        {
            "PolicyDocument": {
                "Statement": assertions.Match.array_with(
                    [
                        assertions.Match.object_like(
                            {
                                "Action": "bedrock:InvokeModel",
                                "Effect": "Allow",
                                "Resource": {
                                    "Fn::Join": assertions.Match.array_with(
                                        [
                                            "",
                                            assertions.Match.array_with(
                                                [
                                                    "arn:",
                                                    {"Ref": "AWS::Partition"},
                                                    ":bedrock:",
                                                    {"Ref": "AWS::Region"},
                                                    "::foundation-model/amazon.nova-micro-v1:0",
                                                ]
                                            ),
                                        ]
                                    )
                                },
                            }
                        )
                    ]
                )
            }
        },
    )


def test_agent_stack_grants_agentcore_log_resource_policy_write() -> None:
    app = cdk.App()
    stack = AgentStack(
        app,
        "test-agent",
        project_name="banking-system",
        environment_name="dev",
        bedrock_model_id="amazon.nova-micro-v1:0",
    )

    template = assertions.Template.from_stack(stack)

    template.has_resource_properties(
        "AWS::IAM::Policy",
        {
            "PolicyDocument": {
                "Statement": assertions.Match.array_with(
                    [
                        assertions.Match.object_like(
                            {
                                "Action": "logs:PutResourcePolicy",
                                "Effect": "Allow",
                                "Resource": "*",
                            }
                        )
                    ]
                )
            }
        },
    )


def test_agent_stack_grants_local_user_runtime_invoke_when_configured() -> None:
    app = cdk.App()
    stack = AgentStack(
        app,
        "test-agent",
        project_name="banking-system",
        environment_name="dev",
        bedrock_model_id="amazon.nova-micro-v1:0",
        local_invoker_user_name="bedrock-dev-user",
    )

    template = assertions.Template.from_stack(stack)

    template.has_resource_properties(
        "AWS::IAM::Policy",
        {
            "Users": ["bedrock-dev-user"],
            "PolicyDocument": {
                "Statement": assertions.Match.array_with(
                    [
                        assertions.Match.object_like(
                            {
                                "Action": "bedrock-agentcore:InvokeAgentRuntime",
                                "Effect": "Allow",
                            }
                        )
                    ]
                )
            },
        },
    )


def test_agent_stack_outputs_runtime_identifiers() -> None:
    app = cdk.App()
    stack = AgentStack(
        app,
        "test-agent",
        project_name="banking-system",
        environment_name="dev",
        bedrock_model_id="amazon.nova-micro-v1:0",
    )

    template = assertions.Template.from_stack(stack)

    template.has_output(
        "AgentRuntimeArn",
        {"Description": "AgentCore runtime ARN for local InvokeAgentRuntime calls."},
    )
    template.has_output(
        "AgentRuntimeId",
        {"Description": "AgentCore runtime identifier."},
    )
    template.has_output(
        "BedrockModelId",
        {
            "Value": "amazon.nova-micro-v1:0",
            "Description": "Bedrock model configured for the smoke-test agent.",
        },
    )
