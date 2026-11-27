import { packSdp, unpackSdp } from '@src/net/transport'
import type { NetEnvelope, Transport } from '@src/net/transport'

const STUN = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

export interface ManualPeer extends Transport {
  offer(): Promise<string>
  takeOffer(code: string): Promise<string>
  takeAnswer(code: string): Promise<void>
}

export function createManualPeer(): ManualPeer {
  if (typeof RTCPeerConnection !== 'function') {
    throw new Error('WebRTC is not available in this browser.')
  }
  const peer = new RTCPeerConnection(STUN)
  const handlers = new Set<(message: NetEnvelope) => void>()
  const queued: NetEnvelope[] = []
  let channel: RTCDataChannel | null = null

  const flush = () => {
    if (!channel || channel.readyState !== 'open') {
      return
    }
    for (const message of queued.splice(0)) {
      channel.send(JSON.stringify(message))
    }
  }

  const bind = (next: RTCDataChannel) => {
    channel = next
    next.onmessage = (event) => {
      const parsed = JSON.parse(String(event.data)) as NetEnvelope
      for (const handler of handlers) {
        handler(parsed)
      }
    }
    next.onopen = flush
  }

  peer.ondatachannel = (event) => bind(event.channel)

  const gather = () => new Promise<void>((resolve) => {
    const finish = () => {
      peer.removeEventListener('icegatheringstatechange', finish)
      resolve()
    }
    if (peer.iceGatheringState === 'complete') {
      resolve()
      return
    }
    peer.addEventListener('icegatheringstatechange', () => {
      if (peer.iceGatheringState === 'complete') {
        finish()
      }
    })
    setTimeout(finish, 4000)
  })

  return {
    async offer() {
      const opened = peer.createDataChannel('sim')
      bind(opened)
      const description = await peer.createOffer()
      await peer.setLocalDescription(description)
      await gather()
      return packSdp(peer.localDescription ?? description)
    },
    async takeOffer(code) {
      await peer.setRemoteDescription(unpackSdp(code))
      const description = await peer.createAnswer()
      await peer.setLocalDescription(description)
      await gather()
      return packSdp(peer.localDescription ?? description)
    },
    async takeAnswer(code) {
      await peer.setRemoteDescription(unpackSdp(code))
    },
    send(message) {
      queued.push(message)
      flush()
    },
    onMessage(handler) {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    close() {
      handlers.clear()
      channel?.close()
      peer.close()
    },
  }
}
