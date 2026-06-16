import{o as e}from"./rolldown-runtime-BM3Ffeng.js";import{f as t,y as n}from"./react-vendor-B2zTXonl.js";import{n as r}from"./i18n-B8BzBuy2.js";import{i}from"./i18n-DgUnAtfI.js";import{o as a}from"./PrefetchLink-A7nw2TC4.js";import{t as o}from"./axios-z4nC06Dh.js";import{$ as s,H as c,Q as l,et as u,nt as d,tt as f}from"./index-B-jFuQ2c.js";import{t as p}from"./EmblaCarouselGenres-BuOoNdwT.js";import{n as m,t as h}from"./exclusiveCategories-DdVBdlfL.js";var g=e(n(),1),_=t(),v=2,y=`21bd7c2bfbde3a1cd4f82dfbe7781f76`,b={28:`Action`,12:`Aventure`,16:`Animation`,35:`Comédie`,80:`Crime`,99:`Documentaire`,18:`Drame`,10751:`Famille`,14:`Fantastique`,36:`Histoire`,27:`Horreur`,10402:`Musique`,9648:`Mystère`,10749:`Romance`,878:`Science-Fiction`,10770:`Téléfilm`,53:`Thriller`,10752:`Guerre`,37:`Western`},x=`
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
`,S=e=>({...e,media_type:`movie`,poster_path:e.poster_path||``,backdrop_path:e.backdrop_path||``,overview:e.overview||``}),C=e=>({...e,items:e.items.map(e=>S(e))}),w=()=>{let{t:e}=r(),[t,n]=(0,g.useState)([]),[w,T]=(0,g.useState)([]),[E,D]=(0,g.useState)([]),[O,k]=(0,g.useState)([]),[A,j]=(0,g.useState)(0),[M,N]=(0,g.useState)(!0),[P,F]=(0,g.useState)(null),[I,L]=(0,g.useState)(1),[R,z]=(0,g.useState)(!0),[B,V]=(0,g.useState)(!1),H=(0,g.useRef)();(0,g.useRef)(null);let[U,W]=g.useState(!1),G=g.useRef(null),[K,q]=(0,g.useState)([{id:28,name:`Action`,route:`/genre/movie/28`},{id:12,name:`Aventure`,route:`/genre/movie/12`},{id:16,name:`Animation`,route:`/genre/movie/16`},{id:35,name:`Comédie`,route:`/genre/movie/35`},{id:80,name:`Crime`,route:`/genre/movie/80`},{id:99,name:`Documentaire`,route:`/genre/movie/99`},{id:18,name:`Drame`,route:`/genre/movie/18`},{id:10751,name:`Famille`,route:`/genre/movie/10751`},{id:14,name:`Fantastique`,route:`/genre/movie/14`},{id:36,name:`Histoire`,route:`/genre/movie/36`},{id:27,name:`Horreur`,route:`/genre/movie/27`},{id:10402,name:`Musique`,route:`/genre/movie/10402`},{id:9648,name:`Mystère`,route:`/genre/movie/9648`},{id:10749,name:`Romance`,route:`/genre/movie/10749`},{id:878,name:`Science-Fiction`,route:`/genre/movie/878`},{id:10770,name:`Téléfilm`,route:`/genre/movie/10770`},{id:53,name:`Thriller`,route:`/genre/movie/53`},{id:10752,name:`Guerre`,route:`/genre/movie/10752`},{id:37,name:`Western`,route:`/genre/movie/37`}]);s({mode:`page`,pageData:{pageName:`movies`}}),(0,g.useCallback)(e=>{M||(H.current&&H.current.disconnect(),H.current=new IntersectionObserver(e=>{e[0].isIntersecting&&R&&L(e=>e+1)}),e&&H.current.observe(e))},[M,R]);let J=async t=>{try{if(V(t>1),t===1){let e=sessionStorage.getItem(`movix_movies_data`),t=sessionStorage.getItem(`movix_movies_data_timestamp`);if(e&&t&&Date.now()-parseInt(t)<900*1e3){let t=JSON.parse(e);T((t.featuredMovies||[]).map(S)),D((t.topMovies||[]).map(S)),n(t.movies||[]),t.movies&&t.movies.length>0&&Y(t.movies),N(!1);return}}let e=await o.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:y,language:i(),page:t,sort_by:`popularity.desc`,with_release_type:`2|3`,include_adult:!1}}),r=[];if(t===1){let e=[...Array.from({length:2},(e,t)=>o.get(`https://api.themoviedb.org/3/movie/top_rated`,{params:{api_key:y,language:i(),page:t+1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:y,language:i(),with_genres:`28`,sort_by:`popularity.desc`,page:t+1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:y,language:i(),with_genres:`35`,sort_by:`popularity.desc`,page:t+1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:y,language:i(),with_genres:`18`,sort_by:`popularity.desc`,page:t+1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:y,language:i(),with_genres:`27`,sort_by:`popularity.desc`,page:t+1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:y,language:i(),with_genres:`878`,sort_by:`popularity.desc`,page:t+1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:y,language:i(),with_genres:`12`,sort_by:`popularity.desc`,page:t+1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:y,language:i(),with_genres:`16`,sort_by:`popularity.desc`,page:t+1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:y,language:i(),with_genres:`53`,sort_by:`popularity.desc`,page:t+1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:y,language:i(),with_genres:`80`,sort_by:`popularity.desc`,page:t+1}})),...Array.from({length:3},(e,t)=>o.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:y,language:i(),with_genres:`10751`,sort_by:`popularity.desc`,page:t+1}}))];r=(await Promise.all(e)).flatMap(e=>e.data.results)}let a=e.data.results.filter(e=>e.poster_path&&e.overview&&e.overview.trim()!==``),s=r.filter(e=>e.poster_path&&e.overview&&e.overview.trim()!==``),c=[...a,...s];if(t===1&&a.length>0){T(a.filter(e=>e.backdrop_path&&e.overview).slice(0,8).map(S));try{let e=await o.get(`https://api.themoviedb.org/3/trending/movie/day`,{params:{api_key:y,language:i()}}),t=new Date;D(e.data.results.filter(e=>{if(!e.release_date)return!1;let n=new Date(e.release_date);return!(new Date(n.setHours(0,0,0,0))>new Date(t.setHours(0,0,0,0))||!e.poster_path||!e.overview||/[\u4e00-\u9fff]/.test(e.title))}).slice(0,10).map(S))}catch(e){console.error(`Error fetching trending movies:`,e),D([...c].sort((e,t)=>t.vote_average-e.vote_average).filter((e,t,n)=>t===n.findIndex(t=>t.id===e.id)).slice(0,10).map(S))}Y(c)}n(e=>{if(t===1)return c;let n=a.filter(t=>!e.some(e=>e.id===t.id));return[...e,...n]});let l=t>=e.data.total_pages;if(z(a.length>0&&!l),t===1){let e=a.filter(e=>e.backdrop_path&&e.overview).slice(0,8),t=[];try{let e=new Date;t=c.filter(t=>{if(!t.release_date)return!1;let n=new Date(t.release_date);return!(new Date(n.setHours(0,0,0,0))>new Date(new Date(e).setHours(0,0,0,0))||!t.poster_path||!t.overview||/[\u4e00-\u9fff]/.test(t.title))}).slice(0,10)}catch{t=[...c].sort((e,t)=>t.vote_average-e.vote_average).filter((e,t,n)=>t===n.findIndex(t=>t.id===e.id)).slice(0,10)}let n={featuredMovies:e,topMovies:t,movies:c,categories:[]};sessionStorage.setItem(`movix_movies_data`,JSON.stringify(n)),sessionStorage.setItem(`movix_movies_data_timestamp`,Date.now().toString())}}catch(t){console.error(`Error fetching movies:`,t),F(e(`home.errorLoadingData`))}finally{N(!1),V(!1)}};(0,g.useEffect)(()=>{J(1)},[]),(0,g.useEffect)(()=>{let e=`movix_movie_genre_images`,t=`movix_movie_genre_images_ts`,n=sessionStorage.getItem(e),r=sessionStorage.getItem(t);(async()=>{try{if(n&&r&&Date.now()-parseInt(r)<864e5){q(JSON.parse(n));return}let a=await Promise.all(K.map(async e=>{try{let t=await o.get(`https://api.themoviedb.org/3/discover/movie`,{params:{api_key:y,language:i(),with_genres:e.id,sort_by:`popularity.desc`,include_adult:!1,page:1}}),n=Array.isArray(t.data?.results)?t.data.results.find(e=>e.backdrop_path||e.poster_path):null,r=n?.backdrop_path||n?.poster_path||``,a=r?`https://image.tmdb.org/t/p/w780${r}`:void 0;return{...e,imageUrl:a}}catch{return e}}));q(a),sessionStorage.setItem(e,JSON.stringify(a)),sessionStorage.setItem(t,Date.now().toString())}catch{}})()},[]),(0,g.useEffect)(()=>{I>1&&J(I)},[I]);let Y=t=>{let n=t.filter(e=>e.overview&&e.poster_path),r={};n.forEach(e=>{e.genre_ids&&e.genre_ids.length>0&&e.genre_ids.forEach(t=>{r[t]||(r[t]=[]),r[t].some(t=>t.id===e.id)||r[t].push(e)})});let i=Object.entries(r).map(([e,t])=>{let n=t.filter((e,t,n)=>t===n.findIndex(t=>t.id===e.id));return{id:e,title:b[Number(e)]||`Category ${e}`,items:n.slice(0,15)}}).filter(e=>e.items.length>=3).sort((e,t)=>t.items.length-e.items.length).slice(0,10),a=n.reduce((e,t)=>(e.some(e=>e.id===t.id)||e.push(t),e),[]).filter(e=>e.release_date).sort((e,t)=>{let n=e.release_date?new Date(e.release_date).getTime():0;return(t.release_date?new Date(t.release_date).getTime():0)-n}).slice(0,15),o=[];a.length>=5&&o.push({id:`recent-movies`,title:e(`home.recentMovies`),items:a}),o.push(...i),k(m(o,{minItems:h(),limit:10,perCategoryLimit:15}).map(C))};(0,g.useEffect)(()=>{document.title=`${e(`movies.title`)} - Prowler`},[]),g.useEffect(()=>{let e=G.current;if(!e||!U)return;let t=e=>{if(e instanceof WheelEvent&&Math.abs(e.deltaX)>Math.abs(e.deltaY))return e.preventDefault(),e.stopPropagation(),!1},n=e=>{if([`ArrowLeft`,`ArrowRight`,` `,`PageUp`,`PageDown`,`Home`,`End`].includes(e.key))return e.preventDefault(),e.stopPropagation(),!1};return e.addEventListener(`wheel`,t,{passive:!1}),e.addEventListener(`keydown`,n,{passive:!1}),()=>{e.removeEventListener(`wheel`,t),e.removeEventListener(`keydown`,n)}},[U]);let X=(0,g.useMemo)(()=>(0,_.jsx)(c,{icon:`🔥`,iconClass:`text-green-400`,label:e(`home.trendingToday`)}),[e]),Z=(0,g.useMemo)(()=>(0,_.jsx)(c,{icon:`🧭`,iconClass:`text-white`,label:e(`genres.findByGenre`)}),[e]),Q=(0,g.useMemo)(()=>O.map(e=>(0,_.jsx)(c,{label:typeof e.title==`string`?e.title:String(e.title)})),[O]);return P?(0,_.jsx)(`div`,{className:`flex items-center justify-center h-screen`,children:(0,_.jsx)(`div`,{className:`bg-gradient-to-r from-green-400 to-purple-500 text-green-400 px-6 py-4 rounded-lg`,children:P})}):M&&t.length===0?(0,_.jsxs)(`div`,{className:`min-h-screen bg-black text-white`,children:[(0,_.jsx)(`div`,{className:`relative w-full`,children:(0,_.jsx)(d,{})}),(0,_.jsxs)(`div`,{className:`container mx-auto px-4 py-8 space-y-8`,children:[(0,_.jsx)(a,{}),(0,_.jsx)(a,{}),(0,_.jsx)(a,{})]})]}):(0,_.jsxs)(`div`,{className:`min-h-screen bg-black text-white -mt-[302px]`,children:[(0,_.jsx)(`style`,{children:x}),(0,_.jsx)(`div`,{className:`relative w-full mb-1 mt-[304px]`,children:w.length>0&&(0,_.jsx)(f,{items:w})}),(0,_.jsxs)(`div`,{className:`pb-3 mt-0 relative z-[20]`,children:[(0,_.jsx)(`div`,{className:`w-full bg-black py-2 relative px-4 md:px-8`,children:(0,_.jsx)(p,{title:Z,items:K})}),E.length>0&&(0,_.jsx)(`div`,{className:`px-4 md:px-8`,children:(0,_.jsx)(l,{index:0,immediateLoadCount:v,children:(0,_.jsx)(u,{title:X,items:E,mediaType:`top10`,showRanking:!0})})}),O.length>0&&O.map((e,t)=>(0,_.jsx)(`div`,{className:`px-4 md:px-8`,children:(0,_.jsx)(l,{index:1+t,immediateLoadCount:v,children:(0,_.jsx)(u,{title:Q[t],items:e.items,mediaType:e.id},e.id)},`lazy-${e.id}`)},`wrap-${e.id}`))]})]})};export{w as default};