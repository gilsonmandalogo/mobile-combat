import { byeMessage } from '@src/net/lobby'
import type { Lobby } from '@src/net/lobby'
import type { NetEnvelope, Transport } from '@src/net/transport'

export async function openTrystero(code: string, lobby: Lobby): Promise<Transport> {
  const { joinRoom } = await import('trystero/nostr')
  const room = joinRoom({ appId: 'mobile-combat' }, code)
  const [send, receive] = room.makeAction<NetEnvelope>('mc')
  const handlers = new Set<(message: NetEnvelope) => void>()
  let peers = 0
  receive((data) => {
    if (!data || typeof data !== 'object' || !('channel' in data)) {
      return
    }
    for (const handler of handlers) {
      handler(data)
    }
  })
  room.onPeerJoin(() => {
    peers += 1
  })
  room.onPeerLeave(() => {
    peers = Math.max(0, peers - 1)
    if (peers === 0) {
      const bye: NetEnvelope = { channel: 'lobby', body: byeMessage(lobby) }
      for (const handler of handlers) {
        handler(bye)
      }
    }
  })
  return {
    send(message) {
      void send(message).catch(() => undefined)
    },
    onMessage(handler) {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    close() {
      handlers.clear()
      void room.leave().catch(() => undefined)
    },
  }
}
