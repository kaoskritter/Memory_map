// Fuzzy dates: turns "early 1960s", "1958 to 1964", "about 1970", "since 2015" into a year range.
// Never an error: anything not understood returns null and the words are kept as typed.
export function parseWhen(text){
  if(!text) return null;
  var s=String(text).toLowerCase().replace(/[’‘`]/g,"'").trim();
  if(!s) return null;
  var ongoing=/\b(now|present|today|onwards?|still|since)\b/.test(s);
  var parts=s.split(/\s+(?:to|until|till|through|and)\s+|\s*[–—]\s*|(?<=[\ds])\s*-\s*(?=[\d'a-z])/).filter(Boolean);
  function part(p,century){
    var m;
    if((m=p.match(/(early|mid|middle|late)?[\s-]*(?:the\s+)?'?(\d{4}|\d{2})'?s\b/))){
      var d=m[2].length===2?(century||1900)+ +m[2]:+m[2]; d=Math.floor(d/10)*10;
      if(m[1]==='early') return [d,d+3];
      if(m[1]==='mid'||m[1]==='middle') return [d+4,d+6];
      if(m[1]==='late') return [d+7,d+9];
      return [d,d+9];
    }
    if((m=p.match(/\b(1[5-9]\d\d|20\d\d)\b/))) return [+m[1],+m[1]];
    if(century!=null&&(m=p.match(/^'?(\d{2})$/))) return [century+ +m[1],century+ +m[1]];
    return null;
  }
  var a=part(parts[0]); if(!a) { a=part(s); if(!a) return null; parts=[s]; }
  var b=null;
  if(parts.length>1) b=part(parts[parts.length-1],Math.floor(a[0]/100)*100);
  var from=a[0], to=b?b[1]:a[1];
  if(to<from) to=a[1];
  if(ongoing&&!b) to=null;
  return {from:from,to:to};
}
