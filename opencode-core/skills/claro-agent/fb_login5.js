
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const EMAIL = "daveymosqueramena@gmail.com";
const PASSWORD=***process.argv[2];

function rand(m,M){return Math.random()*(M-m)+m;}
function delay(ms){return new Promise(r=>setTimeout(r,ms));}

async function main(){
  console.log("Conectando...");
  const b=await puppeteer.connect({browserURL:"http://127.0.0.1:9222",defaultViewport:null});
  const pages=await b.pages();
  let p=pages.find(x=>x.url().includes("facebook.com"));
  if(!p){p=await b.newPage();await p.goto("https://facebook.com");}
  await p.bringToFront();await delay(1500);
  console.log("URL:",p.url());

  const ef=await p.$("input[name=email]");
  if(ef){console.log("Email...");await ef.click();await delay(rand(200,500));await ef.type(EMAIL,{delay:rand(20,60)});await delay(rand(500,1200));}

  const pf=await p.$("input[name=pass]");
  if(pf){console.log("Password...");await pf.click();await delay(rand(200,500));await pf.type(PASSWORD,{delay:rand(20,60)});await delay(rand(300,800));}

  console.log("Enter...");
  await p.keyboard.press("Enter");
  await delay(10000);
  
  const nu=p.url();
  console.log("URL:",nu);
  const body=await p.evaluate(()=>document.body.innerText.substring(0,500));
  const norm=body.normalize("NFD").replace(/[̀-ͯ]/g,"");
  
  if(norm.includes("checkpoint")||norm.includes("codigo")){console.log("2FA!");}
  else if(!norm.includes("iniciar")&&!norm.includes("correo")){console.log("LOGIN EXITOSO!");}
  else{console.log("Fallo.");}
  console.log("Listo!");
  await b.disconnect();
}
main().catch(e=>{console.error(e.message);process.exit(1);});
