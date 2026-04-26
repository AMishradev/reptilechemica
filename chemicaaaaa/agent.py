from datetime import datetime
from types import MethodType
from uuid import uuid4
import asyncio
import json
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
    "You are Reptile Chemica, the Reptile Chemica lab guide. You only answer questions "
    "about the Reptile Chemica system-design lab, computer networking, "
    "distributed systems, cloud architecture, and system design. Keep answers "
    "under 90 words, friendly, direct, and plain text with no emoji, markdown, "
    "bullets, or bold markers. Use the lookup_combination tool whenever the "
    "user asks whether lab components combine, what a fusion creates, or how "
    "two components relate in the lab. After the tool returns, explain the "
    "exact fusion result and the next lab action. If APP and CACHE seem stuck, "
    "tell the user to select the APP and CACHE lab components exactly, then "
    "perform the snap/fusion gesture."
)

COMBINATIONS = {
    tuple(sorted(("CLIENT", "DNS"))): {
        "resultSymbol": "EDGE",
        "resultName": "Edge Entry",
        "description": "A user request that can resolve a service endpoint and enter the platform.",
    },
    tuple(sorted(("CDN", "OBJ"))): {
        "resultSymbol": "MEDIA",
        "resultName": "Media Delivery",
        "description": "A static asset path optimized for cacheable, low-latency delivery.",
    },
    tuple(sorted(("APP", "LB"))): {
        "resultSymbol": "POOL",
        "resultName": "Service Pool",
        "description": "A horizontally scaled set of application servers behind traffic balancing.",
    },
    tuple(sorted(("API", "APP"))): {
        "resultSymbol": "SVC",
        "resultName": "Backend Service",
        "description": "A routed service boundary that exposes business capabilities through an API.",
    },
    tuple(sorted(("APP", "DB"))): {
        "resultSymbol": "CRUD",
        "resultName": "Transactional Service",
        "description": "A service that reads and writes durable application data.",
    },
    tuple(sorted(("APP", "CACHE"))): {
        "resultSymbol": "FAST",
        "resultName": "Cached Service",
        "description": "A low-latency service path backed by cached reads.",
    },
    tuple(sorted(("APP", "QUEUE"))): {
        "resultSymbol": "ASYNC",
        "resultName": "Async Worker Flow",
        "description": "A resilient background-processing path for jobs outside the request cycle.",
    },
    tuple(sorted(("API", "LB"))): {
        "resultSymbol": "ROUTE",
        "resultName": "Routed Traffic",
        "description": "Ingress traffic routed to healthy service capacity.",
    },
    tuple(sorted(("CACHE", "DB"))): {
        "resultSymbol": "READ",
        "resultName": "Read Path",
        "description": "A data access pattern that can serve hot reads from cache and fall back to storage.",
    },
    tuple(sorted(("DB", "QUEUE"))): {
        "resultSymbol": "JOBDB",
        "resultName": "Job Persistence",
        "description": "Queued work with durable progress, retry, and result tracking.",
    },
    tuple(sorted(("API", "CDN"))): {
        "resultSymbol": "BFF",
        "resultName": "Frontend Gateway",
        "description": "A user-facing gateway that can mix cached assets with dynamic API calls.",
    },
    tuple(sorted(("CDN", "CLIENT"))): {
        "resultSymbol": "STATIC",
        "resultName": "Static Frontend",
        "description": "A frontend delivery path served close to users through edge caching.",
    },
    tuple(sorted(("EDGE", "ROUTE"))): {
        "resultSymbol": "WEBAPP",
        "resultName": "Web Application",
        "description": "A complete entry path from user request through edge routing into backend capacity.",
    },
    tuple(sorted(("CRUD", "SVC"))): {
        "resultSymbol": "APIAPP",
        "resultName": "API Application",
        "description": "A backend application that exposes APIs and persists transactional data.",
    },
    tuple(sorted(("ASYNC", "FAST"))): {
        "resultSymbol": "SCALE",
        "resultName": "Scalable Service",
        "description": "A service that combines low-latency reads with asynchronous background processing.",
    },
    tuple(sorted(("MEDIA", "STATIC"))): {
        "resultSymbol": "CONTENT",
        "resultName": "Content Platform",
        "description": "A system for serving frontend assets and user media through durable storage and edge delivery.",
    },
    tuple(sorted(("CRUD", "READ"))): {
        "resultSymbol": "DATA",
        "resultName": "Data Platform",
        "description": "A data layer that supports durable writes and optimized read access.",
    },
    tuple(sorted(("ASYNC", "JOBDB"))): {
        "resultSymbol": "WORKER",
        "resultName": "Worker Platform",
        "description": "A background processing system with queued work, durable state, and retryable execution.",
    },
}

