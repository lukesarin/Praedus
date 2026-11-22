import { useEffect, useRef } from 'react'

type Props = {
  /** The app's wrapper. The intro reveals it through a circle that grows out of the logo's dot. */
  appRef: React.RefObject<HTMLDivElement | null>
  onDone: () => void
}

const WAVE = 'M6.5 24C6.5 13 19.5 13 19.5 24S32.5 35 32.5 24'

/**
 * The once-per-account intro: the S draws itself, a held breath, the dot lands like a beat,
 * then the app opens out of the dot. A click or any key skips it; reduced motion gets a fade.
 */
export function Intro({ appRef, onDone }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const waveRef = useRef<SVGPathElement>(null)
  const dotRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    const stage = stageRef.current, wave = waveRef.current, dot = dotRef.current, app = appRef.current
    if (!stage || !wave || !dot || !app) return onDone()
    let finished = false
    const running: Animation[] = []
    const run = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
      const a = el.animate(frames, { fill: 'forwards', ...opts })
      running.push(a)
      return a.finished
    }
    const finish = () => {
      if (finished) return
      finished = true
      running.forEach((a) => a.cancel())
      // Inline 'none' beats the stylesheet's initial clip, so there's no flicker as the intro unmounts.
      app.style.clipPath = 'none'
      onDone()
    }
    window.addEventListener('keydown', finish)
    stage.addEventListener('click', finish)

    async function play() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        await run(stage!, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 300 })
        return finish()
      }
      const len = wave!.getTotalLength()
      wave!.style.strokeDasharray = `${len}`
      await run(wave!, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 950, delay: 250, easing: 'cubic-bezier(.65,0,.35,1)' })
      await run(dot!, [{ transform: 'scale(0)' }, { transform: 'scale(1.35)', offset: 0.6 }, { transform: 'scale(1)' }],
        { duration: 380, delay: 380, easing: 'cubic-bezier(.3,1.4,.5,1)' })
      await new Promise((r) => setTimeout(r, 300))
      if (finished) return
      const d = dot!.getBoundingClientRect()
      const cx = d.left + d.width / 2, cy = d.top + d.height / 2
      const far = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy))
      await run(app!, [{ clipPath: `circle(${d.width / 2}px at ${cx}px ${cy}px)` }, { clipPath: `circle(${far}px at ${cx}px ${cy}px)` }],
        { duration: 650, easing: 'cubic-bezier(.7,0,.2,1)' })
      finish()
    }
    play().catch(finish)
    return () => {
      window.removeEventListener('keydown', finish)
      stage.removeEventListener('click', finish)
    }
  }, [appRef, onDone])

  return (
    <div className="intro" ref={stageRef} role="presentation">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path ref={waveRef} d={WAVE} fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
        <circle ref={dotRef} className="intro-dot" cx="40.5" cy="24" r="3.9" fill="currentColor" />
      </svg>
    </div>
  )
}
