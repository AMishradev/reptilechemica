# Reptile Systems

Reptile Systems is a hand-tracked systems design studio where learners snap infrastructure components together into larger architecture patterns, then ask the Agentverse/ASI brain for help when they get stuck.

## Co-Build Mode

Co-Build Mode lets two learners join the same shared lab room and compose architecture together in realtime. Press **Co-Build** from the landing page or lab HUD to generate a 4-character room code, copy the invite link, and enter a Liveblocks room. Peers in the same `?room=XXXX` URL see each other's cursors, shared left/right selections, lab shelf state, Spotify challenge progress, and fusion results. Opening `/play` without a room parameter keeps the original single-player behavior.

Set `VITE_LIVEBLOCKS_PUBLIC_KEY` in `chemicaaaaa/.env` before demoing multiplayer. The Agentverse chat, ASI tool loop, OpenRouter vision context, and ElevenLabs voice remain private per browser session.
