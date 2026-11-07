/* Design-only real-geography map. Demo points and endpoint relation are never live observations or route geometry. */
'use strict';
let previewMap;
const premiumMap=kind=>`<div class="geo-frame ${kind==='overview'?'geo-overview':'geo-route'}"><div class="geo-map" role="img" aria-label="Interactive OpenFreeMap geographic basemap centered over the Gulf"></div><div class="geo-hud"><span class="hud-label">GULF NETWORK <i> / </i> DEMO</span><span class="hud-sub">Geographic basemap · illustrative overlay</span></div><div class="geo-tools"><button type="button" data-map-action="pitch" title="Toggle map perspective" aria-label="Toggle map perspective">3D</button><button type="button" data-map-action="zoom-in" aria-label="Zoom in">+</button><button type="button" data-map-action="zoom-out" aria-label="Zoom out">−</button></div><div class="geo-legend"><span><i class="mark-hub"></i> HUB</span><span><i class="mark-ship"></i> VESSEL DEMO</span><span><i class="mark-plane"></i> AIRCRAFT DEMO</span><span class="geo-disclaimer">Dotted link indicates endpoints only — not navigational geometry</span></div><div class="geo-failure" hidden>Basemap unavailable. No substitute geographic or live-position data shown.</div></div>`;
function initPremiumMap(){
  if(previewMap){previewMap.remove();previewMap=null;}
  const el=document.querySelector('.geo-map');if(!el)return;
  const fail=()=>{const frame=el.closest('.geo-frame');if(frame)frame.querySelector('.geo-failure').hidden=false;};
  if(!window.maplibregl){fail();return;}
  try{
    const map=new maplibregl.Map({container:el,style:'https://tiles.openfreemap.org/styles/liberty',center:[50.7,25.65],zoom:5.5,pitch:58,bearing:-22,attributionControl:true,antialias:true,renderWorldCopies:false});
    previewMap=map;
    map.on('error',event=>{if(!map.loaded())fail();console.warn('Map preview source:',event.error?.message||'Unavailable');});
    map.on('load',()=>{
      el.closest('.geo-frame').classList.add('geo-ready');
      // Recolor OpenFreeMap vector geography; tile geometry and attribution remain unchanged.
      for(const layer of map.getStyle().layers){
        try{
          if(layer.id==='natural_earth')map.setPaintProperty(layer.id,'raster-opacity',0);
          if(layer.type==='background')map.setPaintProperty(layer.id,'background-color','#292c2c');
          if(layer.type==='fill'&&layer.paint?.['fill-color'])map.setPaintProperty(layer.id,'fill-color',layer.id==='water'?'#1a262b':layer.id.includes('park')?'#303630':'#2e3231');
          if(layer.type==='fill'&&layer.paint?.['fill-outline-color'])map.setPaintProperty(layer.id,'fill-outline-color','#414744');
          if(layer.type==='line'&&layer.paint?.['line-color'])map.setPaintProperty(layer.id,'line-color',layer.id.includes('water')?'#34444a':'#484b49');
          if(layer.type==='symbol'&&layer.paint?.['text-color']){
            map.setPaintProperty(layer.id,'text-color','#b8bdba');
            map.setPaintProperty(layer.id,'text-halo-color','#232827');
            map.setPaintProperty(layer.id,'text-halo-width',1);
          }
        }catch(error){console.warn('Optional dark style layer unavailable:',layer.id,error.message);}
      }
      const source=map.getSource('openmaptiles');
      if(source){try{map.addLayer({id:'preview-buildings',type:'fill-extrusion',source:'openmaptiles','source-layer':'building',minzoom:10,paint:{'fill-extrusion-color':'#b7b2a8','fill-extrusion-height':['coalesce',['get','render_height'],['get','height'],0],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':0.5}});}catch(error){console.warn('Optional 3D buildings unavailable:',error.message);}}
      const demo={type:'FeatureCollection',features:[
        {type:'Feature',properties:{kind:'hub',title:'Jebel Ali · demonstration origin'},geometry:{type:'Point',coordinates:[55.06,24.99]}},
        {type:'Feature',properties:{kind:'hub',title:'Doha · demonstration destination'},geometry:{type:'Point',coordinates:[51.53,25.29]}},
        {type:'Feature',properties:{kind:'ship',title:'Illustrative vessel · NOT an AIS observation'},geometry:{type:'Point',coordinates:[53.4,25.8]}},
        {type:'Feature',properties:{kind:'ship',title:'Illustrative vessel · NOT an AIS observation'},geometry:{type:'Point',coordinates:[50.3,26.55]}},
        {type:'Feature',properties:{kind:'plane',title:'Illustrative aircraft · NOT an OpenSky observation'},geometry:{type:'Point',coordinates:[52.3,26.9]}}
      ]};
      map.addSource('demo-points',{type:'geojson',data:demo});
      map.addSource('endpoint-relation',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:[[55.06,24.99],[51.53,25.29]]},properties:{}}});
      map.addLayer({id:'endpoint-relation',type:'line',source:'endpoint-relation',paint:{'line-color':'#ddd9ce','line-width':1.4,'line-opacity':0.8,'line-dasharray':[2,4]}});
      const colors={hub:'#e7e5df',ship:'#ddc58f',plane:'#afc0b5'};
      for(const [kind,color] of Object.entries(colors))map.addLayer({id:'demo-'+kind,type:'circle',source:'demo-points',filter:['==',['get','kind'],kind],paint:{'circle-radius':kind==='hub'?6:5,'circle-color':color,'circle-stroke-color':'#181818','circle-stroke-width':2,'circle-opacity':0.96}});
      for(const kind of Object.keys(colors)){
        map.on('click','demo-'+kind,e=>{const item=e.features?.[0];if(item)new maplibregl.Popup({closeButton:false,offset:12}).setLngLat(item.geometry.coordinates).setText(`${item.properties.title} · Demonstration overlay, not a verified live observation`).addTo(map);});
        map.on('mouseenter','demo-'+kind,()=>map.getCanvas().style.cursor='pointer');
        map.on('mouseleave','demo-'+kind,()=>map.getCanvas().style.cursor='');
      }
      document.querySelectorAll('.map-dashboard [data-chip]').forEach(button=>button.addEventListener('click',()=>{const label=button.textContent.trim().toLowerCase();const target=label.includes('vessels')?'demo-ship':label.includes('aviation')?'demo-plane':label.includes('routes')?'endpoint-relation':label.includes('shipments')?'demo-hub':null;if(target&&map.getLayer(target))map.setLayoutProperty(target,'visibility',button.classList.contains('active')?'none':'visible');}));
    });
    el.closest('.geo-frame').querySelectorAll('[data-map-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.mapAction;if(action==='pitch')map.easeTo({pitch:map.getPitch()>20?0:58,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:400});else map[action==='zoom-in'?'zoomIn':'zoomOut']();}));
  }catch(error){console.warn('Map preview unavailable:',error);fail();}
}
