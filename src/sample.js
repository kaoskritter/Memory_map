// An invented life, used for the "See an example" demo. Peggy is not a real person.
const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function samplePhoto(label,h){
  var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl('+h+',35%,82%)"/><stop offset="1" stop-color="hsl('+h+',30%,62%)"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><circle cx="310" cy="80" r="34" fill="hsl('+h+',45%,92%)"/><path d="M0 230 Q100 170 200 215 T400 190 V300 H0z" fill="hsl('+h+',28%,45%)"/><path d="M0 260 Q140 215 260 250 T400 240 V300 H0z" fill="hsl('+h+',30%,34%)"/><rect x="12" y="12" width="376" height="276" fill="none" stroke="#fff" stroke-width="6" opacity=".7"/><text x="200" y="60" text-anchor="middle" font-family="Georgia,serif" font-size="22" fill="#fff">'+esc(label)+'</text><text x="200" y="285" text-anchor="middle" font-family="Verdana,sans-serif" font-size="13" fill="#fff" opacity=".9">Sample picture</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
function base(){
  var n=0;function E(cat,title,when,lat,lng,addr,mem,o){o=o||{};var e={id:'s'+(++n),cat:cat,title:title,when:when,lat:lat,lng:lng,precision:o.rough?'approx':'detailed',addr:addr,extra:o.extra||{},people:o.people||'',memories:mem||[],photos:(o.photos||[]).map(function(p){return {src:samplePhoto(p[0],p[1]),cap:p[0]}})};return e}
  var P='Peggy',H='Helen (daughter)',T='Tom (grandson)';
  return {
   demo:true,mapId:null,role:'owner',mode:'living',
   subject:{preferred:'Peggy Lawson',birthName:'Margaret Rose Hartley',pronouns:'she / her',born:'1938',died:'2023',forSelf:false,relationship:'Daughter',builder:'Helen',
     changes:[{name:'Peggy Hartley',year:'about 1944',reason:'Nickname from her father that stuck'},{name:'Peggy Lawson',year:'1962',reason:'Marriage'}]},
   events:[
    E('birth','Born at the Base Hospital','1938',-37.5596,143.8474,{street:'Drummond Street North',town:'Ballarat',state:'Victoria',country:'Australia'},[{by:P,text:'Mum always said I arrived in the middle of a hailstorm and have been making noise ever since.'}]),
    E('home','The weatherboard on Humffray Street','1938 to 1956',-37.565,143.878,{rough:'Humffray Street, Ballarat East, near the creek',country:'Australia'},[{by:P,text:'Four of us girls in one bedroom. In winter the frost sat on the inside of the window and we drew pictures in it.'}],{rough:true,photos:[['Humffray Street',32]]}),
    E('school','Golden Point primary school','early 1940s to 1950',-37.5712,143.8662,{rough:'Golden Point, Ballarat',country:'Australia'},[{by:P,text:'I walked there with my sisters. Miss Aldous let me clean the blackboard, which I thought was the highest honour going.'}],{rough:true,extra:{type:'Primary'}}),
    E('school','Teachers’ college in Carlton','1956 to 1958',-37.7975,144.962,{street:'Grattan Street',town:'Carlton',state:'Victoria',country:'Australia'},[{by:P,text:'First time living away from home. I was terrified for a week and then I never wanted to leave.'}],{extra:{type:'College or university',course:'Primary teaching certificate'}}),
    E('home','Boarding house off Drummond Street','1956 to 1958',-37.799,144.969,{rough:'Somewhere on or near Drummond Street, Carlton',country:'Australia'},[{by:P,text:'Mrs Pappas ran it. No gentlemen callers past the front step, and the best lemon cake in Melbourne.'}],{rough:true}),
    E('work','First teaching post, Castlemaine','1959 to 1962',-37.064,144.217,{town:'Castlemaine',state:'Victoria',country:'Australia'},[{by:P,text:'Forty-two children in grade three and me barely twenty-one. I learned more than they did.'}],{extra:{role:'Primary school teacher'}}),
    E('event','Married Ted Lawson','1962',-37.56,143.856,{rough:'A church on Lydiard Street, Ballarat',country:'Australia'},[{by:P,text:'It rained, the car broke down, and Ted’s brother lost the ring for ten minutes. Best day of my life.'},{by:H,text:'Dad kept the order of service in his wallet until it fell apart.'}],{rough:true,people:'Ted Lawson',photos:[['Wedding day, 1962',340]]}),
    E('home','Electra Street, Williamstown','1963 to 1978',-37.861,144.894,{street:'Electra Street',town:'Williamstown',state:'Victoria',country:'Australia'},[{by:H,text:'The house I grew up in. You could smell the sea from the back step and hear the ships at night.'}],{photos:[['Electra Street',150]]}),
    E('work','Williamstown primary school','1964 to 1975',-37.864,144.899,{town:'Williamstown',state:'Victoria',country:'Australia'},[{by:P,text:'Eleven years of grade twos. I still get stopped in the street by grown men who say “Mrs Lawson?”'}],{extra:{role:'Teacher, later deputy head'}}),
    E('life','Swimming and life saving club','1960s and 70s',-37.869,144.895,{rough:'Williamstown Beach',country:'Australia'},[{by:H,text:'Mum swam every morning before school, even in July. She said the cold was the whole point.'}],{rough:true}),
    E('event','Helen was born','1965',-37.865,144.888,{town:'Williamstown',state:'Victoria',country:'Australia'},[{by:P,text:'Ted fainted. I did not.'}],{people:'Helen, Ted'}),
    E('fav','Summers at Lorne','most summers in the 1970s',-38.541,143.975,{rough:'A rented fibro shack up the hill at Lorne',country:'Australia'},[{by:H,text:'Fish and chips on the pier and Mum reading the same Agatha Christie every year.'}],{rough:true,photos:[['Lorne pier',200]]}),
    E('travel','Trip to Whitby to meet Ted’s family','1974',54.4863,-0.6133,{town:'Whitby',state:'North Yorkshire',country:'England'},[{by:P,text:'Six weeks by ship and then the coldest August I have ever known. His mother and I wrote to each other for twenty years afterwards.'}]),
    E('home','The house in Daylesford','1979 to 2015',-37.348,144.142,{street:'Vincent Street',town:'Daylesford',state:'Victoria',country:'Australia'},[{by:P,text:'We came for a weekend and bought it on the Monday. Thirty-six years in that garden.'},{by:T,text:'Nan’s kitchen always smelled of stewed quinces. I thought every grandmother had a quince tree.'}],{photos:[['The Daylesford garden',95]]}),
    E('life','Community choir','late 1980s onwards',-37.344,144.15,{rough:'The town hall, Daylesford',country:'Australia'},[{by:P,text:'Second alto. Not the best voice, but the loudest.'}],{rough:true}),
    E('landmark','Lake Daylesford','1979 to 2015',-37.353,144.137,{town:'Daylesford',state:'Victoria',country:'Australia'},[{by:T,text:'She walked the lake every morning and knew every dog by name, and none of the owners.'}]),
    E('travel','Uluru, after retiring','1996',-25.3444,131.0369,{town:'Uluru',state:'Northern Territory',country:'Australia'},[{by:P,text:'Ted and I drove the whole way in the Kingswood. I had never seen a sky that big.'}]),
    E('home','The unit near Helen, Geelong','since 2015',-38.149,144.36,{town:'Geelong',state:'Victoria',country:'Australia'},[{by:H,text:'Ten minutes from us. She complained about the stairs and then planted the whole courtyard.'}]),
    E('fav','Eastern Beach','since 2015',-38.144,144.372,{town:'Geelong',state:'Victoria',country:'Australia'},[{by:T,text:'Sunday ice creams on the promenade. She always had rum and raisin.'}]),
    E('end','Farewell service','2023',-38.152,144.355,{rough:'A chapel in Geelong',country:'Australia'},[{by:H,text:'The choir came down from Daylesford and sang. Standing room only.'}],{rough:true}),
    E('end','Resting place, beside Ted','2023',-37.531,143.85,{rough:'Ballarat New Cemetery',country:'Australia'},[{by:H,text:'Back in Ballarat, where she started. There is a bench nearby with a view of the hills.'}],{rough:true})
   ]};
}


// Peggy's family, and the places each of them was part of.
export function sample(){
  var o=base(), id=0, P=function(name,born,died,note){var p={id:'p'+(++id),subject:false,name:name,born:born||'',died:died||'',note:note||'',sex:''};o.people.push(p);return p.id};
  o.people=[{id:'p0',subject:true,name:'',born:'',died:'',note:''}];
  var arthur=P('Arthur Hartley','about 1905','1971','A boilermaker at the Phoenix Foundry. Sang in the kitchen.'),
      rose=P('Rose Hartley','1908','1990','Kept chooks and four daughters in line.'),
      joan=P('Joan Hartley','1941','','Peggy’s little sister. Still rings every Sunday.'),
      ted=P('Ted Lawson','1935','2019','Came out from Whitby in 1957 and never quite lost the accent.'),
      edith=P('Edith Lawson','1910','1996','Ted’s mother. She and Peggy wrote to each other for twenty years.'),
      helen=P('Helen Lawson','1965','',''),mark=P('Mark Rossi','1963','',''),tom=P('Tom Rossi','1994','','');
  var sex={};sex[arthur]='male';sex[rose]='female';sex[joan]='female';sex[ted]='male';sex[edith]='female';sex[helen]='female';sex[mark]='male';sex[tom]='male';
  o.people.forEach(function(p){if(sex[p.id])p.sex=sex[p.id]});
  var n=0,L=function(f,t,k){o.links.push({id:'f'+(++n),from:f,to:t,kind:k})};
  o.links=[];
  L('p0',ted,'partner');L(arthur,rose,'partner');L(arthur,'p0','parent');L(rose,'p0','parent');L(arthur,joan,'parent');L(rose,joan,'parent');
  L(edith,ted,'parent');L('p0',helen,'parent');L(ted,helen,'parent');L(helen,mark,'partner');L(helen,tom,'parent');L(mark,tom,'parent');
  var at=function(title,ids){var e=o.events.find(function(x){return x.title===title});if(e)e.who=ids};
  o.events.forEach(function(e){e.who=[]});
  at('Born at the Base Hospital',[rose]);at('The weatherboard on Humffray Street',[arthur,rose,joan]);at('Married Ted Lawson',[ted,arthur,rose,joan]);
  at('Electra Street, Williamstown',[ted,helen]);at('Helen was born',[helen,ted]);at('Summers at Lorne',[ted,helen]);
  at('Trip to Whitby to meet Ted’s family',[ted,edith]);at('The house in Daylesford',[ted,tom]);at('Uluru, after retiring',[ted]);
  at('The unit near Helen, Geelong',[helen,mark,tom]);at('Eastern Beach',[tom]);at('Resting place, beside Ted',[ted]);
  return o;
}
