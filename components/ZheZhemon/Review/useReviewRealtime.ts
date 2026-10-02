'use client'
import {useEffect,useRef,useState} from 'react'

export type ReviewRealtimeStatus='connecting'|'live'|'fallback'|'polling'
const DEBOUNCE_MS=250,POLL_MS=30000,FALLBACK_MIN_MS=60000,FALLBACK_MAX_MS=300000

/** Owner-authenticated, payload-free invalidation. Board data still comes only
 * through the protected API. The new queue uses fixed polling; the journal
 * retains the stream and its fallback polling.
 *
 * In polling mode `changed` is asked first, and only a yes (or a failed
 * check) reloads: each board reload is ~100 KB of Supabase egress, the check
 * a few bytes, and most polls find nothing new. */
export function useReviewRealtime(onInvalidate:()=>void,busy:boolean,mode:'realtime'|'polling'='realtime',changed?:()=>Promise<boolean>) {
    const callback=useRef(onInvalidate);callback.current=onInvalidate
    const changedRef=useRef(changed);changedRef.current=changed
    const busyRef=useRef(busy);busyRef.current=busy
    const pending=useRef(false),debounce=useRef<ReturnType<typeof setTimeout>|null>(null)
    const [status,setStatus]=useState<ReviewRealtimeStatus>(mode==='polling'?'polling':'connecting')
    useEffect(()=>{
        let source:EventSource|null=null,disposed=false,fallback:ReturnType<typeof setTimeout>|null=null,poll:ReturnType<typeof setInterval>|null=null
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
        const check=async()=>{
            if(document.visibilityState!=='visible')return
            let stale=true
            try{if(changedRef.current)stale=await changedRef.current()}catch{/* unknown: reload */}
            if(stale && !disposed)queue()
        }
        const visible=()=>{if(document.visibilityState!=='visible')return;if(mode==='polling')void check();else queue()}
        if(mode==='polling') {
            setStatus('polling')
            poll=setInterval(()=>void check(),POLL_MS)
        } else {
            setStatus('connecting')
            source=new EventSource('/api/review/realtime')
            source.addEventListener('ready',()=>{if(disposed)return;clearFallback();setStatus('live');queue()})
            source.addEventListener('invalidate',queue)
            source.addEventListener('unavailable',startFallback)
            source.onerror=startFallback
        }
        document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible)
        return ()=>{
            disposed=true;source?.close();clearFallback()
            if(poll)clearInterval(poll)
            pending.current=false
            if(debounce.current)clearTimeout(debounce.current);debounce.current=null
            document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible)
        }
    },[mode])
    useEffect(()=>{
        if(!busy && pending.current && document.visibilityState==='visible') {
            if(debounce.current)clearTimeout(debounce.current)
            debounce.current=setTimeout(()=>{debounce.current=null;if(!busyRef.current&&pending.current){pending.current=false;callback.current()}},DEBOUNCE_MS)
        }
    },[busy])
    return status
}
