import fs from 'fs';
import * as topo from 'topojson-client';
import * as d3 from 'd3-geo';
const t = JSON.parse(fs.readFileSync(new URL('./node_modules/es-atlas/es/autonomous_regions.json', import.meta.url)));
const fc = topo.feature(t, t.objects.autonomous_regions);
const feats = fc.features.filter(f=>f.id!=="20");
const main = {type:'FeatureCollection',features:feats.filter(f=>f.id!=="05")};
const can = feats.find(f=>f.id==="05");
const W=1000,H=780;
const pm = d3.geoConicConformal().rotate([3.5,0]).parallels([37,43]).fitExtent([[20,15],[W-15,H-15]], main);
const pathM = d3.geoPath(pm).digits(1);
// Canarias en recuadro inferior izquierdo
const box=[[10,H-150],[205,H-10]];
const pc = d3.geoConicConformal().rotate([15.5,0]).parallels([27,29]).fitExtent([[box[0][0]+12,box[0][1]+12],[box[1][0]-12,box[1][1]-12]], can);
const pathC = d3.geoPath(pc).digits(1);
const short = {"01":"Andalucía","02":"Aragón","03":"Asturias","04":"Islas Baleares","05":"Canarias","06":"Cantabria","07":"Castilla y León","08":"Castilla-La Mancha","09":"Cataluña","10":"Comunidad Valenciana","11":"Extremadura","12":"Galicia","13":"Comunidad de Madrid","14":"Región de Murcia","15":"Navarra","16":"País Vasco","17":"La Rioja","18":"Ceuta","19":"Melilla"};
const out=[];
for (const f of feats){
  const path = f.id==="05"?pathC:pathM;
  let c = path.centroid(f);
  if (f.geometry.type==='MultiPolygon' && !["04","05"].includes(f.id)){
    let best=null,ba=-1;
    for(const p of f.geometry.coordinates){const g={type:'Polygon',coordinates:p};const a=path.area(g);if(a>ba){ba=a;best=g;}}
    c=path.centroid(best);
  }
  out.push({id:f.id,name:short[f.id],d:path(f),cx:+c[0].toFixed(1),cy:+c[1].toFixed(1),area:+path.area(f).toFixed(0)});
}
const data={width:W,height:H,canaryBox:[box[0][0],box[0][1],box[1][0]-box[0][0],box[1][1]-box[0][1]],regions:out};
fs.writeFileSync(new URL('../js/map-data.js', import.meta.url),'// Mapa generado a partir de es-atlas (MIT, https://github.com/martgnz/es-atlas) con d3-geo.\n// Coordenadas ya proyectadas en un lienzo SVG de '+W+'x'+H+'.\nwindow.MAP_DATA = '+JSON.stringify(data)+';\n');
console.log(fs.statSync('map-data.js').size); console.log(out.map(r=>r.name+' '+r.cx+','+r.cy+' a='+r.area).join('\n'));