ALIASES = {
    "APPLICATION": "APP",
    "APPSERVER": "APP",
    "APPP": "APP",
    "SERVER": "APP",
    "DATABASE": "DB",
    "DBMS": "DB",
    "CACHING": "CACHE",
    "LOADBALANCER": "LB",
    "BALANCER": "LB",
    "APIGATEWAY": "API",
    "GATEWAY": "API",
    "OBJECTSTORE": "OBJ",
    "OBJECTSTORAGE": "OBJ",
}

LOOKUP_COMBINATION_TOOL = {
    "type": "function",
    "function": {
        "name": "lookup_combination",
        "description": "Look up the Reptile Chemica lab fusion result for two component symbols or names.",
        "parameters": {
            "type": "object",
            "properties": {
                "element_a": {
                    "type": "string",
                    "description": "The first lab component, such as APP, CACHE, DB, LB, API, EDGE, or ROUTE.",
                },
                "element_b": {
                    "type": "string",
                    "description": "The second lab component, such as APP, CACHE, DB, LB, API, EDGE, or ROUTE.",
                },
            },
            "required": ["element_a", "element_b"],
            "additionalProperties": False,
        },
    },
}


def normalize_element_symbol(value: str) -> str:
    compact = "".join(ch for ch in value.upper() if ch.isalnum())
    if compact in ALIASES:
        return ALIASES[compact]
    if compact.startswith("APP"):
        return "APP"
    if compact.startswith("CACHE"):
        return "CACHE"
    return compact


def lookup_combination(element_a: str, element_b: str) -> dict:
    normalized_a = normalize_element_symbol(element_a)
    normalized_b = normalize_element_symbol(element_b)
    result = COMBINATIONS.get(tuple(sorted((normalized_a, normalized_b))))

    if result is None:
        return {
            "found": False,
            "elementA": normalized_a,
            "elementB": normalized_b,
            "guidance": (
                f"No known Reptile Chemica fusion exists for {normalized_a} + "
                f"{normalized_b}. Try selecting a valid pair from the lab shelf, "
                "then use the snap/fusion gesture."
            ),
        }

    return {
        "found": True,
        "elementA": normalized_a,
        "elementB": normalized_b,
        **result,
        "guidance": (
            f"{normalized_a} + {normalized_b} combines into "
            f"{result['resultSymbol']} / {result['resultName']}. Select those "
            "two lab components exactly, then perform the snap/fusion gesture."
        ),
    }


def should_use_combination_tool(text: str) -> bool:
    normalized = text.lower()
    mentions_fusion_action = any(
        token in normalized
        for token in ("combine", "fusion", "fuse", "mix", "pair", "merge", "snap", "+")
    )
    component_patterns = (
        ("app", "application", "appserver"),
        ("cache", "caching"),
        ("db", "database"),
        ("lb", "load balancer", "balancer"),
        ("api", "gateway"),
        ("queue",),
        ("cdn",),
        ("dns",),
        ("client",),
        ("obj", "object stor"),
        ("edge",),
        ("route",),
        ("fast",),
        ("async",),
        ("crud",),
        ("read",),
        ("svc",),
        ("media",),
        ("static",),
        ("jobdb",),
    )
    component_mentions = sum(
        1
        for pattern_group in component_patterns
        if any(pattern in normalized for pattern in pattern_group)
    )
    asks_about_two_components = component_mentions >= 2 and any(
        token in normalized
        for token in (
            "add",
            "with",
            "between",
            "relate",
            "layer",
            "stuck",
            "wrong",
            "can't",
            "cant",
            "cannot",
            "doesn't",
            "dont",
            "do not",
            "won't",
            "into",
        )
    )
    return mentions_fusion_action or asks_about_two_components


def create_asi_response(text: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": text},
    ]
    request = {
        "model": os.getenv("ASI_MODEL", "asi1-mini"),
        "messages": messages,
        "max_tokens": 220,
        "temperature": 0.35,
    }

    if should_use_combination_tool(text):
        request["tools"] = [LOOKUP_COMBINATION_TOOL]
        request["tool_choice"] = {
            "type": "function",
            "function": {"name": "lookup_combination"},
        }

    result = client.chat.completions.create(**request)
    message = result.choices[0].message
    tool_calls = getattr(message, "tool_calls", None) or []
    tool_call = next(
        (
            call
            for call in tool_calls
            if getattr(getattr(call, "function", None), "name", None) == "lookup_combination"
        ),
        None,
    )

    if tool_call is None:
        return str(message.content or "")

    try:
        args = json.loads(tool_call.function.arguments or "{}")
    except json.JSONDecodeError:
        args = {}

    tool_result = lookup_combination(
        str(args.get("element_a", "")),
        str(args.get("element_b", "")),
    )
    messages.extend(
        [
            message.model_dump(exclude_none=True),
            {
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(tool_result),
            },
        ]
    )
    final = client.chat.completions.create(
        model=os.getenv("ASI_MODEL", "asi1-mini"),
        messages=messages,
        max_tokens=220,
        temperature=0.35,
    )
    return str(final.choices[0].message.content or "")

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
            response = create_asi_response(text)
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
