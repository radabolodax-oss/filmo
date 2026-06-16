import{o as e}from"./rolldown-runtime-BM3Ffeng.js";import{f as t,u as n,y as r}from"./react-vendor-B2zTXonl.js";import{n as i}from"./i18n-B8BzBuy2.js";import{i as a}from"./i18n-DgUnAtfI.js";import{t as o}from"./PrefetchLink-A7nw2TC4.js";import{t as s}from"./chevron-right-Bj4w1jFM.js";import{t as c}from"./loader-PuHI6fDO.js";import{t as l}from"./axios-z4nC06Dh.js";import{H as u,Nt as d,Q as f,et as p,tt as m,ut as h}from"./index-B-jFuQ2c.js";import{n as g,t as _}from"./exclusiveCategories-DdVBdlfL.js";var v=e(r(),1),y=t(),b=2,x=`21bd7c2bfbde3a1cd4f82dfbe7781f76`,S=`
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

.slide-in-right {
  animation: slideInFromRight 0.7s ease-out forwards;
}

.slide-in-left {
  animation: slideInFromLeft 0.7s ease-out forwards;
}

.hero-slide-enter {
  z-index: 1;
}

.hero-slide-exit {
  z-index: 0;
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
  padding-top: 5px;
  padding-bottom: 40px;
  margin-top: -30px;
  overflow: visible !important;
  position: relative;
  z-index: 1;
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

.poster-row.no-scroll {
  overflow: hidden !important;
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

/* Provider navigation tabs */
.provider-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 3rem;
  margin-top: 0.5rem;
  margin-bottom: 1.5rem;
  position: relative;
  z-index: 100;
  background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 70%, transparent 100%);
}

.provider-tab {
  position: relative;
  padding: 0.6rem 1.2rem;
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 0.3s ease;
  border-radius: 8px;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.provider-tab.active {
  background: linear-gradient(135deg, #e50914, #b20710);
  color: white;
  box-shadow: 0 4px 15px rgba(229, 9, 20, 0.4);
}

.provider-tab:not(.active) {
  color: #aaa;
  background: rgba(255, 255, 255, 0.08);
}

.provider-tab:not(.active):hover {
  color: white;
  background: rgba(255, 255, 255, 0.15);
}

/* See all button */
.see-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: #999;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
  margin-left: 1rem;
}

.see-all-btn:hover {
  color: #fff;
  background: rgba(229, 9, 20, 0.3);
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 1rem;
}
`,C={8:`Netflix`,119:`Prime Video`,531:`Paramount+`,337:`Disney+`,338:`Marvel Studios`,350:`Apple TV+`,355:`Warner Bros`,356:`DC Comics`,384:`HBO MAX`,357:`OCS`},w={338:{id:338,name:`Marvel Studios`,tmdbId:420},356:{id:356,name:`DC Comics`,tmdbId:9993},355:{id:355,name:`Warner Bros`,tmdbId:174},357:{id:357,name:`OCS`,tmdbId:792}},T=e=>e.media_type||(e.first_air_date?`tv`:`movie`),E=e=>({...e,media_type:T(e),poster_path:e.poster_path||``,backdrop_path:e.backdrop_path||``,overview:e.overview||``}),D=e=>({...e,items:e.items.filter(e=>!!e.poster_path).map(E)}),O=v.memo(({category:e,catIndex:t,providerId:n,immediateLoadCount:r})=>{let{t:a}=i(),c=(e.items[0]?.media_type||(e.items[0]?.first_air_date?`tv`:`movie`))===`tv`?`tv`:`movies`,l=isNaN(Number(e.id))?null:e.id,u=e.id===`recent-movies`,d=e.id===`recent-tv`,m=e.id===`top-rated`,h=!!(l||u||d||m),g=``;l?g=`/provider/${n}/${c}/${l}`:u?g=`/provider/${n}/movies`:d?g=`/provider/${n}/tv`:m&&(g=`/provider/${n}/${c}`);let _=(0,v.useMemo)(()=>(0,y.jsxs)(`div`,{className:`category-header`,children:[(0,y.jsx)(`span`,{children:e.title}),h&&(0,y.jsxs)(o,{to:g,className:`see-all-btn`,children:[a(`providerCatalog.seeAll`),(0,y.jsx)(s,{size:14})]})]}),[e.title,h,g,a]);return(0,y.jsx)(f,{index:1+t,immediateLoadCount:r,children:(0,y.jsx)(p,{title:_,items:e.items,mediaType:e.id},e.id)},`lazy-${e.id}`)});O.displayName=`ProviderCategoryRow`;var k=()=>{let{providerId:e}=n(),{t}=i(),r=e=>t(`providerCatalog.genres.${e}`,{defaultValue:String(e)}),[T,k]=(0,v.useState)([]),[ee,A]=(0,v.useState)([]),[j,M]=(0,v.useState)([]),[N,P]=(0,v.useState)([]),[te,F]=(0,v.useState)(null),[I,ne]=(0,v.useState)([]),[L,R]=(0,v.useState)(0),[z,B]=(0,v.useState)(!0),[V,H]=(0,v.useState)(null),[re,ie]=(0,v.useState)(1),[U,ae]=(0,v.useState)(``),[W,oe]=(0,v.useState)(!1),[G,se]=(0,v.useState)([]),[K,ce]=(0,v.useState)(!1),q=(0,v.useRef)(null),[J,le]=(0,v.useState)(null),[Y,ue]=(0,v.useState)({}),X=(0,v.useRef)(null),Z=(0,v.useRef)({}),Q=async(e,t=1,n=1)=>{try{let r=w[Number(e)],i=new Date().toISOString().split(`T`)[0],o=await(async()=>{try{if(r){let e=Array.from({length:3},(e,t)=>l.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:x,language:a(),with_companies:r.tmdbId,sort_by:`popularity.desc`,"primary_release_date.lte":i,page:t+1}})),t=(await Promise.all(e)).flatMap(e=>e.data.results.filter(e=>e.poster_path&&e.overview).map(e=>({...e,media_type:`movie`})));return{trending:t.slice(0,10),movies:t,tvShows:[]}}let t=Array.from({length:3},(t,n)=>l.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:x,language:a(),with_watch_providers:e,watch_region:`FR`,"primary_release_date.lte":i,sort_by:`popularity.desc`,page:n+1}})),n=Array.from({length:3},(t,n)=>l.get(`https://api.themoviedb.org/3/discover/tv`,{params:{api_key:x,language:a(),with_watch_providers:e,watch_region:`FR`,"first_air_date.lte":i,sort_by:`popularity.desc`,page:n+1}})),[o,s]=await Promise.all([Promise.all(t),Promise.all(n)]),c=o.flatMap(e=>e.data.results.filter(e=>e.poster_path&&e.overview).map(e=>({...e,media_type:`movie`}))),u=s.flatMap(e=>e.data.results.filter(e=>e.poster_path&&e.overview).map(e=>({...e,media_type:`tv`}))),d=[...c,...u].sort((e,t)=>t.popularity-e.popularity).filter(e=>{let t=e.title||e.name||``;return!/[\u4e00-\u9fff]/.test(t)});return{trending:d.slice(0,10),movies:c,tvShows:u,all:d}}catch(e){return console.error(`Error fetching provider content:`,e),{trending:[],movies:[],tvShows:[],all:[]}}})();if(o.trending&&o.trending.length>0&&M((o.trending||[]).filter(e=>!!e.poster_path).map(E)),o.all&&o.all.length>0)return $(o.all),A(o.all),B(!1),o.all;let s=async t=>{if(r)return(await l.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:x,language:a(),with_companies:r.tmdbId,sort_by:`primary_release_date.desc`,"primary_release_date.lte":i,page:t}})).data.results.filter(e=>e.overview).map(e=>({...e,media_type:`movie`}));{let[n,r]=await Promise.all([l.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:x,language:a(),with_watch_providers:e,"primary_release_date.lte":i,sort_by:`popularity.desc`,page:t}}),l.get(`https://api.themoviedb.org/3/discover/tv`,{params:{api_key:x,language:a(),with_watch_providers:e,"first_air_date.lte":i,sort_by:`popularity.desc`,page:t}})]),o=n.data.results.filter(e=>e.overview),s=r.data.results.filter(e=>e.overview),c=o.map(e=>({...e,media_type:`movie`})),u=s.map(e=>({...e,media_type:`tv`}));return[...c,...u].sort(()=>Math.random()-.5)}},c=Array.from({length:n},(e,n)=>t+n);return(await Promise.all(c.map(e=>s(e)))).flat()}catch(e){throw console.error(`Error:`,e),e}},de=async e=>e.filter(e=>e.overview),$=e=>{let n=e.filter(e=>e.overview&&e.poster_path);if(n.length===0){console.warn(`Aucun contenu filtré disponible pour organiser les catégories`);return}let i=[...n],a=i.filter(e=>e.backdrop_path).sort((e,t)=>t.vote_average-e.vote_average).slice(0,5);ne(a),a.length>0&&F(a[0]);let o={};i.forEach(e=>{e.genre_ids&&e.genre_ids.length>0&&e.genre_ids.forEach(t=>{o[t]||(o[t]=[]),o[t].some(t=>t.id===e.id)||o[t].push(e)})});let s=Object.entries(o).map(([e,t])=>({id:e,title:r(Number(e))||`Category ${e}`,items:t.slice(0,15)})).filter(e=>e.items.length>=4).sort((e,t)=>t.items.length-e.items.length).slice(0,8),c=i.filter(e=>e.media_type===`movie`&&e.release_date).sort((e,t)=>{let n=e.release_date?new Date(e.release_date).getTime():0;return(t.release_date?new Date(t.release_date).getTime():0)-n}).slice(0,15),l=i.filter(e=>e.media_type===`tv`&&e.first_air_date).sort((e,t)=>{let n=e.first_air_date?new Date(e.first_air_date).getTime():0;return(t.first_air_date?new Date(t.first_air_date).getTime():0)-n}).slice(0,15),u=[];l.length>=4&&u.push({id:`recent-tv`,title:t(`providerCatalog.recentSeries`),items:l}),c.length>=4&&u.push({id:`recent-movies`,title:t(`providerCatalog.recentFilms`),items:c}),u.push(...s);let d=[...i].sort((e,t)=>t.vote_average-e.vote_average).slice(0,15);d.length>=4&&u.push({id:`top-rated`,title:t(`providerCatalog.bestRated`),items:d}),P(g(u,{minItems:Math.max(4,_()),limit:10,perCategoryLimit:15}).map(D))};(0,v.useEffect)(()=>{B(!0),(async()=>{if(e)try{let t=await de(await Q(e,1,50));A(t),M([...t].sort((e,t)=>t.vote_average-e.vote_average).slice(0,10).filter(e=>!!e.poster_path).map(E)),$(t)}catch(e){console.error(`Error:`,e),H(t(`providerCatalog.loadingError`))}finally{B(!1)}})()},[e]),(0,v.useEffect)(()=>{document.title=t(`providerCatalog.contentTitle`)},[]),(0,v.useEffect)(()=>{if(I.length>0)return q.current&&clearInterval(q.current),q.current=setInterval(()=>{R(e=>e===I.length-1?0:e+1)},6e3),()=>{q.current&&clearInterval(q.current)}},[I,L]),(0,v.useEffect)(()=>{I.length>0&&L<I.length&&F(I[L])},[L,I]),(0,v.useEffect)(()=>{let e=X.current;if(!e||J===null)return;let t=e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY))return e.preventDefault(),e.stopPropagation(),!1},n=e=>{if([`ArrowLeft`,`ArrowRight`,` `,`PageUp`,`PageDown`,`Home`,`End`].includes(e.key))return e.preventDefault(),e.stopPropagation(),!1};return e.addEventListener(`wheel`,t,{passive:!1}),e.addEventListener(`keydown`,n,{passive:!1}),()=>{e.removeEventListener(`wheel`,t),e.removeEventListener(`keydown`,n)}},[J]),(0,v.useEffect)(()=>{let e=Object.keys(Y).find(e=>Y[e]);if(!e)return;let t=Z.current[e];if(!t)return;let n=e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY))return e.preventDefault(),e.stopPropagation(),!1},r=e=>{if([`ArrowLeft`,`ArrowRight`,` `,`PageUp`,`PageDown`,`Home`,`End`].includes(e.key))return e.preventDefault(),e.stopPropagation(),!1};return t.addEventListener(`wheel`,n,{passive:!1}),t.addEventListener(`keydown`,r,{passive:!1}),()=>{t.removeEventListener(`wheel`,n),t.removeEventListener(`keydown`,r)}},[Y]);let fe=(0,v.useMemo)(()=>(0,y.jsx)(u,{icon:`🔥`,iconClass:`text-green-400`,label:t(`providerCatalog.todayTrends`)}),[t]);return(0,y.jsxs)(`div`,{className:`min-h-screen bg-black`,children:[(0,y.jsx)(`style`,{dangerouslySetInnerHTML:{__html:S}}),(0,y.jsx)(`div`,{className:`relative bg-black`,children:z?(0,y.jsx)(`div`,{className:`flex justify-center items-center h-screen`,children:(0,y.jsx)(c,{className:`animate-spin text-green-400`,size:48})}):V?(0,y.jsx)(`div`,{className:`text-center text-green-400 mt-24 pt-16`,children:V}):(0,y.jsxs)(`div`,{className:`pb-12 -mt-8`,children:[!K&&I.length>0&&(0,y.jsx)(`div`,{className:`relative w-full pt-24 md:pt-28 lg:pt-32`,children:(0,y.jsx)(m,{items:I.filter(e=>!!e.poster_path).map(e=>({...e,media_type:e.media_type||(e.first_air_date?`tv`:`movie`),poster_path:e.poster_path||``,backdrop_path:e.backdrop_path||``,overview:e.overview||``}))})}),K&&U&&(0,y.jsx)(`div`,{className:`container mx-auto px-4 mt-6`,children:(0,y.jsxs)(`div`,{className:`mt-24 pt-4`,children:[(0,y.jsx)(`h2`,{className:`text-xl font-bold mb-4`,children:t(`providerCatalog.searchResultsFor`,{query:U})}),W?(0,y.jsx)(`div`,{className:`flex justify-center py-8`,children:(0,y.jsx)(c,{className:`animate-spin`})}):G.length>0?(0,y.jsx)(`div`,{className:`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4`,children:G.map(e=>(0,y.jsxs)(o,{to:`/${e.media_type}/${e.id}`,className:`group block relative`,children:[e.poster_path?(0,y.jsx)(`img`,{src:`https://image.tmdb.org/t/p/w500${e.poster_path}`,alt:e.title||e.name,className:`w-full h-auto rounded-md transition-transform duration-300 group-hover:scale-105`,onError:e=>{let t=e.target;t.onerror=null,t.src=`data:image/svg+xml;utf8,<svg width="500" height="750" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 750" preserveAspectRatio="xMidYMid meet"><rect width="100%" height="100%" fill="%23333"/><text x="50%" y="50%" fill="%23ccc" font-size="50" font-family="Arial, sans-serif" text-anchor="middle" dy=".3em">Prowler</text></svg>`}}):(0,y.jsx)(`div`,{className:`w-full aspect-[2/3] bg-gray-800 rounded-md flex items-center justify-center`,children:(0,y.jsx)(`span`,{className:`text-gray-400`,children:e.title||e.name||`No image`})}),(0,y.jsx)(`div`,{className:`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 rounded-md`,children:(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`h3`,{className:`text-lg font-bold`,children:e.title||e.name}),(0,y.jsxs)(`div`,{className:`mt-2 text-sm`,children:[t(`providerCatalog.rating`),`: `,e.vote_average?.toFixed(1),`/10`]}),(0,y.jsx)(`div`,{className:`mt-1 text-sm text-gray-300`,children:e.media_type===`movie`?t(`providerCatalog.filmLabel`):t(`providerCatalog.seriesLabel`)})]})})]},`${e.id}-${e.media_type}`))}):(0,y.jsx)(`div`,{className:`text-center py-8 text-gray-400`,children:t(`providerCatalog.noResultsFor`,{query:U})})]})}),!K&&(0,y.jsxs)(y.Fragment,{children:[(0,y.jsxs)(`div`,{className:`provider-nav mt-4 mb-6`,children:[(0,y.jsx)(`span`,{className:`text-white font-semibold text-lg mr-4`,children:C[Number(e)]||`Provider`}),(0,y.jsxs)(o,{to:`/provider/${e}/movies`,className:`provider-tab`,children:[(0,y.jsx)(d,{size:18}),t(`providerCatalog.films`),(0,y.jsx)(s,{size:16})]}),(0,y.jsxs)(o,{to:`/provider/${e}/tv`,className:`provider-tab`,children:[(0,y.jsx)(h,{size:18}),t(`providerCatalog.series`),(0,y.jsx)(s,{size:16})]})]}),j.length>0&&(0,y.jsx)(`div`,{className:`content-row-container px-4 md:px-8 mb-2`,style:{marginTop:`0`,paddingTop:`20px`},children:(0,y.jsx)(f,{index:0,immediateLoadCount:b,children:(0,y.jsx)(p,{title:fe,items:j,mediaType:`top10`,showRanking:!0})})}),(0,y.jsx)(`div`,{className:`relative pb-16 px-4 md:px-8`,children:N.length>0&&N.map((t,n)=>(0,y.jsx)(O,{category:t,catIndex:n,providerId:e||``,immediateLoadCount:b},`row-${t.id}`))})]})]})})]})};export{k as default};