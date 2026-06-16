import{o as e}from"./rolldown-runtime-BM3Ffeng.js";import{f as t,y as n}from"./react-vendor-B2zTXonl.js";import{n as r}from"./i18n-B8BzBuy2.js";import{i}from"./i18n-DgUnAtfI.js";import{o as a}from"./PrefetchLink-A7nw2TC4.js";import{t as o}from"./axios-z4nC06Dh.js";import{n as s}from"./tmdbKeywords-DIPoBSka.js";import{$ as c,Q as l,et as u,nt as d,tt as f}from"./index-B-jFuQ2c.js";import{t as p}from"./EmblaCarouselGenres-BuOoNdwT.js";import{n as m}from"./certificationUtils-CUU9YEdV.js";var h=e(n(),1),g=t(),_=`21bd7c2bfbde3a1cd4f82dfbe7781f76`,v=2,y=1440*60*1e3,b=900*1e3,x=17,S=[`FR`,`US`,`JP`,`GB`,`CA`],C=`movix_anime_content_rating_`,w=12,T=[{id:16,labelKey:`genres.id_16`,route:`/genre/anime/16`,discoverGenres:`16`},{id:10759,labelKey:`genres.id_10759`,route:`/genre/anime/10759`,discoverGenres:`16,10759`},{id:10765,labelKey:`genres.id_10765`,route:`/genre/anime/10765`,discoverGenres:`16,10765`},{id:35,labelKey:`genres.id_35`,route:`/genre/anime/35`,discoverGenres:`16,35`},{id:18,labelKey:`genres.id_18`,route:`/genre/anime/18`,discoverGenres:`16,18`},{id:9648,labelKey:`genres.id_9648`,route:`/genre/anime/9648`,discoverGenres:`16,9648`},{id:10751,labelKey:`genres.id_10751`,route:`/genre/anime/10751`,discoverGenres:`16,10751`},{id:10762,labelKey:`genres.id_10762`,route:`/genre/anime/10762`,discoverGenres:`16,10762`}],E=[10759,10765,35,18,9648,10751,10762],D=`
@keyframes fadeInTitle {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes expandWidth {
  0% { width: 0; }
  100% { width: 40px; }
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  position: relative;
  background: linear-gradient(90deg, #ffffff, #e2e2e2);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0px 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.5px;
  padding-bottom: 0.5rem;
  text-transform: uppercase;
  display: inline-block;
  animation: fadeInTitle 0.8s ease-out forwards;
  transition: all 0.3s ease;
}

.section-title:hover {
  background: linear-gradient(90deg, #4ade80, #a855f7);
  -webkit-background-clip: text;
  background-clip: text;
  transform: translateY(-2px);
  text-shadow: 0px 4px 8px rgba(168, 85, 247, 0.4);
}

.section-title::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 40px;
  height: 3px;
  background: linear-gradient(90deg, #4ade80 0%, #a855f7 100%);
  border-radius: 3px;
  animation: expandWidth 0.6s ease-out forwards 0.3s;
  transform-origin: left;
  transition: all 0.3s ease;
}

.section-title:hover::after {
  width: 100%;
  background: linear-gradient(90deg, #4ade80, #a855f7);
}
`,O=e=>e.filter((e,t,n)=>t===n.findIndex(t=>t.id===e.id)),k=e=>!!(e?.id&&e?.name&&e?.poster_path&&e?.overview?.trim()),A=e=>{if(!e.first_air_date)return 0;let t=new Date(e.first_air_date).getTime();return Number.isNaN(t)?0:t},j=(e,t)=>e.name.localeCompare(t.name,void 0,{sensitivity:`base`,numeric:!0}),M=(e,t)=>{let n=(t.popularity??0)-(e.popularity??0);if(n!==0)return n;let r=(t.vote_count??0)-(e.vote_count??0);if(r!==0)return r;let i=(t.vote_average??0)-(e.vote_average??0);return i===0?j(e,t):i},N=(e,t)=>{let n=A(t)-A(e);return n===0?M(e,t):n},P=(e,t,n={})=>({api_key:_,language:e,include_adult:!1,with_genres:`16`,sort_by:`popularity.desc`,"vote_count.gte":25,...t?{with_keywords:String(t)}:{},...n}),F=e=>{for(let t of S){let n=e.find(e=>e.iso_3166_1===t&&e.rating);if(n?.rating)return n.rating}return e.find(e=>e.rating)?.rating||``},I=e=>{try{let t=sessionStorage.getItem(`${C}${e}`);if(!t)return null;let n=JSON.parse(t);return typeof n.age==`number`?n.age:null}catch{return null}},L=(e,t)=>{try{sessionStorage.setItem(`${C}${e}`,JSON.stringify({age:t}))}catch{}},R=async e=>{let t=I(e);if(t!==null)return t;try{let t=await o.get(`https://api.themoviedb.org/3/tv/${e}/content_ratings`,{params:{api_key:_}}),n=F(Array.isArray(t.data?.results)?t.data.results:[]),r=n?m(n):0;return L(e,r),r}catch{return L(e,0),0}},z=async e=>{let t=[];for(let n=0;n<e.length;n+=w){let r=e.slice(n,n+w),i=await Promise.all(r.map(e=>R(e.id)));r.forEach((e,n)=>{i[n]<x&&t.push(e)})}return t},B=()=>{let{t:e,i18n:t}=r(),n=i(),[m,_]=(0,h.useState)([]),[x,S]=(0,h.useState)([]),[C,w]=(0,h.useState)([]),[A,j]=(0,h.useState)([]),[F,I]=(0,h.useState)({}),[L,R]=(0,h.useState)(!0),[B,V]=(0,h.useState)(null),H=`movix_anime_data_v2_${n}`,U=`${H}_timestamp`,W=`movix_anime_genre_images_v2_${n}`,G=`${W}_timestamp`;c({mode:`page`,pageData:{pageName:`anime`}});let K=(0,h.useCallback)(t=>e(`genres.id_${t}`,{defaultValue:`Genre ${t}`}),[e]),q=(0,h.useMemo)(()=>T.map(t=>({id:t.id,name:e(t.labelKey),route:t.route,imageUrl:F[t.id]})),[F,e]),J=(0,h.useCallback)(t=>{let n=O(t).filter(k),r={};n.forEach(e=>{e.genre_ids?.forEach(t=>{t!==16&&(r[t]||(r[t]=[]),r[t].some(t=>t.id===e.id)||r[t].push(e))})});let i=new Map(E.map((e,t)=>[e,t])),a=Object.entries(r).map(([e,t])=>{let n=[...t].sort(M),r=i.get(Number(e)),a=r===void 0?0:(E.length-r)*5;return{id:e,title:K(Number(e)),items:n.slice(0,15),score:n.length+a}}).filter(e=>e.items.length>=3).sort((e,t)=>t.score-e.score),o=new Set,s=a.map(({id:e,title:t,items:n})=>{let r=n.filter(e=>!o.has(e.id)).slice(0,15);return r.forEach(e=>{o.add(e.id)}),{id:e,title:t,items:r}}).filter(e=>e.items.length>=4).slice(0,6).map(({id:e,title:t,items:n})=>({id:e,title:t,items:n})),c=n.filter(e=>!!e.first_air_date).sort(N).slice(0,15),l=[];c.length>=5&&l.push({id:`recent-anime`,title:e(`animePage.recentAnime`),items:c}),l.push(...s),j(l)},[K,e]),Y=(0,h.useCallback)(async()=>{try{R(!0),V(null);let e=sessionStorage.getItem(H),t=sessionStorage.getItem(U);if(e&&t&&Date.now()-Number(t)<b){let t=JSON.parse(e);S(t.featuredShows||[]),w(t.topContent||[]),_(t.animeShows||[]),Array.isArray(t.animeShows)&&t.animeShows.length>0&&J(t.animeShows),R(!1);return}let r=await s(`anime`,n),i=[...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/tv`,{params:P(n,r,{page:t+1})})),...T.filter(e=>e.id!==16).map(e=>o.get(`https://api.themoviedb.org/3/discover/tv`,{params:P(n,r,{page:1,with_genres:e.discoverGenres})}))],a=await z(O((await Promise.all(i)).flatMap(e=>(e.data?.results||[]).filter(k).map(e=>({...e,media_type:`tv`})))).sort(M)),c=a.filter(e=>e.backdrop_path&&e.overview).slice(0,8),l=a.slice(0,15);S(c),w(l),_(a),J(a),sessionStorage.setItem(H,JSON.stringify({featuredShows:c,topContent:l,animeShows:a})),sessionStorage.setItem(U,Date.now().toString())}catch(t){console.error(`Error fetching anime shows:`,t),V(e(`home.errorLoadingData`))}finally{R(!1)}},[H,U,J,e,n]);return(0,h.useEffect)(()=>{Y()},[Y]),(0,h.useEffect)(()=>{(async()=>{try{let e=sessionStorage.getItem(W),t=sessionStorage.getItem(G);if(e&&t&&Date.now()-Number(t)<y){I(JSON.parse(e));return}let r=await s(`anime`,n),i=await Promise.all(T.map(async e=>{try{let t=await o.get(`https://api.themoviedb.org/3/discover/tv`,{params:P(n,r,{with_genres:e.discoverGenres,page:1})}),i=(await z(Array.isArray(t.data?.results)?t.data.results.filter(e=>e.backdrop_path||e.poster_path):[]))[0]||null,a=i?.backdrop_path||i?.poster_path||``;return[e.id,a?`https://image.tmdb.org/t/p/w780${a}`:void 0]}catch{return[e.id,void 0]}})),a=Object.fromEntries(i);I(a),sessionStorage.setItem(W,JSON.stringify(a)),sessionStorage.setItem(G,Date.now().toString())}catch{}})()},[W,G,n]),(0,h.useEffect)(()=>{document.title=`${e(`animePage.title`)} - Prowler`},[t.language,e]),B?(0,g.jsx)(`div`,{className:`flex items-center justify-center h-screen`,children:(0,g.jsx)(`div`,{className:`bg-gradient-to-r from-green-400 to-purple-500 text-green-400 px-6 py-4 rounded-lg`,children:B})}):L&&m.length===0?(0,g.jsxs)(`div`,{className:`min-h-screen bg-black text-white`,children:[(0,g.jsx)(`div`,{className:`relative w-full`,children:(0,g.jsx)(d,{})}),(0,g.jsxs)(`div`,{className:`container mx-auto px-4 py-8 space-y-8`,children:[(0,g.jsx)(a,{}),(0,g.jsx)(a,{}),(0,g.jsx)(a,{})]})]}):(0,g.jsxs)(`div`,{className:`min-h-screen bg-black text-white -mt-[302px]`,children:[(0,g.jsx)(`style`,{children:D}),(0,g.jsx)(`div`,{className:`relative w-full mb-1 mt-[304px]`,children:x.length>0&&(0,g.jsx)(f,{items:x.map(e=>({...e,media_type:`tv`}))})}),(0,g.jsx)(`div`,{className:`w-full bg-black py-2 relative mt-0 z-[20] px-4 md:px-8`,children:(0,g.jsx)(p,{title:(0,g.jsxs)(`span`,{children:[(0,g.jsx)(`span`,{className:`text-white mr-2`,children:`🧭`}),(0,g.jsx)(`span`,{children:e(`genres.findByGenre`)})]}),items:q})}),(0,g.jsxs)(`div`,{className:`pb-3 relative z-[10]`,style:{marginTop:`11px`},children:[C.length>0&&(0,g.jsx)(`div`,{className:`px-4 md:px-8`,children:(0,g.jsx)(l,{index:0,immediateLoadCount:v,children:(0,g.jsx)(u,{title:(0,g.jsxs)(`span`,{children:[(0,g.jsx)(`span`,{className:`text-green-400 mr-2`,children:`🔥`}),(0,g.jsx)(`span`,{children:e(`animePage.trending`)})]}),items:C.map(e=>({...e,media_type:`tv`,poster_path:e.poster_path||``,backdrop_path:e.backdrop_path||``,overview:e.overview||``})),mediaType:`anime-trending`,showRanking:!0})})}),A.map((e,t)=>(0,g.jsx)(`div`,{className:`px-4 md:px-8`,children:(0,g.jsx)(l,{index:1+t,immediateLoadCount:v,children:(0,g.jsx)(u,{title:e.title,items:e.items.map(e=>({...e,media_type:`tv`,poster_path:e.poster_path||``,backdrop_path:e.backdrop_path||``,overview:e.overview||``})),mediaType:e.id})},e.id)},`wrap-${e.id}`))]})]})};export{B as default};