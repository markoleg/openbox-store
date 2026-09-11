'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { applyCommand, issueContext, explainError, explainResult } from '@/lib/reviewClient'
import type { ReviewContext, ReviewAction, ReviewPayload, ReviewCommandResult } from '@/lib/reviewCommands'
import OutcomeForm from './OutcomeForm'

export default function GeneralOutcomeForm({link,version,current}:{link:string;version:number;
    current:{outcome:string|null;firstReactionAt:string|null;hidden:boolean;bannedInSearch:boolean|null}}) {
    const router=useRouter(),[context,setContext]=useState<ReviewContext|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false)
    const [refresh,setRefresh]=useState(0)
    useEffect(()=>{
        let active=true;setContext(null)
        issueContext({kind:'listing',link}).then(ctx=>{
            if(!active)return
            if(ctx.listing_version!==version){setError('Стан змінився. Онови сторінку перед записом результату.');return}
            setError('');setContext(ctx)
        }).catch(e=>{if(active)setError(explainError(e))})
        return ()=>{active=false}
    },[link,version,refresh])
    async function execute(action:ReviewAction,payload:ReviewPayload={}):Promise<ReviewCommandResult|null> {
        if(!context || pending)return null
        setPending(true)
        try{const result=await applyCommand(context.id,action,payload);setError(explainResult(action,result).text);setContext(null);router.refresh();setRefresh(v=>v+1);return result}
        catch(e){setError(explainError(e));return null}finally{setPending(false)}
    }
    return <>{error && <p role="status">{error}</p>}<OutcomeForm target={{kind:'listing',link}} current={current} execute={execute} locked={pending || !context}/></>
}
