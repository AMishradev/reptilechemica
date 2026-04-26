from datetime import datetime
from types import MethodType
from uuid import uuid4
import asyncio
import os

import aiohttp
from aiohttp.client_exceptions import ClientConnectorError
from dotenv import load_dotenv
from openai import OpenAI
from uagents import Agent, Context, Protocol
from uagents.mailbox import StoredEnvelope
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


def use_agentverse_key_for_mailbox_polling(agent_instance: Agent):
    agentverse_key = os.getenv("AGENTVERSE_API_KEY")
    mailbox_client = agent_instance.mailbox_client
    if not agentverse_key or mailbox_client is None:
        return

    async def check_mailbox_loop(self):
        self._logger.info("Using AGENTVERSE_API_KEY for mailbox polling")
        while True:
            try:
                async with aiohttp.ClientSession() as session:
                    agents_url = self._agentverse.agents_api
                    async with session.get(
                        f"{agents_url}/{self._identity.address}/mailbox",
                        headers={"Authorization": f"Bearer {agentverse_key}"},
                    ) as resp:
                        if resp.status == 200:
                            items = await resp.json()
                            for item in items:
                                stored_env = StoredEnvelope.model_validate(item)
                                await self._handle_envelope(stored_env)
                        elif resp.status == 404:
                            if not self._missing_mailbox_warning_logged:
                                self._logger.warning(
                                    "Agent mailbox not found: create one using the agent inspector"
                                )
                                self._missing_mailbox_warning_logged = True
                        else:
                            self._logger.error(
                                f"Failed to retrieve messages: {resp.status}:{await resp.text()}"
                            )
            except (ClientConnectorError, asyncio.TimeoutError) as error:
                self._logger.warning(f"Failed to connect to mailbox server: {error}")
            except Exception as error:
                self._logger.exception(f"Got exception while checking mailbox: {error}")

            await asyncio.sleep(self._poll_interval)

    async def delete_envelope(self, uuid):
        try:
            async with aiohttp.ClientSession() as session:
                agents_url = self._agentverse.agents_api
                async with session.delete(
                    f"{agents_url}/{self._identity.address}/mailbox/{str(uuid)}",
                    headers={"Authorization": f"Bearer {agentverse_key}"},
                ) as resp:
                    if resp.status >= 300:
                        self._logger.exception(
                            f"Failed to delete envelope from inbox: {await resp.text()}"
                        )
        except ClientConnectorError as error:
            self._logger.warning(f"Failed to connect to mailbox server: {error}")
        except Exception as error:
            self._logger.exception(f"Got exception while deleting message: {error}")

    mailbox_client._check_mailbox_loop = MethodType(check_mailbox_loop, mailbox_client)
    mailbox_client._delete_envelope = MethodType(delete_envelope, mailbox_client)


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
use_agentverse_key_for_mailbox_polling(agent)

if __name__ == "__main__":
    agent.run()
