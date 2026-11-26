import type { MatchState } from '@src/sim/types'

export interface DebugFighter {
  id: string
  name: string
  life: number
  maxLife: number
  x: number
  y: number
  vx: number
  score: number
  action: string
  facing: number
  device: string
  blocking: boolean
  ko: boolean
}

export interface DebugSnapshot {
  ready: boolean
  status: string
  mode: string
  difficulty: string
  round: number
  timeLeft: number
  introTime: number
  banner: string | null
  winner: string | null
  roundWinner: string | null
  life: { player1: number; player2: number }
  score: { player1: number; player2: number }
  fighters: [DebugFighter, DebugFighter]
}

export function snapshotMatch(state: MatchState, ready: boolean): DebugSnapshot {
  const fighters = state.fighters.map((fighter): DebugFighter => ({
    id: fighter.id,
    name: fighter.name,
    life: fighter.life,
    maxLife: fighter.maxLife,
    x: fighter.x,
    y: fighter.y,
    vx: fighter.vx,
    score: fighter.score,
    action: fighter.action,
    facing: fighter.facing,
    device: fighter.device,
    blocking: fighter.blocking,
    ko: fighter.ko,
  })) as [DebugFighter, DebugFighter]

  return {
    ready,
    status: state.status,
    mode: state.mode,
    difficulty: state.difficulty,
    round: state.round,
    timeLeft: state.timeLeft,
    introTime: state.introTime,
    banner: state.banner,
    winner: state.winner,
    roundWinner: state.roundWinner,
    life: { player1: fighters[0].life, player2: fighters[1].life },
    score: { player1: fighters[0].score, player2: fighters[1].score },
    fighters,
  }
}
