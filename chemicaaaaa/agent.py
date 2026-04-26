from datetime import datetime
from uuid import uuid4
import os

from dotenv import load_dotenv
from openai import OpenAI
from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    TextContent,
    chat_protocol_spec,
)

load_dotenv()

SYSTEM_PROMPT = (
    "You are Reptile Chemica lab guide. You only answer questions "
    "about the Reptile Chemica system-design lab, computer networking, "
    "distributed systems, cloud architecture, and system design. Keep answers "
    "under 90 words, friendly, direct, and plain text with no emoji, markdown, "
    "bullets, or bold markers. In this lab, valid fusions include APP + CACHE = "
    "FAST / Cached Service, APP + DB = CRUD, APP + QUEUE = ASYNC, LB + APP = "
    "POOL, API + APP = SVC, API + LB = ROUTE, DB + CACHE = READ, QUEUE + DB = "
    "JOBDB, CLIENT + DNS = EDGE, CDN + OBJ = MEDIA, CDN + API = BFF, "
    "CLIENT + CDN = STATIC, FAST + ASYNC = SCALE. If a user says APP and CACHE "
    "cannot combine, explain that they can: select the APP and CACHE lab "
    "components exactly, then perform the snap/fusion gesture."
)

client = OpenAI(
    base_url="https://api.asi1.ai/v1",
    api_key=os.getenv("ASI_API_KEY"),
)

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
    response = "Sorry, something went wrong."

    if not text:
        response = "Ask me a networking or system design question and I will help."
    else:
        try:
            result = client.chat.completions.create(
                model=os.getenv("ASI_MODEL", "asi1-mini"),
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": text},
                ],
                max_tokens=220,
            )
            response = str(result.choices[0].message.content)
        except Exception as error:
            ctx.logger.error(f"ASI:One call failed: {error}")

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
