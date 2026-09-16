'use client'
import {useEffect,useRef,useState} from 'react'

export type ReviewRealtimeStatus='connecting'|'live'|'fallback'
const DEBOUNCE_MS=250,FALLBACK_MIN_MS=60000,FALLBACK_MAX_MS=300000

/** Owner-authenticated, payload-free invalidation. Board data still comes only
 * through the protected API. Polling exists solely while this stream is down. */
export function useReviewRealtime(onInvalidate:()=>void,busy:boolean) {
    const callback=useRef(onInvalidate);callback.current=onInvalidate
    const busyRef=useRef(busy);busyRef.current=busy
    const pending=useRef(false),debounce=useRef<ReturnType<typeof setTimeout>|null>(null)
    const [status,setStatus]=useState<ReviewRealtimeStatus>('connecting')
    useEffect(()=>{
        let source:EventSource|null=null,disposed=false,fallback:ReturnType<typeof setTimeout>|null=null
        let fallbackDelay=FALLBACK_MIN_MS
        const clearFallback=()=>{if(fallback)clearTimeout(fallback);fallback=null;fallbackDelay=FALLBACK_MIN_MS}
        const flush=()=>{
            debounce.current=null
            if(disposed || document.visibilityState!=='visible' || busyRef.current || !pending.current)return
            pending.current=false;callback.current()
        }
        const queue=()=>{
            pending.current=true
            if(document.visibilityState!=='visible'||busyRef.current)return
            if(debounce.current)clearTimeout(debounce.current)
            debounce.current=setTimeout(flush,DEBOUNCE_MS)
        }
        const fallbackTick=()=>{
            if(disposed)return
            if(document.visibilityState==='visible')queue()
            fallbackDelay=Math.min(FALLBACK_MAX_MS,fallbackDelay*2)
            fallback=setTimeout(fallbackTick,fallbackDelay)
        }
        const startFallback=()=>{
            if(disposed)return
            setStatus('fallback')
            if(!fallback)fallback=setTimeout(fallbackTick,fallbackDelay)
        }
        const visible=()=>{if(document.visibilityState==='visible')queue()}
        source=new EventSource('/api/review/realtime')
        source.addEventListener('ready',()=>{if(disposed)return;clearFallback();setStatus('live');queue()})
        source.addEventListener('invalidate',queue)
        source.addEventListener('unavailable',startFallback)
        source.onerror=startFallback
        document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible)
        return ()=>{
            disposed=true;source?.close();clearFallback()
            if(debounce.current)clearTimeout(debounce.current);debounce.current=null
            document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible)
        }
    },[])
    useEffect(()=>{
        if(!busy && pending.current && document.visibilityState==='visible') {
            if(debounce.current)clearTimeout(debounce.current)
            debounce.current=setTimeout(()=>{debounce.current=null;if(!busyRef.current&&pending.current){pending.current=false;callback.current()}},DEBOUNCE_MS)
        }
    },[busy])
    return status
}
