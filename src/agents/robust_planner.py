"""Robust blog planner with auto-retry loop using ADK Workflow."""
from google.adk import Agent, Workflow
from google.adk.workflow._graph import Graph, Edge, START
from google.adk.workflow import FunctionNode, JoinNode
from google.adk.workflow import RetryConfig
from src.config import get_settings

settings = get_settings()


def _outline_checker(ctx, node_input):
    """Check the blog_outline in shared state."""
    outline = ctx.state.get("blog_outline")
    if outline is None:
        return {"status": "retry", "message": "No outline found in state"}
    if not outline.get("title"):
        return {"status": "retry", "message": "Missing title"}
    if not outline.get("introduction"):
        return {"status": "retry", "message": "Missing introduction"}
    sections = outline.get("sections", [])
    if len(sections) < 4:
        return {"status": "retry", "message": f"Only {len(sections)} sections, need 4+"}
    if not outline.get("conclusion"):
        return {"status": "retry", "message": "Missing conclusion"}
    return {"status": "okay", "message": "Outline is valid"}


_check_node = FunctionNode(func=_outline_checker, name="outline_check")
_join_node = JoinNode(name="join")

robust_blog_planner = Workflow(
    name="robust_blog_planner",
    description="Plans a blog outline with automatic retry on validation failure.",
    retry_config=RetryConfig(max_attempts=settings.max_retries),
    graph=Graph(
        edges=[
            Edge(from_node=START, to_node=_check_node),
            Edge(from_node=_check_node, to_node=_join_node),
        ]
    ),
)
