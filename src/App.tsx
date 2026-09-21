import { useState, useEffect, useRef, useCallback } from 'react'
import { DUA_LIBRARY, LIBRARY_CATEGORIES, type LibraryDua } from './duaLibrary'

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Dua {
  id: string; name: string; arabic: string; translation: string
  target: number; color: string; count: number
  totalAllTime: number; streak: number; lastActiveDate: string
  favourite: boolean
}
interface DayRecord { date: string; total: number; perDua: Record<string, number> }
interface AppState  { duas: Dua[]; history: DayRecord[]; lastResetDate: string }

/* ── Defaults ───────────────────────────────────────────────────────────────── */
const DEFAULTS: Dua[] = [
  { id:'1', name:'SubhanAllah',    arabic:'سُبْحَانَ اللّٰه',    translation:'Glory be to Allah',             target:33,  color:'#34d399', count:0, totalAllTime:0, streak:0, lastActiveDate:'', favourite:false },
  { id:'2', name:'Alhamdulillah',  arabic:'الْحَمْدُ لِلّٰه',     translation:'All praise is for Allah',        target:33,  color:'#60a5fa', count:0, totalAllTime:0, streak:0, lastActiveDate:'', favourite:false },
  { id:'3', name:'Allahu Akbar',   arabic:'اللّٰهُ أَكْبَر',      translation:'Allah is the Greatest',          target:34,  color:'#a78bfa', count:0, totalAllTime:0, streak:0, lastActiveDate:'', favourite:false },
  { id:'4', name:'Astaghfirullah', arabic:'أَسْتَغْفِرُ اللّٰه',  translation:'I seek forgiveness from Allah',  target:100, color:'#fbbf24', count:0, totalAllTime:0, streak:0, lastActiveDate:'', favourite:false },
]

const COLORS  = ['#34d399','#60a5fa','#a78bfa','#fbbf24','#fb7185','#2dd4bf','#f472b6','#818cf8']
const TARGETS = [11, 33, 34, 99, 100, 313, 500, 1000]

const DUA_COLORS: Record<string, { from: string; to: string; glow: string }> = {
  '#34d399': { from:'#065f46', to:'#064e3b', glow:'#34d39922' },
  '#60a5fa': { from:'#1e3a5f', to:'#1e3050', glow:'#60a5fa22' },
  '#a78bfa': { from:'#3b1f6e', to:'#2e1a5a', glow:'#a78bfa22' },
  '#fbbf24': { from:'#78350f', to:'#62290a', glow:'#fbbf2422' },
  '#fb7185': { from:'#6b1231', to:'#581028', glow:'#fb718522' },
  '#2dd4bf': { from:'#134e4a', to:'#0f3d3a', glow:'#2dd4bf22' },
  '#f472b6': { from:'#6b1d5a', to:'#571548', glow:'#f472b622' },
  '#818cf8': { from:'#1e1b4b', to:'#18163d', glow:'#818cf822' },
}
function getTheme(color: string) { return DUA_COLORS[color] ?? { from:'#1a2535', to:'#111827', glow:color+'22' } }

function today() { return new Date().toISOString().slice(0,10) }
function load(): AppState {
  try {
    const r = localStorage.getItem('tasbih-v5')
    if (r) {
      const parsed = JSON.parse(r) as AppState
      // migrate: add favourite field if missing
      parsed.duas = parsed.duas.map(d => ({ ...d, favourite: d.favourite ?? false }))
      return parsed
    }
  } catch {}
  return { duas: DEFAULTS, history: [], lastResetDate: today() }
}
function save(s: AppState) { localStorage.setItem('tasbih-v5', JSON.stringify(s)) }

/* ── Ripple ──────────────────────────────────────────────────────────────── */
function useRipple() {
  const [ripples, set] = useState<{id:number;x:number;y:number;size:number}[]>([])
  const add = useCallback((e: React.MouseEvent|React.TouchEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pt = 'touches' in e ? {x:e.touches[0].clientX, y:e.touches[0].clientY}
                              : {x:(e as React.MouseEvent).clientX, y:(e as React.MouseEvent).clientY}
    const size = Math.max(box.width, box.height) * 2.8
    const id = Date.now() + Math.random()
    set(r => [...r, {id, x:pt.x-box.left-size/2, y:pt.y-box.top-size/2, size}])
    setTimeout(() => set(r => r.filter(i => i.id !== id)), 700)
  }, [])
  return { ripples, add }
}

