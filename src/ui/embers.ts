interface Spark {
  x: number
  y: number
  vy: number
  size: number
  life: number
  max: number
}

export function startEmbers(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }
  const sparks: Spark[] = []
  const resize = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)

  let last = performance.now()
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!canvas.hidden) {
      while (sparks.length < 42) {
        sparks.push(spawn(canvas, true))
      }
      context.clearRect(0, 0, canvas.width, canvas.height)
      for (const spark of sparks) {
        spark.life -= dt
        spark.y -= spark.vy * dt
        spark.x += Math.sin(spark.y * 0.02) * 8 * dt
        if (spark.life <= 0) {
          Object.assign(spark, spawn(canvas, false))
        }
        const alpha = Math.max(0, spark.life / spark.max)
        context.fillStyle = `rgba(230, 140, 60, ${alpha * 0.75})`
        context.fillRect(spark.x, spark.y, spark.size, spark.size)
      }
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

function spawn(canvas: HTMLCanvasElement, anywhere: boolean): Spark {
  const max = 1.4 + Math.random() * 2.2
  return {
    x: Math.random() * canvas.width,
    y: anywhere ? Math.random() * canvas.height : canvas.height + 4,
    vy: 28 + Math.random() * 46,
    size: 1 + Math.random() * 2.4,
    life: max,
    max,
  }
}
