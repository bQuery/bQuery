/**
 * The named character references the sanitizer decodes.
 *
 * A subset of the WHATWG table
 * (https://html.spec.whatwg.org/multipage/named-characters.html, CC BY 4.0),
 * chosen so that decoding never disagrees with a browser and only ever stops
 * short of one:
 *
 * - every name HTML 4.01 defined, which is what hand-written and CMS-produced
 *   markup actually uses (`&eacute;`, `&mdash;`, `&rsquo;`, `&hellip;`);
 * - every name whose value is ASCII (`&colon;`, `&Tab;`, `&lpar;`), because
 *   those are the ones that can change what a URL means;
 * - all 106 legacy names a browser decodes without a trailing `;`, and every
 *   name that starts with one of them (`&notinva;`). Without the latter,
 *   longest-prefix matching would read `&notinva;` as `&not;` + `inva;`
 *   where a browser reads `∉` — a wrong answer rather than a missing one.
 *
 * Anything else stays literal and is re-escaped on output, so the worst case
 * is a visible `&name;` where a browser would show a glyph. The whole table
 * costs about 7 kB gzipped against this subset's 1.3 kB, in a module chosen
 * for its footprint.
 *
 * Format: runs of consecutive code points, `<first code point, base 36>:`
 * followed by one comma-separated slot per code point. A slot lists that code
 * point's names separated by `/` and may be empty; `!` marks a legacy name.
 * @internal
 */
const ENTITY_RUNS: readonly string[] = [
  '9:Tab,NewLine',
  'x:excl,QUOT!/quot!,num,dollar,percnt,AMP!/amp!,apos,lpar,rpar,ast/midast,plus,comma,,period,sol',
  '1m:colon,semi,LT!/lt!,equals,GT!/gt!,quest,commat',
  '2j:lbrack/lsqb,bsol,rbrack/rsqb,Hat,UnderBar/lowbar,DiacriticalGrave/grave',
  '3f:lbrace/lcub,VerticalLine/verbar/vert,rbrace/rcub',
  '4g:nbsp!,iexcl!,cent!,pound!,curren!,yen!,brvbar!,sect!,uml!,COPY!/copy!,ordf!,laquo!,not!,shy!,REG!/reg!,macr!,deg!,plusmn!,sup2!,sup3!,acute!,micro!,para!,centerdot/middot!,cedil!,sup1!,ordm!,raquo!,frac14!,frac12!,frac34!,iquest!,Agrave!,Aacute!,Acirc!,Atilde!,Auml!,Aring!,AElig!,Ccedil!,Egrave!,Eacute!,Ecirc!,Euml!,Igrave!,Iacute!,Icirc!,Iuml!,ETH!,Ntilde!,Ograve!,Oacute!,Ocirc!,Otilde!,Ouml!,times!,Oslash!,Ugrave!,Uacute!,Ucirc!,Uuml!,Yacute!,THORN!,szlig!,agrave!,aacute!,acirc!,atilde!,auml!,aring!,aelig!,ccedil!,egrave!,eacute!,ecirc!,euml!,igrave!,iacute!,icirc!,iuml!,eth!,ntilde!,ograve!,oacute!,ocirc!,otilde!,ouml!,divide!,oslash!,ugrave!,uacute!,ucirc!,uuml!,yacute!,thorn!,yuml!',
  '9e:OElig,oelig',
  '9s:Scaron,scaron',
  'ag:Yuml',
  'b6:fnof',
  'jq:circ',
  'kc:tilde',
  'pd:Alpha,Beta,Gamma,Delta,Epsilon,Zeta,Eta,Theta,Iota,Kappa,Lambda,Mu,Nu,Xi,Omicron,Pi,Rho,,Sigma,Tau,Upsilon,Phi,Chi,Psi,Omega',
  'q9:alpha,beta,gamma,delta,epsilon,zeta,eta,theta,iota,kappa,lambda,mu,nu,xi,omicron,pi,rho,sigmaf,sigma,tau,upsilon,phi,chi,psi,omega',
  'r5:thetasym,upsih',
  'ra:piv',
  '6bm:ensp,emsp',
  '6bt:thinsp',
  '6bw:zwnj,zwj,lrm,rlm',
  '6c3:ndash,mdash',
  '6c8:lsquo,rsquo,sbquo,,ldquo,rdquo,bdquo,,dagger,Dagger,bull',
  '6cm:hellip',
  '6cw:permil,,prime,Prime',
  '6d5:lsaquo,rsaquo',
  '6da:oline',
  '6dg:frasl',
  '6gc:euro',
  '6j5:image',
  '6jb:copysr,weierp',
  '6jg:real',
  '6jm:trade',
  '6k5:alefsym',
  '6mo:larr,uarr,rarr,darr,harr',
  '6np:crarr',
  '6og:lArr,uArr,rArr,dArr,hArr',
  '6ps:forall,,part,exist,,empty,,nabla,isin,notin/notinva,,ni,notni/notniva',
  '6q7:prod,,sum,minus',
  '6qf:lowast',
  '6qi:radic',
  '6ql:prop,infin,,ang',
  '6qt:parallel,,and,or,cap,cup,int',
  '6r8:there4',
  '6rg:sim',
  '6rp:cong',
  '6rs:asymp',
  '6sg:ne,equiv',
  '6sk:le,ge',
  '6sz:gtrsim',
  '6t3:gtrless',
  '6te:sub,sup,nsub,,sube,supe',
  '6tx:oplus,,otimes',
  '6u8:timesb',
  '6ud:perp',
  '6us:ltrie',
  '6v9:sdot,,divideontimes,,ltimes,,lthree',
  '6vq:ltdot,gtdot/gtrdot',
  '6vv:gtreqless',
  '6wm:notinvc,notinvb',
  '6wt:notnivc,notnivb',
  '6x4:lceil,rceil,lfloor,rfloor',
  '7gi:ltrif,ltri',
  '7gq:loz',
  '7kw:spades',
  '7kz:clubs,,hearts,diams',
  '7vs:lang,rang',
  '86u:ltlarr,,gtrarr',
  '87p:gtlPar,ltrPar',
  '8c0:timesd,timesbar',
  '8e1:ltcir,gtcir,ltquest,gtquest',
  '8ee:gtrapprox',
  '8ek:gtreqqless',
  '8fa:ltcc,gtcc',
];

/** The references whose value is more than one code point. */
const ENTITY_MULTI: Readonly<Record<string, string>> = {
  fjlig: 'fj',
  notinE: '\u22f9\u0338',
  notindot: '\u22f5\u0338',
};

/** The expanded table: every name's value, and which names are legacy. @internal */
export interface EntityTable {
  readonly named: ReadonlyMap<string, string>;
  readonly legacy: ReadonlySet<string>;
}

let table: EntityTable | undefined;

/**
 * Expand `ENTITY_RUNS` on first use, so importing the module stays cheap.
 * @internal
 */
export const loadEntities = (): EntityTable => {
  if (table) return table;
  const named = new Map<string, string>(Object.entries(ENTITY_MULTI));
  const legacy = new Set<string>();
  for (const run of ENTITY_RUNS) {
    const colon = run.indexOf(':');
    let codePoint = Number.parseInt(run.slice(0, colon), 36);
    for (const slot of run.slice(colon + 1).split(',')) {
      const value = String.fromCodePoint(codePoint++);
      for (const entry of slot ? slot.split('/') : []) {
        const isLegacy = entry.endsWith('!');
        const name = isLegacy ? entry.slice(0, -1) : entry;
        if (isLegacy) legacy.add(name);
        named.set(name, value);
      }
    }
  }
  table = { named, legacy };
  return table;
};
