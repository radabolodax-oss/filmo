import{o as e}from"./rolldown-runtime-BM3Ffeng.js";import{f as t,y as n}from"./react-vendor-B2zTXonl.js";import{n as r}from"./i18n-B8BzBuy2.js";import{i}from"./i18n-DgUnAtfI.js";import{o as a}from"./PrefetchLink-A7nw2TC4.js";import{t as o}from"./axios-z4nC06Dh.js";import{$ as s,H as c,Q as l,et as u,nt as d,tt as f}from"./index-B-jFuQ2c.js";import{t as p}from"./EmblaCarouselGenres-BuOoNdwT.js";import{n as m,t as h}from"./exclusiveCategories-DdVBdlfL.js";var g=e(n(),1),_=t(),v=2,y={28:`Action`,12:`Aventure`,16:`Animation`,35:`Comédie`,80:`Crime`,99:`Documentaire`,18:`Drame`,10751:`Famille`,14:`Fantastique`,36:`Histoire`,27:`Horreur`,10402:`Musique`,9648:`Mystère`,10749:`Romance`,878:`Science-Fiction`,10770:`Téléfilm`,53:`Thriller`,10752:`Guerre`,37:`Western`,10759:`Action & Aventure`,10762:`Enfants`,10763:`Actualités`,10764:`Téléréalité`,10765:`Science-Fiction & Fantastique`,10766:`Feuilleton`,10767:`Talk-show`,10768:`Guerre & Politique`},b=`
@keyframes fadeInOut {
  0% { opacity: 0; transform: scale(1.05) translateX(-10%); }
  10% { opacity: 1; transform: scale(1) translateX(-5%); }
  90% { opacity: 1; transform: scale(1) translateX(5%); }
  100% { opacity: 0; transform: scale(1.05) translateX(10%); }
}

@keyframes slideInFromRight {
  0% { transform: translateX(50px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}

@keyframes slideInFromLeft {
  0% { transform: translateX(-50px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}

.poster-row.no-scroll {
  overflow: hidden !important;
}

.slide-in-right {
  animation: slideInFromRight 0.7s ease-out forwards;
}

.slide-in-left {
  animation: slideInFromLeft 0.7s ease-out forwards;
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

@keyframes fadeInTitle {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
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

@keyframes expandWidth {
  0% { width: 0; }
  100% { width: 40px; }
}

.content-row-container {
  padding: 2px 0px 8px 0px;
  margin-top: 11px;
  overflow: visible !important;
  position: relative;
  z-index: 10;
}

.poster-row {
  display: flex;
  gap: 10px;
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  padding: 5rem 0.5rem;
  margin: -5rem -0.5rem;
  overflow-x: auto !important;
  overflow-y: visible !important;
  scrollbar-width: none;
  -ms-overflow-style: none;
  position: relative;
  z-index: 5;
}

.poster-row::-webkit-scrollbar {
  display: none;
}

.poster-container {
  position: relative;
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  margin: 0;
  flex-shrink: 0;
  z-index: 10;
  overflow: visible;
  padding: 0;
}

.poster-container:hover {
  z-index: 50;
  overflow: visible;
  transform: translateZ(0);
}

.poster-container:hover ~ .poster-container {
  transform: translateX(0);
}

.poster-card {
  position: relative;
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  transform-origin: 0% 0%;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  overflow: visible;
  cursor: pointer;
  z-index: 10;
  margin-bottom: 3rem;
  margin-top: 1rem;
}

.poster-card:hover {
  transform: scale(1.5);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  z-index: 100;
  overflow: visible;
  transform-style: preserve-3d;
  position: relative;
}

.poster-container:has(.poster-card:hover) ~ .poster-container {
  transform: translateX(100px);
}

.poster-container:hover ~ .poster-container {
  transition-delay: 0.12s;
  transform: translateX(100px);
}

.poster-card .hover-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #141414;
  opacity: 0;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  transition: opacity 0.3s ease;
  overflow: hidden;
}

.poster-card:hover .hover-content {
  opacity: 1;
}

.poster-card:hover img.poster {
  opacity: 0;
}

.card-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  align-items: center;
}

.card-buttons a {
  transition: transform 0.2s ease;
}

.card-buttons a:hover {
  transform: scale(1.2);
}

.top-content-row {
  margin-top: 10px;
  margin-bottom: 10px;
  padding-left: 64px;
  padding-right: 64px;
  gap: 15px;
}
`,x=`21bd7c2bfbde3a1cd4f82dfbe7781f76`,S=e=>({...e,media_type:`tv`,poster_path:e.poster_path||``,backdrop_path:e.backdrop_path||``,overview:e.overview||``}),C=e=>({...e,items:e.items.map(e=>S(e))}),w=()=>{let{t:e}=r(),[t,n]=(0,g.useState)([]),[w,T]=(0,g.useState)([]),[E,D]=(0,g.useState)(0),[O,k]=(0,g.useState)([]),[A,j]=(0,g.useState)([]),[M,N]=(0,g.useState)(!0),[P,F]=(0,g.useState)(null),I=(0,g.useRef)(null),[L,R]=(0,g.useState)(!1),z=(0,g.useRef)(null),[B,V]=(0,g.useState)(null),[H,U]=(0,g.useState)([{id:10759,name:`Action & Aventure`,route:`/genre/tv/10759`},{id:16,name:`Animation`,route:`/genre/tv/16`},{id:35,name:`Comédie`,route:`/genre/tv/35`},{id:80,name:`Crime`,route:`/genre/tv/80`},{id:99,name:`Documentaire`,route:`/genre/tv/99`},{id:18,name:`Drame`,route:`/genre/tv/18`},{id:10751,name:`Famille`,route:`/genre/tv/10751`},{id:10762,name:`Enfants`,route:`/genre/tv/10762`},{id:9648,name:`Mystère`,route:`/genre/tv/9648`},{id:10763,name:`Actualités`,route:`/genre/tv/10763`},{id:10764,name:`Téléréalité`,route:`/genre/tv/10764`},{id:10765,name:`SF & Fantastique`,route:`/genre/tv/10765`},{id:10766,name:`Feuilleton`,route:`/genre/tv/10766`},{id:10767,name:`Talk-show`,route:`/genre/tv/10767`},{id:10768,name:`Guerre & Politique`,route:`/genre/tv/10768`}]);s({mode:`page`,pageData:{pageName:`tv-shows`}});let W=t=>{let n=t.filter(e=>e.overview&&e.poster_path),r={};n.forEach(e=>{e.genre_ids&&e.genre_ids.length>0&&e.genre_ids.forEach(t=>{r[t]||(r[t]=[]),r[t].some(t=>t.id===e.id)||r[t].push(e)})});let i=Object.entries(r).map(([e,t])=>({id:e,title:y[Number(e)]||`Category ${e}`,items:t.slice(0,15)})).filter(e=>e.items.length>=3).sort((e,t)=>t.items.length-e.items.length).slice(0,10),a=n.reduce((e,t)=>(e.some(e=>e.id===t.id)||e.push(t),e),[]).filter(e=>e.first_air_date).sort((e,t)=>{let n=e.first_air_date?new Date(e.first_air_date).getTime():0;return(t.first_air_date?new Date(t.first_air_date).getTime():0)-n}).slice(0,15),o=[];a.length>=5&&o.push({id:`recent-shows`,title:e(`home.recentShows`),items:a}),o.push(...i),j(m(o,{minItems:h(),limit:10,perCategoryLimit:15}).map(C))},G=async()=>{try{N(!0);let e=sessionStorage.getItem(`movix_tvshows_data`),t=sessionStorage.getItem(`movix_tvshows_data_timestamp`);if(e&&t&&Date.now()-parseInt(t)<900*1e3){let t=JSON.parse(e);T((t.featuredShows||[]).map(S)),k((t.topContent||[]).map(S)),n(t.tvShows||[]),t.tvShows&&t.tvShows.length>0&&W(t.tvShows),N(!1);return}let r=await o.get(`https://api.themoviedb.org/3/discover/tv`,{params:{api_key:x,language:i(),page:1,sort_by:`popularity.desc`,with_genres:`10759|18|10768`,vote_average_gte:7,"vote_count.gte":100,include_adult:!1}}),a=[...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/tv`,{params:{api_key:x,language:i(),page:t+1,sort_by:`popularity.desc`,with_genres:`35`,include_adult:!1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/tv`,{params:{api_key:x,language:i(),page:t+1,sort_by:`popularity.desc`,with_genres:`10765`,include_adult:!1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/tv`,{params:{api_key:x,language:i(),page:t+1,sort_by:`popularity.desc`,with_genres:`80`,include_adult:!1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/tv`,{params:{api_key:x,language:i(),page:t+1,sort_by:`popularity.desc`,with_genres:`99`,include_adult:!1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/tv`,{params:{api_key:x,language:i(),page:t+1,sort_by:`popularity.desc`,with_genres:`18`,include_adult:!1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/tv`,{params:{api_key:x,language:i(),page:t+1,sort_by:`popularity.desc`,with_genres:`9648`,include_adult:!1}}))],s=await Promise.all(a),c=r.data.results.filter(e=>e.poster_path&&e.overview&&e.overview.trim()!==``).map(e=>({...e,media_type:`tv`})),l=s.flatMap(e=>e.data.results.filter(e=>e.poster_path&&e.overview&&e.overview.trim()!==``).map(e=>({...e,media_type:`tv`}))),u=[...c];if(l.forEach(e=>{u.some(t=>t.id===e.id)||u.push(e)}),u.length>0){T(u.filter(e=>e.backdrop_path&&e.overview).slice(0,8).map(S));try{let e=await o.get(`https://api.themoviedb.org/3/trending/tv/day`,{params:{api_key:x,language:i()}}),t=new Date;k(e.data.results.filter(e=>{if(!e.first_air_date)return!1;let n=new Date(e.first_air_date);return!(new Date(n.setHours(0,0,0,0))>new Date(t.setHours(0,0,0,0))||!e.poster_path||!e.overview||/[\u4e00-\u9fff]/.test(e.name))}).slice(0,10).map(S))}catch(e){console.error(`Error fetching trending TV shows:`,e),k([...u].sort((e,t)=>t.vote_average-e.vote_average).slice(0,10).map(S))}W(u)}n(u);let d=u.filter(e=>e.backdrop_path&&e.overview).slice(0,8),f=[];try{let e=new Date;f=u.filter(t=>{if(!t.first_air_date)return!1;let n=new Date(t.first_air_date);return!(new Date(n.setHours(0,0,0,0))>new Date(new Date(e).setHours(0,0,0,0))||!t.poster_path||!t.overview||/[\u4e00-\u9fff]/.test(t.name))}).slice(0,10)}catch{f=[...u].sort((e,t)=>t.vote_average-e.vote_average).slice(0,10)}let p={featuredShows:d,topContent:f,tvShows:u,categories:[]};sessionStorage.setItem(`movix_tvshows_data`,JSON.stringify(p)),sessionStorage.setItem(`movix_tvshows_data_timestamp`,Date.now().toString())}catch(t){console.error(`Error fetching TV shows:`,t),F(e(`home.errorLoadingData`))}finally{N(!1)}};(0,g.useEffect)(()=>{G()},[]),(0,g.useEffect)(()=>{let e=`movix_tv_genre_images`,t=`movix_tv_genre_images_ts`,n=sessionStorage.getItem(e),r=sessionStorage.getItem(t);(async()=>{try{if(n&&r&&Date.now()-parseInt(r)<864e5){U(JSON.parse(n));return}let a=await Promise.all(H.map(async e=>{try{let t=await o.get(`https://api.themoviedb.org/3/discover/tv`,{params:{api_key:x,language:i(),with_genres:e.id,sort_by:`popularity.desc`,include_adult:!1,page:1}}),n=Array.isArray(t.data?.results)?t.data.results.find(e=>e.backdrop_path||e.poster_path):null,r=n?.backdrop_path||n?.poster_path||``,a=r?`https://image.tmdb.org/t/p/w780${r}`:void 0;return{...e,imageUrl:a}}catch{return e}}));U(a),sessionStorage.setItem(e,JSON.stringify(a)),sessionStorage.setItem(t,Date.now().toString())}catch{}})()},[]),(0,g.useEffect)(()=>{document.title=`${e(`tvShows.title`)} - Prowler`},[]),(0,g.useEffect)(()=>{if(w.length>1)return I.current&&clearInterval(I.current),I.current=setInterval(()=>{D(e=>e===w.length-1?0:e+1)},6e3),()=>{I.current&&clearInterval(I.current)}},[w,E]),(0,g.useEffect)(()=>{let e=z.current;if(!e||B===null)return;let t=e=>{if(e instanceof WheelEvent&&Math.abs(e.deltaX)>Math.abs(e.deltaY))return e.preventDefault(),e.stopPropagation(),!1},n=e=>{if([`ArrowLeft`,`ArrowRight`,` `,`PageUp`,`PageDown`,`Home`,`End`].includes(e.key))return e.preventDefault(),e.stopPropagation(),!1};return e.addEventListener(`wheel`,t,{passive:!1}),e.addEventListener(`keydown`,n,{passive:!1}),()=>{e.removeEventListener(`wheel`,t),e.removeEventListener(`keydown`,n)}},[B]);let K=(0,g.useMemo)(()=>(0,_.jsx)(c,{icon:`🔥`,iconClass:`text-green-400`,label:e(`home.trendingToday`)}),[e]),q=(0,g.useMemo)(()=>A.map(e=>(0,_.jsx)(c,{label:typeof e.title==`string`?e.title:String(e.title)})),[A]),J=(0,g.useMemo)(()=>(0,_.jsx)(c,{icon:`🧭`,iconClass:`text-white`,label:e(`genres.findByGenre`)}),[e]);return P?(0,_.jsx)(`div`,{className:`flex items-center justify-center h-screen`,children:(0,_.jsx)(`div`,{className:`bg-gradient-to-r from-green-400 to-purple-500 text-green-400 px-6 py-4 rounded-lg`,children:P})}):M&&t.length===0?(0,_.jsxs)(`div`,{className:`min-h-screen bg-black text-white`,children:[(0,_.jsx)(`div`,{className:`relative w-full`,children:(0,_.jsx)(d,{})}),(0,_.jsxs)(`div`,{className:`container mx-auto px-4 py-8 space-y-8`,children:[(0,_.jsx)(a,{}),(0,_.jsx)(a,{}),(0,_.jsx)(a,{})]})]}):(0,_.jsxs)(`div`,{className:`min-h-screen bg-black text-white -mt-[302px]`,children:[(0,_.jsx)(`style`,{children:b}),(0,_.jsx)(`div`,{className:`relative w-full mb-1 mt-[304px]`,children:w.length>0&&(0,_.jsx)(f,{items:w})}),(0,_.jsx)(`div`,{className:`w-full bg-black py-2 relative mt-0 z-[20] px-4 md:px-8`,children:(0,_.jsx)(p,{title:J,items:H})}),(0,_.jsxs)(`div`,{className:`pb-3 -mt-3 relative z-[20]`,children:[O.length>0&&(0,_.jsx)(`div`,{className:`px-4 md:px-8`,children:(0,_.jsx)(l,{index:0,immediateLoadCount:v,children:(0,_.jsx)(u,{title:K,items:O,mediaType:`top10`,showRanking:!0})})}),A.length>0&&A.map((e,t)=>(0,_.jsx)(`div`,{className:`px-4 md:px-8`,children:(0,_.jsx)(l,{index:1+t,immediateLoadCount:v,children:(0,_.jsx)(u,{title:q[t],items:e.items,mediaType:e.id},e.id)},`lazy-${e.id}`)},`wrap-${e.id}`))]}),(0,_.jsx)(`div`,{})]})};export{w as default};