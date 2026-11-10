/**
 * The requests a page is certain to make, begun while its scripts are still
 * on their way.
 *
 * Most pages here are a ready-made shell that asks for its contents once it
 * is running: who is signed in, then their stories, their characters, the
 * library's shelf. On a phone that used to be three waits end to end (the
 * scripts, the sign-in answer, the contents). This small script sits in the
 * page's <head> and runs before anything else: it starts those same requests
 * at once, and hands each answer to the first part of the app that asks for
 * that address - so the waits overlap instead of queueing.
 *
 * Careful by design:
 *  - an answer is handed over once, then forgotten, and only within the
 *    page's first few seconds: nothing asked for later is ever answered
 *    from here;
 *  - anything that isn't a plain read of that exact address goes straight
 *    to the network as always, and the first change sent to the server
 *    throws away whatever is still waiting;
 *  - the account's own lists are only asked for early on a device that was
 *    signed in last time (a note kept by <Providers>), so a visitor's page
 *    never makes requests that would only be turned away.
 *
 * (Kept as plain old JavaScript in a string: it runs before the app does.)
 */
export const EARLY_SIGNED_IN = "taleo.in";

export const EARLY_FETCH = `(function(){try{var w=window,f=w.fetch;if(!f)return;var E={},n=0,p=location.pathname,d=new Date(),z=function(x){return(x<10?"0":"")+x},day=d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate()),inn=false;try{inn=localStorage.getItem("${EARLY_SIGNED_IN}")==="1"}catch(e){}
function g(u){E[u]=f.call(w,u,{credentials:"same-origin"});E[u].catch(function(){});n++}
g("/api/auth/session");
if(p==="/store")g("/api/gallery?day="+day);
if(inn){if(p!=="/sign-in"&&p!=="/welcome"&&p.indexOf("/admin")!==0){g("/api/story");g("/api/draft")}
if(p==="/home"){g("/api/gallery?sort=rating&limit=8&day="+day);g("/api/gallery/mine");g("/api/user/saved");g("/api/user/reading")}
}
else if(p==="/")g("/api/gallery?sort=rating&limit=8&day="+day);
function done(){E={};n=0;w.fetch=f}
w.fetch=function(i,o){var u=typeof i==="string"?i:"",m=o&&o.method?String(o.method).toUpperCase():"GET";if(m!=="GET"){done();return f.apply(w,arguments)}var r=E[u];if(!r||(o&&o.signal))return f.apply(w,arguments);delete E[u];if(--n<=0)w.fetch=f;var a=arguments;return r.then(function(x){return x},function(){return f.apply(w,a)})};
setTimeout(done,8000)}catch(e){}})();`;
