from datetime import datetime
from uuid import uuid4
import os

from dotenv import load_dotenv
from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    TextContent,
    chat_protocol_spec,
)

load_dotenv()

agent = Agent(
    name=os.getenv("AGENT_NAME", "reptile-chemica"),
    seed=os.getenv("AGENT_SEED_PHRASE"),
    port=int(os.getenv("AGENT_PORT", "8001")),
    mailbox=True,
)

protocol = Protocol(spec=chat_protocol_spec)


@protocol.on_message(ChatMessage)
async def handle_message(ctx: Context, sender: str, msg: ChatMessage):
    await ctx.send(
        sender,
        ChatAcknowledgement(
            timestamp=datetime.now(),
            acknowledged_msg_id=msg.msg_id,
        ),
    )

    text = "".join(
        item.text for item in msg.content if isinstance(item, TextContent)
    ).strip()
    response = "Ask me a networking or system design question and I will help."

    await ctx.send(
        sender,
        ChatMessage(
            timestamp=datetime.now(),
            msg_id=uuid4(),
            content=[
                TextContent(type="text", text=response),
                EndSessionContent(type="end-session"),
            ],
        ),
    )


@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


agent.include(protocol, publish_manifest=True)

if __name__ == "__main__":
    agent.run()
