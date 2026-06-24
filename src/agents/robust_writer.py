"""Robust blog writer with auto-retry loop using ADK Workflow."""
from google.adk import Agent, Workflow
from google.adk.workflow._graph import Graph, Edge, START
from google.adk.workflow import FunctionNode, JoinNode
from google.adk.workflow import RetryConfig
from src.config import get_settings

settings = get_settings()


def _draft_checker(ctx, node_input):
    """Check the blog_draft in shared state."""
    draft = ctx.state.get("blog_draft")
    if draft is None:
        return {"status": "retry", "message": "No draft found in state"}
    content = draft.get("content", "")
    if len(content.strip()) < 200:
        return {"status": "retry", "message": f"Draft too short ({len(content)} chars), need 200+"}
    return {"status": "okay", "message": "Draft is valid"}


_check_node = FunctionNode(func=_draft_checker, name="draft_check")
_join_node = JoinNode(name="join")

robust_blog_writer = Workflow(
    name="robust_blog_writer",
    description="Writes a blog post with automatic retry on validation failure.",
    retry_config=RetryConfig(max_attempts=settings.max_retries),
    graph=Graph(
        edges=[
            Edge(from_node=START, to_node=_check_node),
            Edge(from_node=_check_node, to_node=_join_node),
        ]
    ),
)
