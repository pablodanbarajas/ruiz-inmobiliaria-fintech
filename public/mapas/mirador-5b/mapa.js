
  const SUPABASE_URL = window.__ENV__?.SUPABASE_URL || 'https://ivbyroqxyfclzfhaixjd.supabase.co';
  const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_KEY || '';
  const DESARROLLO_ID = 7; // Solo consultar lotes del desarrollo 7 (Mirador).
  // Columnas confirmadas de public.lote. Datos consultados de la BD; el SVG solo contiene data-loteid.
  const COLUMNAS = {
    id:'loteid', manzana:'manzana', numero:'nolote', clave:'clavelote', superficie:'superficie',
    estado:'estatus', coto:'coto', tipo:'tipolote', precioM2:'preciopormt2', precioTotal:'preciolote',
    lindNorte:'linderonte', lindSur:'linderosur', lindEste:'linderoote', lindOeste:'linderopte',
    colNorte:'colindanciante', colSur:'colindanciasur', colEste:'colindanciaote', colOeste:'colindanciapte', comentarios:'comentarios'
  };
  const estadoColores = {disponible:'#87BFA8', vendido:'#DFA39A', apartado:'#E7C38D', bloqueado:'#ACB7C6'};
  const estadoOscuro = {disponible:'#397E66', vendido:'#A85F59', apartado:'#9A7134', bloqueado:'#596A7C'};
  const estadoBordes = {disponible:'#397E66', vendido:'#A85F59', apartado:'#9A7134', bloqueado:'#596A7C'};
  const SVG_URL = new URL('./mapa.svg', document.currentScript.src);
  // Configurar ruta de los detalles de lote en el proyecto.
  const DETALLE_LOTE_RUTA = '';
   const hoverCard=document.getElementById('lote-hover-card');
   let hoveredLoteId=null;
   let lastHoverPoint=null;
   function hideHover(){
     hoveredLoteId=null;lastHoverPoint=null;
     hoverCard.classList.remove('is-visible');hoverCard.setAttribute('aria-hidden','true');
   }
   function placeHover(e){
     if(!e)return;
     lastHoverPoint={clientX:e.clientX,clientY:e.clientY};
     // Ajuste para que el tooltip nunca quede cortado contra los bordes.
     const gap=16, margin=10, rect=hoverCard.getBoundingClientRect();
     let x=e.clientX+gap,y=e.clientY+gap;
     if(x+rect.width>innerWidth-margin)x=e.clientX-rect.width-gap;
     if(y+rect.height>innerHeight-margin)y=e.clientY-rect.height-gap;
     x=Math.max(margin,x);y=Math.max(margin,y);
     hoverCard.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;
   }
   function fillHover(id){
     const r=registros.get(String(id));
     const state=r?stateOf(r):'sin datos';
     const n=r?getVal(r,'numero'):null;
     const m=r?getVal(r,'manzana'):null;
     const sf=r?getVal(r,'superficie'):null;
     const pr=r?getVal(r,'precioTotal'):null;
     const noEmpty=v=>v!==null&&v!==undefined&&v!=='';
     document.getElementById('hover-title').textContent=noEmpty(n)?`Lote ${n}`:`Lote ID ${id}`;
     document.getElementById('hover-state').textContent=state==='sin datos'?'Sin registro':state;
     const details=[];
     if(noEmpty(m))details.push('Manzana '+m);
     if(noEmpty(sf))details.push(Number.isFinite(Number(sf))?`${new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(Number(sf))} m²`:`${sf} m²`);
     document.getElementById('hover-data').textContent=details.join(' · ')||(dbReady?'Sin superficie registrada':'Consultando datos…');
     document.getElementById('hover-price').textContent=moneda(pr);
     document.getElementById('hover-price').hidden=!noEmpty(pr);
     document.getElementById('hover-accent').style.background=estadoColores[state]||'#94A3B8';
   }
   function showHover(id,event){
     if(event.pointerType==='touch'||isDragging||didDrag)return;
     hoveredLoteId=String(id);
     fillHover(id);
     hoverCard.classList.add('is-visible');hoverCard.setAttribute('aria-hidden','false');
     placeHover(event);
   }
   const registros = new Map();
  let selectedLoteId = null;
  let dbReady = false;
  let scale = 1, pointX = 0, pointY = 0, startX = 0, startY = 0, isDragging = false, didDrag = false, dragPointerId = null, downX = 0, downY = 0, lastDraggedAt = 0;
  const viewport=document.getElementById('viewport'), world=document.getElementById('map-world'), zoomLabel=document.getElementById('zoom-level');
  function setNotice(message, bad=false) {
    (bad ? console.error : console.info)(message);
  }
  function setMapLoadingError(message) {
    document.getElementById('map-loading-title').textContent='No se pudo cargar el mapa';
    document.getElementById('map-loading-detail').textContent=message;
    document.getElementById('map-spinner').hidden=true;
    document.getElementById('map-retry').hidden=false;
    document.getElementById('map-loading').setAttribute('aria-busy','false');
  }
  function revealMap() {
    // Dejar un frame de pintura entre la actualización de SVG y mostrar el mapa.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.getElementById('map-world').classList.remove('map-pending');
      document.getElementById('map-loading').hidden=true;
      document.getElementById('map-loading').setAttribute('aria-busy','false');
    }));
  }
  document.getElementById('map-retry').addEventListener('click',()=>{
    document.getElementById('map-spinner').hidden=false;
    document.getElementById('map-retry').hidden=true;
    document.getElementById('map-loading-title').textContent='Preparando mapa de lotes…';
    document.getElementById('map-loading-detail').textContent='Consultando estados y aplicando los colores del desarrollo.';
    document.getElementById('map-loading').setAttribute('aria-busy','true');
    initializeMap();
  });
  function getVal(record,key) { const col=COLUMNAS[key]; return col && record && record[col]!==undefined ? record[col] : null; }
  function showVal(value,unit='') {return value===null || value===undefined || value==='' ? '—' : String(value)+(unit||'');}
  function moneda(n){return n===null||n===undefined||n===''||Number.isNaN(Number(n))?'—':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:2}).format(Number(n));}
  function stateOf(r) {
    const s=getVal(r,'estado');
    if(s===null||s===undefined||String(s).trim()==='')return 'sin estado';
    const value=String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
    // En esta base de datos estatus usa códigos: D = Disponible, V = Vendido.
    // También admitimos letras para apartado y bloqueado si existieran en el futuro.
    const aliases={'d':'disponible','v':'vendido','a':'apartado','b':'bloqueado',
      'reservado':'apartado','reservada':'apartado','reservacion':'apartado','apartada':'apartado',
      'vendida':'vendido','disponibles':'disponible','bloqueada':'bloqueado','libre':'disponible',
      'en venta':'disponible','no disponible':'bloqueado'};
    return aliases[value]||value;
  }
  function setText(id,val){document.getElementById(id).textContent=val;}
  function updateTransform() {
    scale=Math.min(Math.max(.45,scale),5);
    world.style.transform=`translate(${pointX}px, ${pointY}px) scale(${scale})`;
    zoomLabel.textContent=`${Math.round(scale*100)}%`;
  }
  function zoomIn(){scale*=1.2;updateTransform();}
  function zoomOut(){scale/=1.2;updateTransform();}
  function resetZoom(){scale=1;pointX=0;pointY=0;updateTransform();}
  // No capturar el puntero al hacer clic: setPointerCapture en el viewport
  // impedía que el evento click llegara a los polígonos del SVG.
  viewport.addEventListener('pointerdown',e=>{
    if(e.button!==0 || e.target.closest('button'))return;
    isDragging=true;didDrag=false;dragPointerId=e.pointerId;
    downX=e.clientX;downY=e.clientY;
    startX=e.clientX-pointX;startY=e.clientY-pointY;
  });
  window.addEventListener('pointermove',e=>{
    if(!isDragging||e.pointerId!==dragPointerId)return;
    if(!didDrag && Math.hypot(e.clientX-downX,e.clientY-downY)<6)return;
    didDrag=true;hideHover();pointX=e.clientX-startX;pointY=e.clientY-startY;updateTransform();
  });
  window.addEventListener('pointerup',e=>{
    if(e.pointerId!==dragPointerId)return;
    if(didDrag)lastDraggedAt=Date.now();
    isDragging=false;dragPointerId=null;didDrag=false;
  });
  window.addEventListener('pointercancel',()=>{isDragging=false;dragPointerId=null;didDrag=false;});
  viewport.addEventListener('wheel',e=>{e.preventDefault();hideHover();scale*=e.deltaY>0?.9:1.1;updateTransform();},{passive:false});
  async function installSvg() {
    const response = await fetch(SVG_URL);
    if (!response.ok) throw new Error(`SVG HTTP ${response.status}`);
    const svgMarkup = await response.text();
    const doc=new DOMParser().parseFromString(svgMarkup,'image/svg+xml');
    if(doc.querySelector('parsererror'))throw new Error('No se pudo leer el SVG.');
    const imported=document.importNode(doc.documentElement,true);
    imported.removeAttribute('width'); imported.removeAttribute('height');
    imported.id='map-svg';imported.setAttribute('role','img');imported.setAttribute('aria-label','Plano Mirador con lotes interactivos');
    document.getElementById('real-map-host').replaceChildren(imported);
    // Reforzar únicamente los contornos dibujados en el plano original.
    // Los polígonos interactivos permanecen sin borde: no alteramos el área de clic.
    imported.querySelectorAll('path, polyline, polygon, line').forEach(el => {
      if (el.hasAttribute('data-loteid') || el.closest('#lotes-interactivos')) return;
      const raw = (el.style.stroke || el.getAttribute('stroke') || '').trim().toLowerCase();
      if (!['#000000', '#000', 'black', '#2a2a2a'].includes(raw)) return;
      const oldWidth = parseFloat(el.style.strokeWidth || el.getAttribute('stroke-width') || '');
      if (!Number.isFinite(oldWidth) || oldWidth <= 0 || oldWidth > 1.1) return;
      // De 0.16 / 0.6 / 0.9 / 1 a líneas más legibles, sin engrosar bordes principales.
      el.style.stroke = '#1d2730';
      el.style.strokeWidth = String(Math.max(0.7, Math.min(1.35, oldWidth * 1.6)));
    });

    const all=[...imported.querySelectorAll('[data-loteid]')];
    for(const shape of all){
      const id=shape.getAttribute('data-loteid');
      if(!id)continue;
      shape.classList.add('lote-interactivo');shape.setAttribute('tabindex','0');shape.setAttribute('role','button');
      shape.setAttribute('aria-label',`Consultar lote ID ${id}`);
      shape.addEventListener('click',e=>{if(didDrag||Date.now()-lastDraggedAt<220)return;e.preventDefault();e.stopPropagation();hideHover();openModal(id);});
      shape.addEventListener('pointerenter',e=>showHover(id,e));
      shape.addEventListener('pointermove',e=>{if(hoveredLoteId===String(id)&&!didDrag)placeHover(e);});
      shape.addEventListener('pointerleave',hideHover);
      shape.addEventListener('focus',()=>{hoveredLoteId=String(id);fillHover(id);const bb=shape.getBoundingClientRect();hoverCard.classList.add('is-visible');placeHover({clientX:bb.left+bb.width/2,clientY:bb.top+bb.height/2});});
      shape.addEventListener('blur',hideHover);
      shape.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openModal(id);}});
    }
    updateStats();setNotice(`Mapa cargado: ${all.length} polígonos con loteid. Consultando datos…`);
  }
  // Fetch paginado para no quedarse con los primeros 1000 registros de PostgREST.
  async function loadData(){
    try {
      const pageSize=500; let offset=0, data=[];
      while(true){
        const url=new URL(`${SUPABASE_URL}/rest/v1/lote`);
        url.searchParams.set('select','loteid,desarrolloid,coto,manzana,nolote,clavelote,tipolote,linderonte,colindanciante,linderosur,colindanciasur,linderoote,colindanciaote,linderopte,colindanciapte,superficie,preciopormt2,preciolote,estatus,comentarios');
        url.searchParams.set('desarrolloid','eq.'+DESARROLLO_ID);
        url.searchParams.set('limit',pageSize);
        url.searchParams.set('offset',offset);
        const response=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`,'Accept':'application/json'},cache:'no-store'});
        if(!response.ok){const message=await response.text();throw new Error(`Supabase HTTP ${response.status}: ${message.slice(0,250)}`);}
        const page=await response.json();
        if(!Array.isArray(page))throw new Error('La respuesta de Supabase no es una lista.');
        data.push(...page);if(page.length<pageSize)break;
        offset+=pageSize;
        if(offset>20000)throw new Error('Demasiados registros: verifica filtro/paginación.');
      }
      registros.clear();
      for(const row of data){const id=getVal(row,'id');if(id!==null)registros.set(String(id),row);}
      dbReady=true;renderEstados();updateStats();
      const shapes=[...document.querySelectorAll('#map-svg [data-loteid]')];
      const matched=shapes.filter(el=>registros.has(el.getAttribute('data-loteid'))).length;
      if(matched!==shapes.length) {
        throw new Error(`No coinciden todos los lotes: ${matched}/${shapes.length}.`);
      }
      revealMap();
    } catch(error){
      dbReady=false;setMapLoadingError('La consulta de lotes falló. Comprueba la conexión y vuelve a intentarlo.');
      console.error('Supabase',error);
      updateStats();
    }
  }
  function renderEstados(){
    document.querySelectorAll('#map-svg [data-loteid]').forEach(p=>{
      const id=p.getAttribute('data-loteid');const r=registros.get(id);
      p.classList.toggle('sin-registro',!r);
      const estado=r?stateOf(r):'sin registro';
      // No simular un estado: si desconocemos el campo, queda transparente.
      const active=selectedLoteId===id;
      const color=active?(estadoOscuro[estado]||'#64748B'):(estadoColores[estado]||'transparent');
      p.setAttribute('fill',color);
      p.style.setProperty('fill',color,'important');
      // Contorno del mismo tono de su estado, más intenso que el relleno.
      // Solo aplica a los polígonos interactivos: calles, áreas verdes y descarga pluvial intactas.
      const borde = estadoBordes[estado] || 'none';
      p.style.setProperty('stroke',borde,'important');
      p.style.setProperty('stroke-width',borde==='none'?'0':'2.6','important');
      p.style.setProperty('stroke-linejoin','round','important');
      p.style.setProperty('stroke-linecap','round','important');
      p.setAttribute('aria-label',`Lote ID ${id}: ${r?'registro encontrado':'sin registro'}; estado ${estado}`);
    });
  }
  function updateStats(){
    const ids=[...document.querySelectorAll('#map-svg [data-loteid]')].map(el=>el.getAttribute('data-loteid'));
    setText('stat-total',ids.length);
    const estados=ids.map(id=>registros.get(id)).filter(Boolean).map(stateOf);
    for(const [key,estado] of [['stat-disponibles','disponible'],['stat-vendidos','vendido'],['stat-reservados','apartado'],['stat-bloqueados','bloqueado']]){
      setText(key,dbReady?estados.filter(v=>v===estado).length:'—');
    }
  }
  async function refreshOne(id){
    try {
      const url=new URL(`${SUPABASE_URL}/rest/v1/lote`);
      url.searchParams.set('select','loteid,desarrolloid,coto,manzana,nolote,clavelote,tipolote,linderonte,colindanciante,linderosur,colindanciasur,linderoote,colindanciaote,linderopte,colindanciapte,superficie,preciopormt2,preciolote,estatus,comentarios');
      url.searchParams.set('desarrolloid','eq.'+DESARROLLO_ID);
      url.searchParams.set('loteid','eq.'+id);
      url.searchParams.set('limit','1');
      const response=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`},cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const rows=await response.json();
      if(rows[0])registros.set(String(id),rows[0]);
      else registros.delete(String(id));
      renderEstados();updateStats();
      if(selectedLoteId===String(id))paintModal(id);
    }catch(e){showAlert('No se pudo actualizar el lote: '+e.message);}
  }
  function openModal(id){
    selectedLoteId=String(id);
    paintModal(id);
    refreshOne(id);
  }
  function paintModal(id){
    selectedLoteId=String(id);
    document.querySelectorAll('#map-svg .lote-seleccionado').forEach(x=>x.classList.remove('lote-seleccionado'));
    const el=[...document.querySelectorAll('#map-svg [data-loteid]')].find(x=>x.getAttribute('data-loteid')===selectedLoteId);
    if(el)el.classList.add('lote-seleccionado');
    renderEstados();
    const r=registros.get(selectedLoteId);
    setText('drawer-title',r?`Lote ${showVal(getVal(r,'numero'))}`:`Lote ID ${selectedLoteId}`);
    setText('drawer-subtitle',r?`Manzana ${showVal(getVal(r,'manzana'))} · Coto ${showVal(getVal(r,'coto'))}`:`Sin datos${dbReady?' en el desarrollo 7':' (consulta no disponible)'}`);
    const estado=r?stateOf(r):'sin datos';const badge=document.getElementById('drawer-badge');badge.textContent=estado.toUpperCase();
    badge.className='inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-slate-200 text-slate-700';
    if(estado==='disponible')badge.className+=' bg-emerald-100 text-emerald-800';
    if(estado==='vendido')badge.className+=' bg-red-100 text-red-800';
    if(estado==='apartado')badge.className+=' bg-amber-100 text-amber-800';
    const fields={'drawer-clave':'clave','drawer-nolote':'numero','drawer-manzana-val':'manzana','drawer-coto':'coto','drawer-tipo':'tipo',
       'drawer-lind-norte':'lindNorte','drawer-lind-sur':'lindSur','drawer-lind-este':'lindEste','drawer-lind-oeste':'lindOeste',
       'drawer-col-norte':'colNorte','drawer-col-sur':'colSur','drawer-col-este':'colEste','drawer-col-oeste':'colOeste','drawer-comentarios':'comentarios'};
    for(const [element,col] of Object.entries(fields))setText(element,showVal(getVal(r,col)));
    if(r){const missing=Object.entries(fields).filter(([,col])=>getVal(r,col)==null||getVal(r,col)==='').map(([,col])=>COLUMNAS[col]);
      console.info('Lote '+id+': columnas vacías en Supabase:',missing.length?missing:'ninguna');}
    setText('drawer-superficie',showVal(getVal(r,'superficie'),' m²'));
    setText('drawer-preciom2',moneda(getVal(r,'precioM2')));
    setText('drawer-preciototal',moneda(getVal(r,'precioTotal')));
    document.getElementById('lote-drawer-backdrop').classList.remove('opacity-0','pointer-events-none');
    document.getElementById('lote-drawer').classList.remove('translate-x-full');
  }
  function closeModal(){
    document.getElementById('lote-drawer').classList.add('translate-x-full');
    document.getElementById('lote-drawer-backdrop').classList.add('opacity-0');
    setTimeout(()=>document.getElementById('lote-drawer-backdrop').classList.add('pointer-events-none'),300);
    document.querySelectorAll('#map-svg .lote-seleccionado').forEach(x=>x.classList.remove('lote-seleccionado'));
    selectedLoteId=null;renderEstados();
  }
  function showAlert(message){const el=document.getElementById('toast');el.textContent=message;el.classList.remove('opacity-0','pointer-events-none');setTimeout(()=>el.classList.add('opacity-0','pointer-events-none'),2500);}
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  document.getElementById('lote-drawer-backdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
  if(window.lucide)lucide.createIcons();
  function verDetalleCompleto() {
    if (!DETALLE_LOTE_RUTA.trim()) { showAlert('Falta agregar ruta'); return; }
    if (!selectedLoteId) return;
    const ruta = DETALLE_LOTE_RUTA.replaceAll('{loteid}', encodeURIComponent(selectedLoteId));
    window.location.assign(new URL(ruta, document.baseURI).href);
  }
  async function initializeMap() {
    try {
      if (!document.getElementById('map-svg')) { await installSvg(); resetZoom(); }
      await loadData();
    } catch(error) {
      console.error('Error al preparar SVG:', error);
      setMapLoadingError('No se pudo cargar mapa.svg. Abre el proyecto desde un servidor HTTP local y vuelve a intentarlo.');
    }
  }
  const acciones = {
    regresar: () => window.history.back(),
    acercar: zoomIn, alejar: zoomOut, restablecer: resetZoom,
    cerrar: closeModal, detalle: verDetalleCompleto
  };
  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', acciones[button.dataset.action]);
  });
  initializeMap();
