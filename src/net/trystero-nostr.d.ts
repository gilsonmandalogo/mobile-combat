declare module 'trystero/nostr' {
  export interface Room {
    makeAction<T>(namespace: string): [
      (data: T) => Promise<unknown>,
      (receiver: (data: T) => void) => void,
    ]
    leave(): Promise<void>
    onPeerJoin(fn: () => void): void
    onPeerLeave(fn: () => void): void
  }

  export function joinRoom(config: { appId: string }, roomId: string): Room
}
