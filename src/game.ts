import Player from '@src/player'
import type { HeroName } from '@src/hero'
import Animations from '@src/animations'
import { ErrorUndefinedProperty } from '@src/errors'
import { updateDebug } from '@src/debug'
import { settingsStore } from '@stores/settings'

interface GameConstructor {
  roundTime: number
  domElement: HTMLElement
  scene: THREE.Scene
}

export default class Game {
  private _player1?: Player
  public get player1() {
    if (!this._player1) {
      throw new ErrorUndefinedProperty('player1')
    }

    return this._player1
  }

  private _player2?: Player
  public get player2() {
    if (!this._player2) {
      throw new ErrorUndefinedProperty('player2')
    }

    return this._player2
  }

  private _gameStatus: 'paused' | 'running' | 'ended' = 'running'
  public get gameStatus() {
    return this._gameStatus
  }
  public set gameStatus(value) {
    this._gameStatus = value
    updateDebug('Game stauts', value)
  }

  private _currentRoundTime: number
  public get currentRoundTime() {
    return this._currentRoundTime
  }
  public set currentRoundTime(value) {
    if (value >= 0) {
      this._currentRoundTime = value
      updateDebug('Round time', value)
    } else {
      const winner = this.player1.life >= this.player2.life ? this.player1 : this.player2
      winner.score++
      this.endTurn(`${winner.playerName} wins`)
    }
  }

  private _currentRound = 1
  public get currentRound() {
    return this._currentRound
  }
  public set currentRound(value) {
    this._currentRound = value
    this.player1.hero.actor.position.x = -4
    this.player2.hero.actor.position.x = 4
    this.player1.life = this.player1.maxLife
    this.player2.life = this.player2.maxLife
    this.currentRoundTime = this.roundTime
    updateDebug('Round', value)
  }

  private domElement: HTMLElement
  private scene: THREE.Scene
  private roundTime: number

  constructor({
    roundTime,
    domElement,
    scene,
  }: GameConstructor) {
    this.roundTime = roundTime
    this._currentRoundTime = roundTime
    this.domElement = domElement
    this.scene = scene

    this.gameStatus = 'running'

    setInterval(() => {
      if (this.gameStatus === 'running') {
        this.currentRoundTime--
      }
    }, 1000)
  }

  public async init() {
    const animationController = new Animations()
    await animationController.loadAnimations()

    this._player1 = new Player({
      playerName: 'Player 1',
      playerNumber: 'player1',
      domElement: this.domElement,
      heroName: 'Mr Colin Cole' as HeroName,
      scene: this.scene,
      animations: animationController.animations,
      leftSide: true,
      hitCallback: this.playerHit,
    })
    
    this._player2 = new Player({
      playerName: 'Player 2',
      playerNumber: 'player2',
      domElement: this.domElement,
      heroName: 'Mr Colin Cole' as HeroName,
      scene: this.scene,
      animations: animationController.animations,
      leftSide: false,
      hitCallback: this.playerHit,
    })

    await Promise.all([
      this.player1.loadData(),
      this.player2.loadData(),
    ])

    this.player1.enemy = this.player2
    this.player2.enemy = this.player1

    this.player1.hero.actor.rotateY(Math.PI / 2)
    this.player2.hero.actor.rotateY(-Math.PI / 2)

    this.currentRound = 1

    this.domElement.addEventListener('keydown', this.onKeyDown)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const { menu } = settingsStore.get().inputs

    if (e.code === menu) {
      if (!['running', 'paused'].includes(this.gameStatus)) {
        return
      }

      this.gameStatus = this.gameStatus === 'running' ? 'paused' : 'running'
    }
  }

  private playerHit = (player: Player) => {
    if (player.life <= 0) {
      player.enemy.score++
      this.endTurn(`${player.enemy.playerName} wins`)
    }
  }

  private endTurn(reason: string) {
    console.log(reason)
    
    if (this.currentRound === 1) {
      this.currentRound++
      return
    }

    if (this.currentRound === 2) {
      if (this.player1.score === 2 || this.player2.score === 2) {
        this.endGame()
        return
      }

      this.currentRound++
      return
    }

    this.endGame()
  }

  private endGame() {
    this.gameStatus = 'ended'
    console.log('Game ended')
  }

  public update(delta: number) {
    if (this.gameStatus === 'paused') {
      return
    }

    this.player1.update(delta)
    this.player2.update(delta)
  }
}