/* ═══════════════════════════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [state, setState]   = useState<AppState>(load)
  const [activeId, setActiveId] = useState(DEFAULTS[0].id)
  const [tab, setTab]       = useState<'counter'|'list'|'history'|'add'|'library'>('counter')
  const [libCat, setLibCat] = useState(LIBRARY_CATEGORIES[0].name)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [countAnim, setAnim]= useState(false)
  const [toast, setToast]   = useState<string|null>(null)
  const [longId, setLongId] = useState<string|null>(null)
  const lpRef               = useRef<ReturnType<typeof setTimeout>|null>(null)
  const [form, setForm]     = useState({name:'',arabic:'',translation:'',target:33,color:'#34d399'})

  /* daily reset */
  useEffect(() => {
    const check = () => setState(prev => {
      const t = today()
      if(prev.lastResetDate === t) return prev
      const rec: DayRecord = {
        date: prev.lastResetDate,
        total: prev.duas.reduce((s,d)=>s+d.count,0),
        perDua: Object.fromEntries(prev.duas.map(d=>[d.id,d.count]))
      }
      const next: AppState = {
        duas: prev.duas.map(d => ({...d, count:0, streak:d.count>0?d.streak+1:Math.max(0,d.streak-1), lastActiveDate:d.count>0?prev.lastResetDate:d.lastActiveDate})),
        history: [rec,...prev.history].slice(0,60),
        lastResetDate: t
      }
      save(next); return next
    })
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => { save(state) }, [state])

  const dua        = state.duas.find(d=>d.id===activeId) ?? state.duas[0]
  const todayTotal = state.duas.reduce((s,d)=>s+d.count, 0)
  const theme      = getTheme(dua?.color ?? '#34d399')

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(null),2400) }

  const tap = useCallback((e: React.MouseEvent|React.TouchEvent) => {
    if(!dua) return
    e.preventDefault()
    setState(prev => ({...prev, duas:prev.duas.map(d=>d.id!==dua.id?d:{...d,count:d.count+1,totalAllTime:d.totalAllTime+1,lastActiveDate:today()})}))
    setAnim(true); setTimeout(()=>setAnim(false),360)
    const next = dua.count+1
    if(next===dua.target)          showToast(`✅ ${dua.target}× — مَاشَاءَ اللّٰه!`)
    else if(next%dua.target===0)   showToast(`✨ ${next} — Barakallahu Feek!`)
  }, [dua])

  const resetDua  = (id:string) => { setState(p=>({...p,duas:p.duas.map(d=>d.id!==id?d:{...d,count:0})})); setLongId(null) }
  const deleteDua = (id:string) => {
    setState(p=>({...p,duas:p.duas.filter(d=>d.id!==id)}))
    if(activeId===id) setActiveId(state.duas.find(d=>d.id!==id)?.id??'')
    setLongId(null)
  }
  const toggleFav = (id: string) => {
    setState(p => ({...p, duas: p.duas.map(d => d.id!==id ? d : {...d, favourite:!d.favourite})}))
  }

  const addDua = () => {
    if(!form.name.trim()) return
    const d: Dua = {id:Date.now().toString(),name:form.name.trim(),arabic:form.arabic.trim(),translation:form.translation.trim(),target:form.target,color:form.color,count:0,totalAllTime:0,streak:0,lastActiveDate:'',favourite:false}
    setState(p=>({...p,duas:[...p.duas,d]}))
    setActiveId(d.id); setForm({name:'',arabic:'',translation:'',target:33,color:'#34d399'}); setTab('counter')
  }

  const addFromLibrary = (lib: LibraryDua) => {
    const already = state.duas.some(d => d.arabic === lib.arabic)
    if (already) { showToast('Already in your list!'); return }
    const d: Dua = {
      id: Date.now().toString(), name: lib.name, arabic: lib.arabic,
      translation: lib.translation, target: lib.target, color: lib.color,
      count:0, totalAllTime:0, streak:0, lastActiveDate:'', favourite:false
    }
    setState(p => ({...p, duas:[...p.duas, d]}))
    setAddedIds(s => new Set(s).add(lib.id))
    showToast(`✅ Added: ${lib.name}`)
  }

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'var(--bg)',fontFamily:'var(--font-sans)',width:'100%',maxWidth:480,marginLeft:'auto',marginRight:'auto',position:'relative',overflow:'hidden'}}>

      {/* ── Ambient bg blobs — transition with active dua color ── */}
      <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
        <div style={{position:'absolute',top:-100,left:-60,width:380,height:380,borderRadius:'50%',background:`radial-gradient(circle, ${dua?.color ?? '#34d399'}1a 0%, transparent 65%)`,transition:'background 0.7s ease'}} />
        <div style={{position:'absolute',bottom:120,right:-80,width:300,height:300,borderRadius:'50%',background:`radial-gradient(circle, ${theme.from}60 0%, transparent 70%)`,transition:'background 0.7s ease'}} />
        <div style={{position:'absolute',top:'40%',left:'30%',width:200,height:200,borderRadius:'50%',background:'radial-gradient(circle, #0f1e3240 0%, transparent 70%)'}} />
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',zIndex:100,background:'rgba(9,20,34,0.97)',border:`1px solid ${dua?.color}55`,color:'var(--text)',padding:'10px 22px',borderRadius:20,fontSize:13,fontWeight:600,whiteSpace:'nowrap',boxShadow:`0 8px 40px ${dua?.color}33`,animation:'fadeUp 0.3s ease'}}>
          {toast}
        </div>
      )}

      {/* ── Bottom sheet (long press) ── */}
      {longId && (() => {
        const d = state.duas.find(x=>x.id===longId); if(!d) return null
        const th = getTheme(d.color)
        return (
          <div style={{position:'fixed',inset:0,zIndex:90,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(14px)',display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'0 16px 28px'}} onClick={()=>setLongId(null)}>
            <div style={{borderRadius:28,padding:24,width:'100%',maxWidth:440,animation:'fadeUp 0.3s ease',background:`linear-gradient(160deg,${th.from}ee,${th.to}ee)`,border:`1px solid ${d.color}44`}} onClick={e=>e.stopPropagation()}>
              {d.arabic && <p style={{textAlign:'center',fontSize:28,fontWeight:700,color:d.color,direction:'rtl',fontFamily:'Georgia,serif',marginBottom:4,textShadow:`0 0 30px ${d.color}66`}}>{d.arabic}</p>}
              <p style={{textAlign:'center',fontSize:13,color:'var(--muted)',marginBottom:20}}>Today: {d.count} / {d.target}</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <Btn onClick={()=>resetDua(d.id)} color="#f87171" bg="rgba(248,113,113,0.12)" border="rgba(248,113,113,0.25)">Reset Count</Btn>
                {state.duas.length>1 && <Btn onClick={()=>deleteDua(d.id)} color="#f87171" bg="rgba(248,113,113,0.07)" border="rgba(248,113,113,0.15)">Delete</Btn>}
                <Btn onClick={()=>setLongId(null)} color="var(--muted)" bg="rgba(255,255,255,0.07)" border="transparent">Cancel</Btn>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══════════════════════════════
          HEADER
      ═══════════════════════════════ */}
      <div style={{flexShrink:0,zIndex:20,position:'relative',borderBottom:`1px solid ${dua?.color ?? '#34d399'}22`,transition:'border-color 0.5s ease',
        background:`linear-gradient(180deg, rgba(4,9,15,0.97) 0%, rgba(9,20,34,0.95) 100%)`,
        backdropFilter:'blur(28px)',WebkitBackdropFilter:'blur(28px)'}}>

        {/* Row 1: brand + today */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px 10px',gap:8}}>

          {/* Brand */}
          <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0,flex:1}}>
            <div style={{
              width:38,height:38,flexShrink:0,borderRadius:12,
              background:`linear-gradient(135deg,${theme.from},${theme.to})`,
              border:`1.5px solid ${dua?.color ?? '#34d399'}55`,
              boxShadow:`0 0 16px ${dua?.color ?? '#34d399'}30`,
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,
              transition:'all 0.5s ease'
            }}>
              ☽
            </div>
            <div style={{minWidth:0}}>
              <div className="shimmer-text" style={{fontSize:16,fontWeight:800,fontFamily:'var(--font-display)',lineHeight:1.1,whiteSpace:'nowrap'}}>
                TasbihCount
              </div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:2,whiteSpace:'nowrap'}}>
                {new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
              </div>
            </div>
          </div>

          {/* Today pill */}
          <div style={{
            flexShrink:0,display:'flex',alignItems:'center',gap:8,
            padding:'7px 14px',borderRadius:22,
            background:`linear-gradient(135deg,${theme.from}cc,${theme.to}cc)`,
            border:`1.5px solid ${dua?.color ?? '#34d399'}44`,
            boxShadow:`0 0 20px ${dua?.color ?? '#34d399'}20`,
            transition:'all 0.5s ease'
          }}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
              <span style={{fontSize:9,color:'var(--muted)',lineHeight:1,letterSpacing:'0.08em',textTransform:'uppercase'}}>Today</span>
              <span style={{fontSize:18,fontWeight:800,fontFamily:'var(--font-mono)',color:dua?.color??'#34d399',lineHeight:1.1,transition:'color 0.5s ease'}}>{todayTotal}</span>
            </div>
          </div>
        </div>

        {/* Row 2: dua tabs */}
        <div style={{position:'relative',paddingBottom:12}}>
          <div style={{display:'flex',gap:7,overflowX:'auto',padding:'0 16px',scrollbarWidth:'none'}}>
            {state.duas.map(d => {
              const active = activeId===d.id
              const th2 = getTheme(d.color)
              return (
                <button key={d.id}
                  style={{
                    flexShrink:0,padding:'6px 14px',borderRadius:22,
                    background: active ? `linear-gradient(135deg,${th2.from},${th2.to})` : 'rgba(255,255,255,0.05)',
                    border:`1.5px solid ${active ? d.color+'66' : 'rgba(255,255,255,0.08)'}`,
                    color: active ? d.color : 'var(--muted)',
                    fontSize:12,fontWeight:600,cursor:'pointer',lineHeight:1.6,
                    boxShadow: active ? `0 0 16px ${d.color}35, inset 0 1px 0 rgba(255,255,255,0.1)` : 'none',
                    transition:'all 0.2s ease',whiteSpace:'nowrap'
                  }}
                  onClick={() => setActiveId(d.id)}
                  onContextMenu={e=>{e.preventDefault();setLongId(d.id)}}
                  onTouchStart={()=>{lpRef.current=setTimeout(()=>setLongId(d.id),600)}}
                  onTouchEnd={()=>{if(lpRef.current)clearTimeout(lpRef.current)}}>
                  {d.name}
                </button>
              )
            })}
            <div style={{flexShrink:0,width:28}} />
          </div>
          {/* Fade right edge */}
          <div style={{position:'absolute',top:0,right:0,width:36,height:'100%',background:'linear-gradient(to right,transparent,rgba(4,9,15,0.95))',pointerEvents:'none'}} />
        </div>
      </div>

      {/* ═══════════════════════════════
          SCROLLABLE CONTENT
      ═══════════════════════════════ */}
      <div style={{flex:1,overflowY:'auto',position:'relative',zIndex:1}}>
        <div style={{padding:'16px 16px 0'}}>

          {tab==='counter' && dua && (
            <CounterView dua={dua} countAnim={countAnim} onTap={tap} onLongPress={()=>setLongId(dua.id)} onToggleFav={()=>toggleFav(dua.id)} />
          )}

          {tab==='list' && (
            <div className="fade-up" style={{display:'flex',flexDirection:'column',gap:10,paddingBottom:16}}>

              {/* ── Favourites section ── */}
              {state.duas.some(d=>d.favourite) && (
                <>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                    <span style={{fontSize:16}}>⭐</span>
                    <p style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#fbbf24'}}>Favourites</p>
                  </div>
                  {state.duas.filter(d=>d.favourite).map(d => (
                    <DuaCard key={d.id} d={d}
                      onOpen={()=>{setActiveId(d.id);setTab('counter')}}
                      onLongPress={()=>setLongId(d.id)}
                      onToggleFav={()=>toggleFav(d.id)}
                      lpRef={lpRef} />
                  ))}
                  <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'4px 0'}} />
                </>
              )}

              {/* ── All Adhkar ── */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                <span style={{fontSize:16}}>📿</span>
                <p style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)'}}>All Adhkar</p>
              </div>
              {state.duas.map(d => (
                <DuaCard key={d.id} d={d}
                  onOpen={()=>{setActiveId(d.id);setTab('counter')}}
                  onLongPress={()=>setLongId(d.id)}
                  onToggleFav={()=>toggleFav(d.id)}
                  lpRef={lpRef} />
              ))}
            </div>
          )}

          {tab==='add' && (
            <div className="fade-up" style={{borderRadius:24,padding:20,marginBottom:16,
              background:`linear-gradient(160deg,${getTheme(form.color).from}cc,${getTheme(form.color).to}cc)`,
              border:`1px solid ${form.color}33`}}>
              <p style={{fontSize:16,fontWeight:700,color:'var(--text)',marginBottom:16,fontFamily:'var(--font-display)'}}>New Dua / Dhikr</p>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <FInput value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="Name (e.g. SubhanAllah)" />
                <FInput value={form.arabic} onChange={v=>setForm(f=>({...f,arabic:v}))} placeholder="Arabic — سُبْحَانَ اللّٰه" dir="rtl" arabic />
                <FInput value={form.translation} onChange={v=>setForm(f=>({...f,translation:v}))} placeholder="Meaning (optional)" />
                <div>
                  <Label>Target Count</Label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {TARGETS.map(t => (
                      <button key={t} onClick={()=>setForm(f=>({...f,target:t}))}
                        style={{padding:'6px 14px',borderRadius:12,
                          background:form.target===t?`${form.color}28`:'rgba(255,255,255,0.05)',
                          border:`1.5px solid ${form.target===t?form.color:'rgba(255,255,255,0.08)'}`,
                          color:form.target===t?form.color:'var(--muted)',
                          fontSize:13,fontWeight:700,fontFamily:'var(--font-mono)',cursor:'pointer'}}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Color</Label>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                    {COLORS.map(c => (
                      <button key={c} onClick={()=>setForm(f=>({...f,color:c}))}
                        style={{width:32,height:32,borderRadius:'50%',background:c,
                          border:`3px solid ${form.color===c?'#fff':'transparent'}`,
                          outline:form.color===c?`2px solid ${c}`:'none',
                          outlineOffset:2,cursor:'pointer',transition:'transform 0.15s',
                          boxShadow:form.color===c?`0 0 12px ${c}`:'none'}} />
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',gap:10,marginTop:4}}>
                  <Btn onClick={()=>setTab('counter')} color="var(--muted)" bg="rgba(255,255,255,0.07)" border="transparent">Cancel</Btn>
                  <button onClick={addDua} style={{flex:1,padding:'13px 0',borderRadius:14,
                    background:`linear-gradient(135deg,${form.color}cc,${form.color}88)`,
                    color:'#fff',border:`1px solid ${form.color}66`,fontSize:14,fontWeight:700,cursor:'pointer',
                    boxShadow:`0 0 20px ${form.color}44`}}>
                    Add Dua
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab==='library' && (
            <div className="fade-up" style={{paddingBottom:16}}>
              <p style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:10}}>
                📚 Dua Library — {DUA_LIBRARY.length} duas
              </p>

              {/* Category filter pills */}
              <div style={{display:'flex',gap:7,overflowX:'auto',marginBottom:14,paddingBottom:4}}>
                {LIBRARY_CATEGORIES.map(cat => (
                  <button key={cat.name} onClick={()=>setLibCat(cat.name)}
                    style={{
                      flexShrink:0, padding:'6px 12px', borderRadius:20,
                      background: libCat===cat.name ? `${cat.color}28` : 'rgba(255,255,255,0.05)',
                      border:`1.5px solid ${libCat===cat.name ? cat.color+'66' : 'rgba(255,255,255,0.08)'}`,
                      color: libCat===cat.name ? cat.color : 'var(--muted)',
                      fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
                      boxShadow: libCat===cat.name ? `0 0 14px ${cat.color}30` : 'none',
                      transition:'all 0.18s ease'
                    }}>
                    {cat.emoji} {cat.name}
                  </button>
                ))}
              </div>

              {/* Dua cards for selected category */}
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {DUA_LIBRARY.filter(d => d.category===libCat).map(lib => {
                  const isAdded = addedIds.has(lib.id) || state.duas.some(d => d.arabic===lib.arabic)
                  const th = getTheme(lib.color)
                  return (
                    <div key={lib.id} style={{
                      borderRadius:20, padding:'14px 14px 12px',
                      background:`linear-gradient(135deg,${th.from}cc,${th.to}bb)`,
                      border:`1px solid ${lib.color}28`,
                      boxShadow:`0 4px 20px ${lib.color}10`
                    }}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                        <div style={{flex:1}}>
                          <p style={{fontSize:22,fontWeight:700,color:lib.color,direction:'rtl',
                            fontFamily:'Georgia,serif',lineHeight:1.6,
                            textShadow:`0 0 18px ${lib.color}44`,marginBottom:5}}>
                            {lib.arabic}
                          </p>
                          <p style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:3}}>{lib.name}</p>
                          <p style={{fontSize:11,color:'var(--muted)',lineHeight:1.5}}>{lib.translation}</p>
                        </div>
                        <button onClick={()=>addFromLibrary(lib)}
                          style={{
                            flexShrink:0, marginTop:2,
                            width:36, height:36, borderRadius:12,
                            background: isAdded ? `${lib.color}28` : `${lib.color}`,
                            border:`1.5px solid ${lib.color}${isAdded?'44':'aa'}`,
                            color: isAdded ? lib.color : '#fff',
                            fontSize:isAdded?13:18, fontWeight:700, cursor:isAdded?'default':'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            boxShadow: isAdded ? 'none' : `0 0 16px ${lib.color}55`,
                            transition:'all 0.2s ease'
                          }}>
                          {isAdded ? '✓' : '+'}
                        </button>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
                        <span style={{fontSize:10,padding:'3px 8px',borderRadius:8,
                          background:`${lib.color}18`,color:lib.color,border:`1px solid ${lib.color}25`}}>
                          Target: {lib.target}×
                        </span>
                        <span style={{fontSize:10,color:'var(--muted)'}}>{lib.categoryEmoji} {lib.category}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tab==='history' && (
            <div className="fade-up" style={{paddingBottom:16}}>
              <p style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:12}}>Past 30 Days</p>
              {state.history.length===0 ? (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'80px 0',color:'var(--muted)'}}>
                  <div style={{fontSize:52,marginBottom:16}}>📿</div>
                  <p style={{fontSize:14}}>No history yet — start your dhikr!</p>
                </div>
              ) : state.history.map(day => (
                <div key={day.date} style={{borderRadius:20,padding:16,marginBottom:10,
                  background:'linear-gradient(135deg,rgba(15,30,50,0.8),rgba(9,20,34,0.9))',
                  border:'1px solid var(--border-hi)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                    <p style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>
                      {new Date(day.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
                    </p>
                    <span style={{fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:20,
                      background:'rgba(52,211,153,0.15)',color:'#34d399',fontFamily:'var(--font-mono)',
                      border:'1px solid rgba(52,211,153,0.3)'}}>
                      {day.total} total
                    </span>
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {state.duas.map(d => (
                      <span key={d.id} style={{fontSize:12,padding:'4px 10px',borderRadius:10,
                        background:`${d.color}18`,color:d.color,border:`1px solid ${d.color}30`}}>
                        {d.name}: {day.perDua[d.id]??0}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ═══════════════════════════════
          BOTTOM NAV
      ═══════════════════════════════ */}
      <div style={{
        flexShrink:0,zIndex:20,
        borderTop:`1px solid ${dua?.color ?? '#34d399'}20`,
        background:'rgba(4,9,15,0.96)',backdropFilter:'blur(28px)',WebkitBackdropFilter:'blur(28px)',
        display:'grid',gridTemplateColumns:'repeat(5,1fr)',
        padding:'8px 12px 12px',gap:6,
        transition:'border-color 0.5s ease'
      }}>
        {([
          {key:'counter', icon:'📿', label:'Counter'},
          {key:'list',    icon:'☰',  label:'My Duas'},
          {key:'library', icon:'📚', label:'Library'},
          {key:'history', icon:'📅', label:'History'},
          {key:'add',     icon:'+',  label:'New'},
        ] as const).map(item => {
          const active = tab===item.key
          const col = dua?.color ?? '#34d399'
          const th = getTheme(col)
          return (
            <button key={item.key} onClick={()=>setTab(item.key)}
              style={{
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,
                padding:'8px 0',borderRadius:14,cursor:'pointer',
                background: active ? `linear-gradient(135deg,${th.from}cc,${th.to}cc)` : 'transparent',
                border:`1.5px solid ${active?col+'55':'transparent'}`,
                boxShadow: active ? `0 0 14px ${col}25` : 'none',
                transition:'all 0.2s ease'
              }}>
              <span style={{fontSize:16,lineHeight:1}}>{item.icon}</span>
              <span style={{fontSize:10,fontWeight:600,color:active?col:'var(--muted)',transition:'color 0.2s'}}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Counter View ──────────────────────────────────────────────────────────── */
function CounterView({dua,countAnim,onTap,onLongPress,onToggleFav}:{
  dua:Dua; countAnim:boolean
  onTap:(e:React.MouseEvent|React.TouchEvent)=>void
  onLongPress:()=>void
  onToggleFav:()=>void
}) {
  const {ripples,add} = useRipple()
  const lpRef = useRef<ReturnType<typeof setTimeout>|null>(null)
  const th = getTheme(dua.color)

  const pct       = Math.min(100,(dua.count/dua.target)*100)
  const cyclePos  = dua.count % dua.target || (dua.count>0 ? dua.target : 0)
  const rounds    = Math.floor(dua.count/dua.target)
  const remaining = dua.target - cyclePos
  const R=112, C=2*Math.PI*R

  const handle = (e:React.MouseEvent|React.TouchEvent) => { e.preventDefault(); add(e); onTap(e) }

  return (
    <div className="fade-up" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,paddingBottom:20}}>

      {/* Arabic card */}
      <div style={{
        width:'100%',borderRadius:24,padding:'18px 20px 18px',textAlign:'center',
        background:`linear-gradient(160deg,${th.from}ee,${th.to}dd)`,
        border:`1px solid ${dua.color}44`,
        boxShadow:`0 8px 40px ${dua.color}18,inset 0 1px 0 rgba(255,255,255,0.08)`,
        position:'relative'
      }}>
        {/* Favourite toggle */}
        <button onClick={onToggleFav}
          style={{
            position:'absolute', top:14, right:16,
            width:34, height:34, borderRadius:10,
            background: dua.favourite ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.06)',
            border: `1.5px solid ${dua.favourite ? '#fbbf2466' : 'rgba(255,255,255,0.1)'}`,
            fontSize:16, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all 0.2s ease',
            boxShadow: dua.favourite ? '0 0 14px rgba(251,191,36,0.35)' : 'none',
          }}>
          {dua.favourite ? '⭐' : '☆'}
        </button>
        {dua.arabic
          ? <>
              <p style={{fontSize:32,fontWeight:700,color:dua.color,direction:'rtl',fontFamily:'Georgia,serif',lineHeight:1.7,textShadow:`0 0 40px ${dua.color}66`,marginBottom:6,paddingRight:36}}>{dua.arabic}</p>
              <p style={{fontSize:12,color:'var(--muted)',fontStyle:'italic'}}>{dua.translation}</p>
            </>
          : <p style={{fontSize:22,fontWeight:700,color:dua.color,paddingRight:36}}>{dua.name}</p>
        }
      </div>

      {/* Count number */}
      <div style={{position:'relative',display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
        <div style={{position:'absolute',width:200,height:200,borderRadius:'50%',background:`radial-gradient(circle,${dua.color}18,transparent 65%)`,top:'50%',left:'50%',transform:'translate(-50%,-50%)',pointerEvents:'none'}} />
        <div key={countAnim?'a':'s'} style={{
          fontSize:100,fontWeight:900,fontFamily:'var(--font-display)',
          color:dua.color,lineHeight:1,letterSpacing:'-0.04em',
          textShadow:`0 0 60px ${dua.color}77`,minWidth:190,textAlign:'center',
          animation:countAnim?'countPop 0.36s cubic-bezier(.36,.07,.19,.97)':'none'
        }}>{dua.count}</div>
        <p style={{fontSize:12,color:'var(--muted-hi)'}}>
          {rounds>0 ? `${rounds}× done · ` : ''}{remaining} to go
        </p>
      </div>

      {/* SVG ring + tap button */}
      <div style={{position:'relative',width:260,height:260,display:'flex',alignItems:'center',justifyContent:'center'}}>
        {/* Outer pulse ring */}
        <div style={{position:'absolute',width:258,height:258,borderRadius:'50%',border:`2px solid ${dua.color}20`,animation:'ringPulse 2.4s ease-out infinite',pointerEvents:'none'}} />

        {/* Progress ring */}
        <svg width={260} height={260} style={{position:'absolute',top:0,left:0,transform:'rotate(-90deg)'}}>
          <circle cx={130} cy={130} r={R} fill="none" stroke={dua.color+'18'} strokeWidth={9} />
          <circle cx={130} cy={130} r={R} fill="none" stroke={dua.color} strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C*(1-pct/100)}
            style={{transition:'stroke-dashoffset 0.45s cubic-bezier(.22,1,.36,1)',filter:`drop-shadow(0 0 10px ${dua.color})`}} />
        </svg>

        {/* Main tap button */}
        <button className="tap-btn"
          style={{
            width:214,height:214,borderRadius:'50%',border:'none',
            background:`radial-gradient(ellipse at 38% 32%, ${dua.color}ee, ${dua.color}77)`,
            boxShadow:`0 0 80px ${dua.color}50, 0 20px 60px ${dua.color}30, inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -4px 0 rgba(0,0,0,0.3)`,
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5,cursor:'pointer'
          }}
          onClick={handle} onTouchStart={handle}
          onContextMenu={e=>{e.preventDefault();onLongPress()}}
          onMouseDown={()=>{lpRef.current=setTimeout(onLongPress,700)}}
          onMouseUp={()=>{if(lpRef.current)clearTimeout(lpRef.current)}}
          onTouchEnd={()=>{if(lpRef.current)clearTimeout(lpRef.current)}}>
          {ripples.map(r=><span key={r.id} className="ripple-el" style={{left:r.x,top:r.y,width:r.size,height:r.size}}/>)}
          <span style={{color:'#fff',fontWeight:900,fontSize:24,letterSpacing:'0.06em',pointerEvents:'none'}}>TAP</span>
          <span style={{color:'rgba(255,255,255,0.6)',fontSize:14,fontWeight:500,pointerEvents:'none',fontFamily:'Georgia,serif',direction:'rtl'}}>اضغط</span>
        </button>
      </div>

      {/* Stats */}
      <div style={{width:'100%',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {[
          {label:'All-time', val:dua.totalAllTime.toLocaleString(), color:dua.color},
          {label:'Streak',   val:`🔥 ${dua.streak}`,               color:'#fbbf24'},
          {label:'Goal',     val:String(dua.target),                color:'var(--muted-hi)'},
        ].map(s=>(
          <div key={s.label} style={{borderRadius:16,padding:'12px 8px',display:'flex',flexDirection:'column',alignItems:'center',gap:4,
            background:`linear-gradient(135deg,${th.from}cc,${th.to}aa)`,
            border:`1px solid ${dua.color}25`,boxShadow:`0 4px 16px rgba(0,0,0,0.2)`}}>
            <span style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.1em'}}>{s.label}</span>
            <span style={{fontSize:15,fontWeight:700,fontFamily:'var(--font-mono)',color:s.color}}>{s.val}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{width:'100%'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
          <span style={{fontSize:11,color:'var(--muted)'}}>Progress today</span>
          <span style={{fontSize:11,fontWeight:700,color:dua.color,fontFamily:'var(--font-mono)'}}>{Math.round(pct)}%</span>
        </div>
        <div style={{height:7,borderRadius:7,background:'rgba(0,0,0,0.4)',overflow:'hidden',border:`1px solid ${dua.color}15`}}>
          <div style={{height:'100%',borderRadius:7,width:`${pct}%`,
            background:`linear-gradient(90deg,${dua.color}88,${dua.color})`,
            boxShadow:`0 0 12px ${dua.color}`,transition:'width 0.5s ease'}} />
        </div>
      </div>
    </div>
  )
}

/* ── Dua Card (list view) ──────────────────────────────────────────────────── */
function DuaCard({d, onOpen, onLongPress, onToggleFav, lpRef}: {
  d: Dua
  onOpen: () => void
  onLongPress: () => void
  onToggleFav: () => void
  lpRef: React.MutableRefObject<ReturnType<typeof setTimeout>|null>
}) {
  const pct = Math.min(100,(d.count/d.target)*100)
  const th = getTheme(d.color)
  return (
    <div style={{
      borderRadius:20, overflow:'hidden',
      background:`linear-gradient(135deg,${th.from}dd,${th.to}cc)`,
      border:`1px solid ${d.color}${d.favourite?'55':'28'}`,
      boxShadow: d.favourite ? `0 4px 28px ${d.color}22, 0 0 0 1px #fbbf2418` : `0 4px 20px ${d.color}10`,
      transition:'box-shadow 0.3s ease, border-color 0.3s ease',
    }}>
      {/* Favourite gold strip */}
      {d.favourite && (
        <div style={{height:3,background:'linear-gradient(90deg,transparent,#fbbf24,transparent)',opacity:0.7}} />
      )}
      <div style={{padding:'14px 14px 12px',display:'flex',alignItems:'flex-start',gap:10}}>

        {/* Main content — tap to open counter */}
        <button onClick={onOpen}
          onContextMenu={e=>{e.preventDefault();onLongPress()}}
          onTouchStart={()=>{lpRef.current=setTimeout(onLongPress,600)}}
          onTouchEnd={()=>{if(lpRef.current)clearTimeout(lpRef.current)}}
          style={{flex:1,textAlign:'left',background:'transparent',border:'none',cursor:'pointer',padding:0}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:8}}>
            <div style={{flex:1}}>
              {d.arabic && (
                <p style={{fontSize:22,fontWeight:700,color:d.color,direction:'rtl',fontFamily:'Georgia,serif',lineHeight:1.5,textShadow:`0 0 16px ${d.color}44`,marginBottom:3}}>
                  {d.arabic}
                </p>
              )}
              <p style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{d.name}</p>
              {d.translation && <p style={{fontSize:11,color:'var(--muted)',marginTop:1}}>{d.translation}</p>}
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:28,fontWeight:800,fontFamily:'var(--font-mono)',color:d.color,lineHeight:1}}>{d.count}</div>
              <div style={{fontSize:11,color:'var(--muted)'}}>/ {d.target}</div>
            </div>
          </div>
          <div style={{height:4,borderRadius:4,background:'rgba(0,0,0,0.35)',overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:4,width:`${pct}%`,background:`linear-gradient(90deg,${d.color}88,${d.color})`,boxShadow:`0 0 8px ${d.color}`,transition:'width 0.5s ease'}} />
          </div>
          <div style={{display:'flex',gap:14,marginTop:7}}>
            <span style={{fontSize:11,color:'var(--muted)'}}>🔥 {d.streak} day streak</span>
            <span style={{fontSize:11,color:'var(--muted)'}}>All-time: {d.totalAllTime.toLocaleString()}</span>
          </div>
        </button>

        {/* Fav toggle */}
        <button onClick={e=>{e.stopPropagation();onToggleFav()}}
          style={{
            flexShrink:0, width:32, height:32, borderRadius:10, marginTop:2,
            background: d.favourite ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.06)',
            border:`1.5px solid ${d.favourite ? '#fbbf2455' : 'rgba(255,255,255,0.1)'}`,
            fontSize:15, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all 0.2s ease',
            boxShadow: d.favourite ? '0 0 12px rgba(251,191,36,0.4)' : 'none',
          }}>
          {d.favourite ? '⭐' : '☆'}
        </button>
      </div>
    </div>
  )
}

/* ── Small helpers ─────────────────────────────────────────────────────────── */
function Btn({onClick,color,bg,border,children}:{onClick:()=>void;color:string;bg:string;border:string;children:React.ReactNode}) {
  return (
    <button onClick={onClick} style={{flex:1,padding:'13px 0',borderRadius:14,background:bg,color,border:`1px solid ${border}`,fontSize:14,fontWeight:600,cursor:'pointer',width:'100%'}}>
      {children}
    </button>
  )
}
function Label({children}:{children:React.ReactNode}) {
  return <p style={{fontSize:11,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>{children}</p>
}
function FInput({value,onChange,placeholder,dir,arabic}:{value:string;onChange:(v:string)=>void;placeholder:string;dir?:string;arabic?:boolean}) {
  return (
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} dir={dir}
      style={{width:'100%',padding:'12px 16px',borderRadius:14,background:'rgba(0,0,0,0.3)',
        border:'1px solid rgba(255,255,255,0.1)',color:'var(--text)',
        fontSize:arabic?18:14,fontFamily:arabic?'Georgia,serif':'var(--font-sans)',
        outline:'none',textAlign:dir==='rtl'?'right':undefined}} />
  )
}
