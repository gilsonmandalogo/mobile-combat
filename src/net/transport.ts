import type { LobbyMessage } from '@src/net/lobby'
import type { SimMessage } from '@src/net/rollback'

export interface NetEnvelope {
  channel: 'sim' | 'lobby'
  body: SimMessage | LobbyMessage
}

export type NetHandler = (message: NetEnvelope) => void

export interface Transport {
  send(message: NetEnvelope): void
  onMessage(handler: NetHandler): () => void
  close(): void
}

export interface Loopback {
  transport: Transport
  take(): NetEnvelope[]
  push(messages: NetEnvelope[]): void
}

export function createLoopback(): Loopback {
  const handlers = new Set<NetHandler>()
  const outbound: NetEnvelope[] = []
  return {
    transport: {
      send(message) {
        outbound.push(message)
      },
      onMessage(handler) {
        handlers.add(handler)
        return () => handlers.delete(handler)
      },
      close() {
        handlers.clear()
      },
    },
    take() {
      return outbound.splice(0)
    },
    push(messages) {
      for (const message of messages) {
        for (const handler of handlers) {
          handler(message)
        }
      }
    },
  }
}

export function packSdp(description: RTCSessionDescriptionInit): string {
  return btoa(JSON.stringify({ type: description.type, sdp: description.sdp ?? '' }))
}

export function unpackSdp(code: string): RTCSessionDescriptionInit {
  const parsed = JSON.parse(atob(code)) as { type?: string; sdp?: string }
  const type = parsed.type === 'offer' || parsed.type === 'answer' ? parsed.type : 'offer'
  return { type, sdp: typeof parsed.sdp === 'string' ? parsed.sdp : '' }
}
